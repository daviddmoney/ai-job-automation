"use client";

import { useState, type FormEvent } from "react";

type Feedback = { kind: "success" | "error"; message: string } | null;

export default function RegisterPage() {
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [busy, setBusy] = useState(false);

  async function submit(form: HTMLFormElement) {
    setBusy(true);
    setFeedback(null);

    try {
      const formData = new FormData(form);
      const response = await fetch("/api/register", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          name: formData.get("name"),
          email: formData.get("email"),
          password: formData.get("password")
        })
      });

      const contentType = response.headers.get("content-type") || "";
      const data = contentType.includes("application/json")
        ? await response.json().catch(() => null) as { message?: string } | null
        : null;

      if (!response.ok) {
        const retryAfter = response.status === 429 ? response.headers.get("Retry-After") : null;
        const waitMessage = retryAfter && /^\d+$/.test(retryAfter)
          ? ` Please wait ${retryAfter} seconds before trying again.`
          : "";
        setFeedback({
          kind: "error",
          message: (data?.message || "We could not process your registration. Please try again.") + waitMessage
        });
        return;
      }

      // The API intentionally returns a generic 202 response to prevent
      // account/email enumeration. Do not claim that an account was created
      // or that an email was delivered; direct the user to check their inbox.
      setFeedback({
        kind: "success",
        message: data?.message || "If the details can be used to create or verify an account, instructions will be sent to that email address. Check your inbox and spam folder."
      });
    } catch {
      setFeedback({
        kind: "error",
        message: "We could not reach the registration service. Your request was not confirmed. Please try again."
      });
    } finally {
      setBusy(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    // A normal submit event avoids React form-action reset behaviour. Keeping
    // the form mounted also preserves the user's entries after API failures.
    void submit(event.currentTarget);
  }

  return <main className="form-page">
    <a href="/" className="action-link">AI Job Automation</a>
    <h1 style={{ fontSize: 32, marginBottom: 8 }}>Create your account</h1>
    <p style={{ color: "#596579", lineHeight: 1.6 }}>Your account starts with standard user access. Staff permissions are assigned separately by an authorised administrator.</p>
    <form onSubmit={handleSubmit} aria-busy={busy} style={{ display: "grid", gap: 14, marginTop: 24 }}>
      <label style={{ display: "grid", gap: 6 }}>Full name<input name="name" required minLength={2} maxLength={80} autoComplete="name" disabled={busy} style={field} /></label>
      <label style={{ display: "grid", gap: 6 }}>Email<input name="email" type="email" required maxLength={254} autoComplete="email" disabled={busy} style={field} /></label>
      <label style={{ display: "grid", gap: 6 }}>Password<input name="password" type="password" required minLength={12} maxLength={128} autoComplete="new-password" disabled={busy} style={field} /><small style={{ color: "#697589" }}>At least 12 characters, including uppercase, lowercase, and a number.</small></label>
      <button disabled={busy} type="submit" style={{ ...button, opacity: busy ? 0.7 : 1, cursor: busy ? "wait" : "pointer" }}>{busy ? "Creating account…" : "Create account"}</button>
    </form>
    {feedback && <p role={feedback.kind === "error" ? "alert" : "status"} aria-live="polite" aria-atomic="true" style={{ marginTop: 18, lineHeight: 1.6, color: feedback.kind === "error" ? "#b42318" : "#176b3a" }}>{feedback.message}</p>}
    <p style={{ marginTop: 20 }}><a href="/verify-email" style={{ color: "#3657a7" }}>Already registered? Verify your email</a></p>
  </main>;
}

const field = { width: "100%", padding: "12px 14px", border: "1px solid #d8deea", borderRadius: 9, fontSize: 15 };
const button = { width: "100%", padding: "13px 16px", border: 0, borderRadius: 9, background: "#24458b", color: "white", fontWeight: 700, fontSize: 15 };
