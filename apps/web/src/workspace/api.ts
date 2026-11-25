import { useEffect, useState } from "react";

const apiOrigin = import.meta.env.VITE_API_ORIGIN ?? "http://localhost:3001";
const apiUrl = (path: string) => `${apiOrigin}/api/v1${path}`;

const messages: Record<string, string> = {
  authentication_required: "Your session has ended. Sign in to continue.",
  invalid_credentials: "The email or password could not be verified.",
  invalid_or_expired_token: "This link is invalid, expired, or has already been used.",
  invalid_input: "Check the values you entered and try again.",
  forbidden: "You do not have permission for this action.",
  not_found: "The requested resource is unavailable.",
  conflict: "The record already exists or changed. Refresh the page and try again.",
  rate_limited: "Too many attempts. Try again later.",
  invalid_resume_format: "Choose a valid PDF or DOCX file.",
  invalid_upload: "Choose one PDF or DOCX file no larger than 5 MiB.",
  email_unavailable: "Email delivery is unavailable. Try again later.",
  membership_exists: "This person already has a membership at the institution.",
  profile_required: "Save your profile before continuing.",
  resume_limit_reached: "Delete an older resume version before uploading another.",
  record_unavailable_or_changed: "The record has changed or is unavailable. Refresh and try again.",
  account_has_multiple_institutions:
    "This account belongs to multiple institutions. Revoke this institution’s membership instead.",
};

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    code: string,
  ) {
    super(messages[code] ?? "The request could not be completed. Try again.");
  }
}

async function send(path: string, method: string, body?: unknown) {
  const headers = new Headers();
  const multipart = body instanceof FormData;
  if (method !== "GET") headers.set("X-CampusAI-CSRF", "1");
  if (body !== undefined && !multipart) headers.set("Content-Type", "application/json");
  let response: Response;
  try {
    response = await fetch(apiUrl(path), {
      credentials: "include",
      method,
      headers,
      body: multipart ? body : body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new Error("CampusAI could not be reached. Check your connection and try again.");
  }
  if (!response.ok) {
    const failure = (await response.json().catch(() => ({}))) as { error?: string };
    if (
      response.status === 401 &&
      failure.error === "authentication_required" &&
      path !== "/auth/me"
    ) {
      window.dispatchEvent(new Event("campusai-session-expired"));
    }
    throw new ApiError(response.status, failure.error ?? "");
  }
  return response;
}

export async function request<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const response = await send(path, method, body);
  return (
    response.headers.get("content-type")?.includes("application/json")
      ? await response.json()
      : undefined
  ) as T;
}

export async function download(path: string, filename: string) {
  const response = await send(path, "GET");
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

interface QueryState<T> {
  path?: string;
  data?: T;
  error?: string;
  errorStatus?: number;
  loading: boolean;
}

export function useQuery<T>(path: string) {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<QueryState<T>>({ loading: true });
  useEffect(() => {
    let active = true;
    request<T>(path).then(
      (data) => {
        if (active) setState({ path, data, loading: false });
      },
      (error: Error) => {
        if (active)
          setState({
            path,
            error: error.message,
            errorStatus: error instanceof ApiError ? error.status : undefined,
            loading: false,
          });
      },
    );
    return () => {
      active = false;
    };
  }, [path, revision]);
  return {
    ...(state.path === path ? state : { loading: true }),
    refresh: () => setRevision((value) => value + 1),
  };
}
