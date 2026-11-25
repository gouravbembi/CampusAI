import { useState } from "react";
import { request, useQuery } from "./api";
import { Field, Form, label, Load, Panel, Select, value, type Page } from "./ui";
import type { Academic, AccessStatus, Department, Employer, Role } from "./types";

interface Member {
  id: string;
  role: Role;
  status: AccessStatus;
  user: { email: string; status: AccessStatus };
}
interface Invite {
  id: string;
  email: string;
  role: Role;
}
const roles = ["STUDENT", "RECRUITER", "PLACEMENT_OFFICER"];

export function Invitations({ scope, officer = false }: { scope: string; officer?: boolean }) {
  const query = useQuery<Invite[]>(scope + "/invitations");
  return (
    <>
      <Panel title={officer ? "Invite a student" : "Invite a member"}>
        <Form
          submit="Send invitation"
          success="Invitation sent."
          onSubmit={async (data) => {
            await request(scope + "/invitations", "POST", {
              email: value(data, "email"),
              role: officer ? "STUDENT" : value(data, "role"),
            });
            query.refresh();
          }}
        >
          <Field label="Email address" name="email" type="email" required />
          {!officer && (
            <Select label="Role" name="role">
              {roles.map((role) => (
                <option key={role} value={role}>
                  {label(role)}
                </option>
              ))}
            </Select>
          )}
        </Form>
      </Panel>
      <Panel title="Pending invitations">
        <Load state={query}>
          {query.data?.length ? (
            <ul className="workspace-list">
              {query.data.map((invite) => (
                <li key={invite.id}>
                  <strong>{invite.email}</strong>
                  <p>{label(invite.role)}</p>
                  <Form
                    submit="Revoke invitation"
                    onSubmit={async () => {
                      await request(`${scope}/invitations/${invite.id}`, "DELETE");
                      query.refresh();
                    }}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p>No pending invitations.</p>
          )}
        </Load>
      </Panel>
    </>
  );
}

export function Members({ scope }: { scope: string }) {
  const [after, setAfter] = useState<string>();
  const query = useQuery<Page<Member>>(scope + "/memberships" + (after ? `?after=${after}` : ""));
  return (
    <>
      <Panel title="Institution members">
        <Load state={query}>
          {!query.data?.items.length ? (
            <p>No members to display.</p>
          ) : (
            <ul className="workspace-list">
              {query.data.items.map((member) => (
                <li key={member.id}>
                  <strong>{member.user.email}</strong>
                  <p>
                    {label(member.role)} · {label(member.status)}
                  </p>
                  {member.role !== "ADMINISTRATOR" && (
                    <Form
                      key={`${member.role}-${member.status}-${member.user.status}`}
                      submit="Update access"
                      onSubmit={async (fields) => {
                        const role = value(fields, "role");
                        const status = value(fields, "status");
                        const accountStatus = value(fields, "accountStatus");
                        if (
                          role !== member.role ||
                          status !== member.status ||
                          accountStatus !== member.user.status
                        ) {
                          await request(`${scope}/memberships/${member.id}`, "PATCH", {
                            role: role !== member.role ? role : undefined,
                            status: status !== member.status ? status : undefined,
                            accountStatus:
                              accountStatus !== member.user.status ? accountStatus : undefined,
                          });
                          query.refresh();
                        }
                      }}
                    >
                      <div className="workspace-grid">
                        <Select label="Member role" name="role" defaultValue={member.role}>
                          {roles.map((role) => (
                            <option key={role} value={role}>
                              {label(role)}
                            </option>
                          ))}
                        </Select>
                        <Select
                          label="Membership status"
                          name="status"
                          defaultValue={member.status}
                        >
                          <option value="ACTIVE">Active</option>
                          <option value="REVOKED">Revoked</option>
                        </Select>
                        <Select
                          label="Account status"
                          name="accountStatus"
                          defaultValue={member.user.status}
                        >
                          <option value="ACTIVE">Active</option>
                          <option value="REVOKED">Suspended</option>
                        </Select>
                      </div>
                    </Form>
                  )}
                </li>
              ))}
            </ul>
          )}
          <div className="workspace-actions">
            {after && (
              <button className="workspace-secondary" onClick={() => setAfter(undefined)}>
                First page
              </button>
            )}
            {query.data?.next && (
              <button
                className="workspace-secondary"
                onClick={() => setAfter(query.data?.next ?? undefined)}
              >
                Next page
              </button>
            )}
          </div>
        </Load>
      </Panel>
    </>
  );
}

export function Settings({ scope }: { scope: string }) {
  const query = useQuery<{ name: string; slug: string }>(scope);
  const audits = useQuery<{ id: string; action: string; createdAt: string }[]>(scope + "/audit");
  return (
    <>
      <Panel title="Institution name">
        <Load state={query}>
          <Form
            submit="Save institution"
            onSubmit={async (fields) => {
              await request(scope, "PATCH", { name: value(fields, "name") });
              query.refresh();
            }}
          >
            <Field label="Institution name" name="name" defaultValue={query.data?.name} required />
            <p>Institution identifier: {query.data?.slug}</p>
          </Form>
        </Load>
      </Panel>
      <Panel title="Recent audit events">
        <Load state={audits}>
          {audits.data?.length ? (
            <ul className="workspace-list">
              {audits.data.map((event) => (
                <li key={event.id}>
                  {label(event.action)} · {new Date(event.createdAt).toLocaleString()}
                </li>
              ))}
            </ul>
          ) : (
            <p>No audit events.</p>
          )}
        </Load>
      </Panel>
    </>
  );
}

export function Catalog({ scope }: { scope: string }) {
  const query = useQuery<Department[]>(scope + "/departments");
  function editor(
    label: string,
    submit: string,
    path: string,
    current?: { name: string; code: string },
  ) {
    return (
      <Form
        key={current ? current.name + current.code : undefined}
        submit={submit}
        onSubmit={async (fields) => {
          await request(scope + path, current ? "PATCH" : "POST", {
            name: value(fields, "name"),
            code: value(fields, "code"),
          });
          query.refresh();
        }}
      >
        <div className="workspace-grid">
          <Field
            label={label + " name"}
            name="name"
            defaultValue={current?.name}
            maxLength={120}
            required
          />
          <Field
            label={label + " code"}
            name="code"
            defaultValue={current?.code}
            maxLength={20}
            required
          />
        </div>
      </Form>
    );
  }
  return (
    <>
      <Panel title="Add a department">
        {editor("Department", "Add department", "/departments")}
      </Panel>
      <Panel title="Departments and degree programs">
        <Load state={query}>
          {query.data?.length ? (
            <ul className="workspace-list">
              {query.data.map((dept) => (
                <li key={dept.id}>
                  <h3>{dept.name}</h3>
                  <details>
                    <summary>Edit department</summary>
                    {editor("Department", "Update department", `/departments/${dept.id}`, dept)}
                  </details>
                  <details>
                    <summary>Add degree program</summary>
                    {editor("Program", "Add program", `/departments/${dept.id}/programs`)}
                  </details>
                  {dept.programs.map((program) => (
                    <details key={program.id}>
                      <summary>
                        {program.name} ({program.code})
                      </summary>
                      {editor("Program", "Update program", `/programs/${program.id}`, program)}
                    </details>
                  ))}
                </li>
              ))}
            </ul>
          ) : (
            <p>No departments yet.</p>
          )}
        </Load>
      </Panel>
    </>
  );
}

export function AcademicReviews({ scope }: { scope: string }) {
  const [status, setStatus] = useState("PENDING");
  const [after, setAfter] = useState<string>();
  const query = useQuery<Page<Academic & { student: { fullName: string } }>>(
    `${scope}/academic-records?status=${status}${after ? `&after=${after}` : ""}`,
  );
  return (
    <Panel title="Academic records">
      <label className="workspace-field">
        Verification status
        <select
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setAfter(undefined);
          }}
        >
          <option value="PENDING">Pending</option>
          <option value="VERIFIED">Verified</option>
          <option value="REJECTED">Rejected</option>
        </select>
      </label>
      <Load state={query}>
        {query.data?.items.length ? (
          <ul className="workspace-list">
            {query.data.items.map((record) => (
              <li key={record.id}>
                <h3>{record.student.fullName}</h3>
                <p>
                  {record.program.name} · {record.program.department.name} · Graduation{" "}
                  {record.graduationYear}
                </p>
                <p>
                  CGPA {record.cgpa} · Active backlogs {record.activeBacklogs} ·{" "}
                  {label(record.status)}
                </p>
                {record.status === "PENDING" && (
                  <Form
                    submit="Save decision"
                    onSubmit={async (fields) => {
                      await request(`${scope}/academic-records/${record.id}/review`, "POST", {
                        status: value(fields, "status"),
                        revision: record.revision,
                      });
                      query.refresh();
                    }}
                  >
                    <Select label="Academic decision" name="status" required defaultValue="">
                      <option value="" disabled>
                        Choose a decision
                      </option>
                      <option value="VERIFIED">Verify</option>
                      <option value="REJECTED">Reject</option>
                    </Select>
                  </Form>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p>No {status.toLowerCase()} records in this view.</p>
        )}
        <div className="workspace-actions">
          {after && (
            <button className="workspace-secondary" onClick={() => setAfter(undefined)}>
              First page
            </button>
          )}
          {query.data?.next && (
            <button
              className="workspace-secondary"
              onClick={() => setAfter(query.data?.next ?? undefined)}
            >
              Next page
            </button>
          )}
        </div>
      </Load>
    </Panel>
  );
}

export function Employers({ scope, officer }: { scope: string; officer: boolean }) {
  const [after, setAfter] = useState<string>();
  const filter = officer ? "status=PENDING" : "status=VERIFIED";
  const query = useQuery<Page<Employer>>(
    `${scope}/employers?${filter}${after ? `&after=${after}` : ""}`,
  );
  return (
    <Panel title={officer ? "Employer reviews" : "Verified employers"}>
      <Load state={query}>
        {query.data?.items.length ? (
          <ul className="workspace-list">
            {query.data.items.map((entry) => (
              <li key={entry.id}>
                <h3>{entry.name}</h3>
                <p>{entry.website ?? "No website supplied"}</p>
                {officer ? (
                  <Form
                    submit="Save employer decision"
                    onSubmit={async (data) => {
                      await request(`${scope}/employers/${entry.id}/review`, "POST", {
                        status: value(data, "status"),
                        revision: entry.revision,
                      });
                      query.refresh();
                    }}
                  >
                    <Select label="Employer decision" name="status" defaultValue="" required>
                      <option value="" disabled>
                        Choose a decision
                      </option>
                      <option value="VERIFIED">Approve</option>
                      <option value="REJECTED">Reject</option>
                    </Select>
                  </Form>
                ) : (
                  <Assignment scope={scope} employerId={entry.id} />
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p>{officer ? "No employers awaiting review." : "No verified employers yet."}</p>
        )}
        <div className="workspace-actions">
          {after && (
            <button className="workspace-secondary" onClick={() => setAfter(undefined)}>
              First page
            </button>
          )}
          {query.data?.next && (
            <button
              className="workspace-secondary"
              onClick={() => setAfter(query.data?.next ?? undefined)}
            >
              Next page
            </button>
          )}
        </div>
      </Load>
    </Panel>
  );
}

function Assignment({ scope, employerId }: { scope: string; employerId: string }) {
  const [after, setAfter] = useState<string>();
  const members = useQuery<Page<Member>>(scope + "/memberships" + (after ? `?after=${after}` : ""));
  const recruiters =
    members.data?.items.filter(
      (member) =>
        member.role === "RECRUITER" &&
        member.status === "ACTIVE" &&
        member.user.status === "ACTIVE",
    ) ?? [];
  return (
    <details>
      <summary>Manage recruiter assignment</summary>
      <Load state={members}>
        {recruiters.length ? (
          <Form
            submit="Save assignment"
            onSubmit={async (data) => {
              await request(
                `${scope}/employers/${employerId}/assignments/${value(data, "membershipId")}`,
                "PUT",
                { status: value(data, "status") },
              );
            }}
          >
            <Select label="Recruiter" name="membershipId">
              {recruiters.map((member) => (
                <option value={member.id} key={member.id}>
                  {member.user.email}
                </option>
              ))}
            </Select>
            <Select label="Assignment status" name="status">
              <option value="ACTIVE">Assign</option>
              <option value="REVOKED">Revoke</option>
            </Select>
          </Form>
        ) : (
          <p>No active recruiters on this page.</p>
        )}
        <div className="workspace-actions">
          {after && (
            <button className="workspace-secondary" onClick={() => setAfter(undefined)}>
              First page
            </button>
          )}
          {members.data?.next && (
            <button
              className="workspace-secondary"
              onClick={() => setAfter(members.data?.next ?? undefined)}
            >
              Next page
            </button>
          )}
        </div>
      </Load>
    </details>
  );
}

export function Recruiter({ scope }: { scope: string }) {
  const query = useQuery<{
    profile: { fullName: string; title: string } | null;
    assignments: { employer: Employer; eligible: boolean }[];
  }>(scope + "/recruiters/me");
  return (
    <Load state={query}>
      <Panel title="Recruiter profile">
        <Form
          submit="Save recruiter profile"
          onSubmit={async (data) => {
            await request(scope + "/recruiters/me", "PUT", {
              fullName: value(data, "name"),
              title: value(data, "title"),
            });
            query.refresh();
          }}
        >
          <div className="workspace-grid">
            <Field
              label="Full name"
              name="name"
              defaultValue={query.data?.profile?.fullName}
              required
            />
            <Field
              label="Job title"
              name="title"
              defaultValue={query.data?.profile?.title}
              required
            />
          </div>
        </Form>
      </Panel>
      <Panel title="Employer assignments">
        {query.data?.assignments.length ? (
          <ul className="workspace-list">
            {query.data.assignments.map(({ employer, eligible }) => (
              <li key={employer.id}>
                <strong>{employer.name}</strong>
                <p>
                  {label(employer.status)} ·{" "}
                  {eligible ? "Assignment authorized" : "Employer approval required"}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p>No employer assignments yet.</p>
        )}
      </Panel>
      <Panel title="Submit an employer for review">
        {query.data?.profile ? (
          <Form
            submit="Submit employer"
            onSubmit={async (data) => {
              await request(scope + "/employers", "POST", {
                name: value(data, "name"),
                website: value(data, "website") || null,
              });
              query.refresh();
            }}
          >
            <Field label="Employer name" name="name" required />
            <Field label="Website (optional)" name="website" type="url" />
          </Form>
        ) : (
          <p>Save your recruiter profile before submitting an employer.</p>
        )}
      </Panel>
    </Load>
  );
}
