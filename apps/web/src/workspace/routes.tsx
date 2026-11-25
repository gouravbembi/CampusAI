import { useEffect } from "react";
import {
  BrowserRouter,
  Link,
  Navigate,
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import { App } from "../App";
import { request, useQuery } from "./api";
import { AuthPage } from "./auth";
import {
  AcademicReviews,
  Catalog,
  Employers,
  Invitations,
  Members,
  Recruiter,
  Settings,
} from "./institution";
import { Resumes, StudentProfile } from "./student";
import type { Account, Membership, Role } from "./types";
import { Field, Form, label, Load, Panel, secret } from "./ui";
import "./workspace.css";

const sections: Record<Role, ReadonlyArray<readonly [string, string]>> = {
  ADMINISTRATOR: [
    ["members", "Memberships"],
    ["invitations", "Invitations"],
    ["employers", "Employer assignments"],
    ["settings", "Institution settings"],
  ],
  PLACEMENT_OFFICER: [
    ["academic", "Academic verification"],
    ["catalog", "Departments and programs"],
    ["employers", "Employer review"],
    ["invitations", "Student invitations"],
  ],
  STUDENT: [
    ["profile", "Student profile"],
    ["resumes", "Resume management"],
  ],
  RECRUITER: [["recruiter", "Recruiter onboarding"]],
};

interface Session {
  id: string;
  createdAt: string;
  expiresAt: string;
  current: boolean;
}

function SessionSettings() {
  const query = useQuery<Session[]>("/auth/sessions");
  const navigate = useNavigate();
  return (
    <>
      <Panel title="Active sessions">
        <Load state={query}>
          {query.data?.length ? (
            <ul className="workspace-list">
              {query.data.map((entry) => (
                <li key={entry.id}>
                  <strong>{entry.current ? "This session" : "Other session"}</strong>
                  <p>
                    Signed in {new Date(entry.createdAt).toLocaleString()} · Expires{" "}
                    {new Date(entry.expiresAt).toLocaleString()}
                  </p>
                  <Form
                    submit={entry.current ? "End this session" : "Revoke session"}
                    onSubmit={async () => {
                      await request("/auth/sessions/" + entry.id, "DELETE");
                      if (entry.current) navigate("/login", { replace: true });
                      else query.refresh();
                    }}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p>No active sessions.</p>
          )}
        </Load>
      </Panel>
      <Panel title="Change password">
        <p>Changing your password signs you out of all sessions.</p>
        <Form
          submit="Change password"
          onSubmit={async (fields) => {
            await request("/auth/password/change", "POST", {
              currentPassword: secret(fields, "current"),
              password: secret(fields, "password"),
            });
            navigate("/login", {
              replace: true,
              state: { message: "Password changed. Sign in again." },
            });
          }}
        >
          <Field
            label="Current password"
            name="current"
            type="password"
            autoComplete="current-password"
            required
          />
          <Field
            label="New password (12 characters or more)"
            name="password"
            type="password"
            minLength={12}
            maxLength={128}
            autoComplete="new-password"
            required
          />
        </Form>
      </Panel>
    </>
  );
}

function AccessDenied({
  message = "You do not have access to this workspace.",
}: {
  message?: string;
}) {
  return (
    <main className="workspace-auth">
      <Link className="workspace-brand" to="/">
        CampusAI
      </Link>
      <div className="workspace-panel">
        <h1>Access unavailable</h1>
        <p>{message}</p>
        <Link to="/workspace">Return to your workspace</Link>
      </div>
    </main>
  );
}

function Section({ member, section }: { member: Membership; section: string }) {
  const scope = "/institutions/" + member.institutionId;
  switch (section) {
    case "profile":
      return <StudentProfile scope={scope} />;
    case "resumes":
      return <Resumes scope={scope} />;
    case "members":
      return <Members scope={scope} />;
    case "invitations":
      return <Invitations scope={scope} officer={member.role === "PLACEMENT_OFFICER"} />;
    case "settings":
      return <Settings scope={scope} />;
    case "academic":
      return <AcademicReviews scope={scope} />;
    case "catalog":
      return <Catalog scope={scope} />;
    case "employers":
      return <Employers scope={scope} officer={member.role === "PLACEMENT_OFFICER"} />;
    case "recruiter":
      return <Recruiter scope={scope} />;
    case "account":
      return <SessionSettings />;
    default:
      return null;
  }
}

function Workspace() {
  const { institutionId, section: routeSection } = useParams();
  const section = useLocation().pathname === "/account" ? "account" : routeSection;
  const navigate = useNavigate();
  const query = useQuery<Account | null>("/auth/me");
  useEffect(() => {
    const expired = () =>
      navigate("/login", {
        replace: true,
        state: { message: "Your session has ended. Sign in to continue." },
      });
    window.addEventListener("campusai-session-expired", expired);
    return () => window.removeEventListener("campusai-session-expired", expired);
  }, [navigate]);
  if (query.errorStatus === 401) {
    return <Navigate to="/login" replace state={{ message: query.error }} />;
  }

  const account = query.data;
  const member = account?.memberships.find((entry) => entry.institutionId === institutionId);
  if (account && !member && institutionId) return <AccessDenied />;
  if (account && !institutionId && account.memberships.length === 1 && section !== "account") {
    const selected = account.memberships[0]!;
    return (
      <Navigate
        to={`/workspace/${selected.institutionId}/${sections[selected.role][0]![0]}`}
        replace
      />
    );
  }
  if (member && !section)
    return (
      <Navigate to={`/workspace/${member.institutionId}/${sections[member.role][0]![0]}`} replace />
    );
  const title =
    section === "account"
      ? "Account security"
      : member
        ? sections[member.role].find(([key]) => key === section)?.[1]
        : "Your institutions";
  if (!title) return <AccessDenied />;

  return (
    <div className="workspace-shell">
      <a
        href="#workspace-main"
        className="sr-only focus:not-sr-only focus:fixed focus:z-10 focus:bg-card focus:p-3"
      >
        Skip to content
      </a>
      <header className="workspace-header">
        <Link className="workspace-brand" to="/">
          CampusAI
        </Link>
        {account && (
          <div className="workspace-actions">
            <Link to={member ? `/workspace/${member.institutionId}/account` : "/account"}>
              Account security
            </Link>
            <Form
              submit="Sign out"
              onSubmit={async () => {
                await request("/auth/logout", "POST");
                navigate("/login", { replace: true });
              }}
            />
          </div>
        )}
      </header>
      <div className={member ? "workspace-layout with-nav" : "workspace-layout"}>
        {member && (
          <nav className="workspace-nav" aria-label="Workspace">
            <strong>{member.institution.name}</strong>
            <p>{label(member.role)}</p>
            {sections[member.role].map(([key, entry]) => (
              <NavLink key={key} to={`/workspace/${member.institutionId}/${key}`}>
                {entry}
              </NavLink>
            ))}
            {(account?.memberships.length ?? 0) > 1 && (
              <Link to="/workspace">Switch institution</Link>
            )}
          </nav>
        )}
        <main className="workspace-main" id="workspace-main" tabIndex={-1}>
          <h1>{title}</h1>
          <Load state={query}>
            {account &&
              (member && section ? (
                <Section key={member.institutionId + section} member={member} section={section} />
              ) : section === "account" ? (
                <SessionSettings />
              ) : (
                <Panel title="Institution access">
                  {!account.emailVerified && (
                    <Form
                      submit="Send verification email"
                      success="Check your inbox for a verification link."
                      onSubmit={async () => {
                        await request("/auth/email/verification/request", "POST");
                      }}
                    />
                  )}
                  {account.memberships.length ? (
                    <ul className="workspace-list">
                      {account.memberships.map((entry) => (
                        <li key={entry.id}>
                          <Link to={`/workspace/${entry.institutionId}`}>
                            {entry.institution.name}
                          </Link>
                          <p>{label(entry.role)}</p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>
                      No active institution memberships. Contact your institution’s administrator.
                    </p>
                  )}
                </Panel>
              ))}
          </Load>
        </main>
      </div>
    </div>
  );
}

export function SiteRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/login" element={<AuthPage key="login" mode="login" />} />
        <Route path="/accept-invitation" element={<AuthPage key="invite" mode="invite" />} />
        <Route path="/forgot-password" element={<AuthPage key="forgot" mode="forgot" />} />
        <Route path="/reset-password" element={<AuthPage key="reset" mode="reset" />} />
        <Route path="/verify-email" element={<AuthPage key="verify" mode="verify" />} />
        <Route path="/account" element={<Workspace />} />
        <Route path="/workspace/:institutionId?/:section?" element={<Workspace />} />
        <Route path="*" element={<AccessDenied message="This page could not be found." />} />
      </Routes>
    </BrowserRouter>
  );
}
