import { useId, useState, type FormEvent, type InputHTMLAttributes, type ReactNode } from "react";

export function Field({
  label,
  id,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  return (
    <div className="workspace-field">
      <label htmlFor={fieldId}>{label}</label>
      <input id={fieldId} {...props} />
    </div>
  );
}

export function Select({
  label,
  name,
  children,
  defaultValue,
  required,
}: {
  label: string;
  name: string;
  children: ReactNode;
  defaultValue?: string;
  required?: boolean;
}) {
  const fieldId = useId();
  return (
    <div className="workspace-field">
      <label htmlFor={fieldId}>{label}</label>
      <select id={fieldId} name={name} defaultValue={defaultValue} required={required}>
        {children}
      </select>
    </div>
  );
}

export function TextArea({
  label,
  name,
  defaultValue,
  rows = 3,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  rows?: number;
}) {
  const fieldId = useId();
  return (
    <div className="workspace-field">
      <label htmlFor={fieldId}>{label}</label>
      <textarea id={fieldId} name={name} rows={rows} defaultValue={defaultValue} />
    </div>
  );
}

export function Form({
  children,
  submit,
  onSubmit,
  success = "Saved.",
}: {
  children?: ReactNode;
  submit: string;
  onSubmit: (data: FormData) => Promise<void>;
  success?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ message: string; error: boolean }>();
  async function handle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setFeedback(undefined);
    try {
      await onSubmit(data);
      if (success) setFeedback({ message: success, error: false });
    } catch (error) {
      setFeedback({
        message: error instanceof Error ? error.message : "The request failed.",
        error: true,
      });
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="workspace-form" onSubmit={(event) => void handle(event)} aria-busy={busy}>
      <fieldset disabled={busy}>
        {children}
        <button className="workspace-button" type="submit">
          {busy ? "Working…" : submit}
        </button>
      </fieldset>
      {feedback && (
        <p
          className={feedback.error ? "workspace-error" : "workspace-success"}
          role={feedback.error ? "alert" : "status"}
        >
          {feedback.message}
        </p>
      )}
    </form>
  );
}

export function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="workspace-panel">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

export function Load({
  state,
  children,
}: {
  state: { loading: boolean; error?: string; refresh: () => void };
  children: ReactNode;
}) {
  if (state.loading) return <p role="status">Loading…</p>;
  if (state.error)
    return (
      <div>
        <p role="alert" className="workspace-error">
          {state.error}
        </p>
        <button className="workspace-button" onClick={state.refresh}>
          Try again
        </button>
      </div>
    );
  return children;
}

export const value = (data: FormData, key: string) => String(data.get(key) ?? "").trim();
export const secret = (data: FormData, key: string) => String(data.get(key) ?? "");
export const label = (entry: string) =>
  entry
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^./, (letter) => letter.toUpperCase());

export interface Page<T> {
  items: T[];
  next: string | null;
}
