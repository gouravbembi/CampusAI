import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { request } from "./api";
import { Field, Form, secret, value } from "./ui";

type Mode = "login" | "invite" | "forgot" | "reset" | "verify";
const titles = {
  login: "Sign in",
  invite: "Accept invitation",
  forgot: "Reset your password",
  reset: "Choose a new password",
  verify: "Verify your email",
};
const hints = {
  login: "Use the email address associated with your institution membership.",
  invite:
    "Set a password for your new account. If you already use CampusAI, enter your existing password.",
  forgot: "Enter your account email. If it can receive a reset link, we’ll send one.",
  reset: "Choose a password with at least 12 characters.",
  verify: "Confirm the email address associated with your account.",
};

export function AuthPage({ mode }: { mode: Mode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [token] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get("token"));
  useEffect(() => {
    if (token && window.location.hash) {
      window.history.replaceState(
        window.history.state,
        "",
        window.location.pathname + window.location.search,
      );
    }
  }, [token]);
  const needsToken = ["invite", "reset", "verify"].includes(mode);
  const inputs = mode !== "verify";
  const requiresEmail = mode === "login" || mode === "forgot";
  const success =
    mode === "forgot" ? "If this account can receive a reset link, check your inbox." : "";

  async function submit(data: FormData) {
    if (mode === "login")
      await request("/auth/login", "POST", {
        email: value(data, "email"),
        password: secret(data, "password"),
      });
    if (mode === "forgot")
      await request("/auth/password/reset/request", "POST", { email: value(data, "email") });
    if (mode === "invite")
      await request("/auth/invitations/accept", "POST", {
        token,
        password: secret(data, "password"),
      });
    if (mode === "reset")
      await request("/auth/password/reset/confirm", "POST", {
        token,
        password: secret(data, "password"),
      });
    if (mode === "verify") await request("/auth/email/verification/confirm", "POST", { token });
    if (mode === "login") navigate("/workspace", { replace: true });
    else if (mode !== "forgot")
      navigate("/login", {
        replace: true,
        state: {
          message:
            mode === "invite"
              ? "Invitation accepted. Sign in to continue."
              : "Account updated. Sign in to continue.",
        },
      });
  }

  return (
    <main className="workspace-auth">
      <Link className="workspace-brand" to="/">
        CampusAI
      </Link>
      <div className="workspace-panel">
        <h1>{titles[mode]}</h1>
        <p>{hints[mode]}</p>
        {mode === "login" && location.state?.message && (
          <p role="status">{location.state.message}</p>
        )}
        {needsToken && !token ? (
          <p className="workspace-error" role="alert">
            Open the complete link from your email.
          </p>
        ) : (
          <Form
            submit={mode === "forgot" ? "Send reset link" : titles[mode]}
            onSubmit={submit}
            success={success}
          >
            {requiresEmail && (
              <Field
                label="Email address"
                name="email"
                type="email"
                autoComplete="username"
                maxLength={254}
                required
              />
            )}
            {inputs && mode !== "forgot" && (
              <Field
                label="Password"
                name="password"
                type="password"
                minLength={mode === "reset" ? 12 : 1}
                maxLength={128}
                autoComplete={mode === "reset" ? "new-password" : "current-password"}
                required
              />
            )}
          </Form>
        )}
        <div className="workspace-actions">
          {mode === "login" ? (
            <Link to="/forgot-password">Forgot password?</Link>
          ) : (
            <Link to="/login">Back to sign in</Link>
          )}
        </div>
      </div>
    </main>
  );
}
