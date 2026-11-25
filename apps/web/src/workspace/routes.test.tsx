// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { SiteRoutes } from "./routes";

const institutionId = "b10aa400-618f-4b06-8dae-b4fd79b12199";
const membership = {
  id: "member",
  institutionId,
  role: "STUDENT",
  institution: { name: "Northbridge University", slug: "northbridge" },
};
const account = { email: "student@example.test", emailVerified: true, memberships: [membership] };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function go(path: string) {
  window.history.replaceState({}, "", path);
  return render(<SiteRoutes />);
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

test("protected routes redirect expired or anonymous sessions to sign in", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => json({ error: "authentication_required" }, 401)),
  );
  go(`/workspace/${institutionId}/profile`);
  await screen.findByRole("heading", { name: "Sign in" });
  expect(window.location.pathname).toBe("/login");
  expect(screen.getByRole("status").textContent).toContain("Your session has ended");
});

test("submits credentials with the CSRF header and renders the student navigation", async () => {
  const fetcher = vi.fn<(url: string, options?: RequestInit) => Promise<Response>>(async (url) => {
    if (url.endsWith("/auth/login")) return new Response(null, { status: 204 });
    if (url.endsWith("/auth/me")) return json(account);
    if (url.endsWith("/departments")) return json([]);
    if (url.endsWith("/students/me")) return json({ profile: null, completeness: 0 });
    throw new Error("Unexpected request");
  });
  vi.stubGlobal("fetch", fetcher);
  go("/login");
  fireEvent.change(screen.getByLabelText("Email address"), { target: { value: account.email } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "  sample-secret  " } });
  fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
  await screen.findByRole("heading", { name: "Student profile" });
  const options = fetcher.mock.calls[0]?.[1];
  expect(options?.credentials).toBe("include");
  expect(new Headers(options?.headers).get("X-CampusAI-CSRF")).toBe("1");
  expect(JSON.parse(String(options?.body))).toEqual({
    email: account.email,
    password: "  sample-secret  ",
  });
  expect(screen.getByRole("link", { name: "Resume management" })).toBeTruthy();
  expect(screen.queryByRole("link", { name: "Memberships" })).toBeNull();
});

test("a student cannot render an administrator section using a direct URL", async () => {
  const fetcher = vi.fn(async () => json(account));
  vi.stubGlobal("fetch", fetcher);
  go(`/workspace/${institutionId}/members`);
  await screen.findByRole("heading", { name: "Access unavailable" });
  expect(fetcher).toHaveBeenCalledTimes(1);
});

test("invitation tokens stay out of URL queries and browser storage", async () => {
  const raw = "A".repeat(43);
  const fetcher = vi.fn(async () => new Response(null, { status: 204 }));
  vi.stubGlobal("fetch", fetcher);
  go("/accept-invitation#token=" + raw);
  await waitFor(() => expect(window.location.hash).toBe(""));
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "synthetic-password" } });
  fireEvent.click(screen.getByRole("button", { name: "Accept invitation" }));
  await screen.findByRole("heading", { name: "Sign in" });
  expect(fetcher).toHaveBeenCalledWith(
    expect.stringMatching(/\/invitations\/accept$/),
    expect.objectContaining({
      body: JSON.stringify({ token: raw, password: "synthetic-password" }),
    }),
  );
  expect(window.localStorage.length + window.sessionStorage.length).toBe(0);
});
