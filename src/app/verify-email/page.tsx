"use client";

import { useState, type FormEvent } from "react";

type Feedback = { kind: "success" | "error"; message: string } | null;

export default function VerifyEmailPage() {
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [busy, setBusy] = useState(false);

  async function post(url: string, form: HTMLFormElement, fields: string[]) {
    setBusy(true);
    setFeedback(null);
    try {
      const formData = new FormData(form);
      const body = Object.fromEntries(fields.map(field => [field, formData.get(field)]));
      const response = await fetch(url, {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(body)
      });
      const contentType = response.headers.get("content-type") || "";
      const data = contentType.includes("application/json")
        ? await response.json().catch(() => null) as { message?: string } | null
        : null;

      if (!response.ok) {
        const retryAfter = response.status === 429 ? response.headers.get("Retry-After") : null;
        const waitMessage = retryAfter && /^\\d+$/.test(retryAfter)
          ? ` Please wait ${retryAfter} seconds before trying again.`
          : "";
        setFeedback({ kind: "error", message: (data?.message || "We could not process your request. Please try again.") + waitMessage });
        return;
      }

      setFeedback({
        kind: "success",
        message: data?.message || "Your request was received. Please check your email for further instructions."
      });
    } catch {
      setFeedback({ kind: "error", message: "We could not reach the verification service. Please try again." });
    } finally {
      setBusy(false);
    }
  }

  function handleVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    void post("/api/verify-email", event.currentTarget, ["email", "code"]);
  }

  function handleResend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    void post("/api/resend-verification", event.currentTarget, ["email"]);
  }

  return <main style={{ maxWidth: 440, margin: "72px auto", padding: 24 }}>
    <a href="/" style={{ color: "#3657a7", fontWeight: 700 }}>AI Job Automation</a>
    <h1 style={{ fontSize: 32 }}>Verify your email</h1>
    <p style={{ color: "#596579", lineHeight: 1.6 }}>Enter the six-digit code sent to your email address. Codes expire after 10 minutes.</p>
    <form onSubmit={handleVerify} aria-busy={busy} style={{ display: "grid", gap: 14, marginTop: 24 }}>
      <label style={{ display: "grid", gap: 6 }}>Email<input name="email" type="email" required maxLength={254} autoComplete="email" disabled={busy} style={field} /></label>
      <label style={{ display: "grid", gap: 6 }}>Six-digit code<input name="code" inputMode="numeric" pattern="[0-9]{6}" minLength={6} maxLength={6} required disabled={busy} style={field} /></label>
      <button type="submit" disabled={busy} style={button}>{busy ? "Verifying…" : "Verify email"}</button>
    </form>
    <form onSubmit={handleResend} aria-busy={busy} style={{ marginTop: 12, display: "grid", gap: 10 }}>
      <label style={{ display: "grid", gap: 6 }}>Email to resend code<input name="email" type="email" required maxLength={254} autoComplete="email" disabled={busy} style={field} /></label>
      <button type="submit" disabled={busy} style={secondary}>{busy ? "Please wait…" : "Resend verification code"}</button>
    </form>
    {feedback && <p role={feedback.kind === "error" ? "alert" : "status"} aria-live="polite" aria-atomic="true" style={{ marginTop: 18, lineHeight: 1.6, color: feedback.kind === "error" ? "#b42318" : "#176b3a" }}>{feedback.message}</p>}
    <p style={{ marginTop: 20 }}><a href="/signin" style={{ color: "#3657a7" }}>Return to sign in</a></p>
  </main>;
}

const field = { width: "100%", padding: "12px 14px", border: "1px solid #d8deea", borderRadius: 9, fontSize: 15 };
const button = { width: "100%", padding: "13px 16px", border: 0, borderRadius: 9, background: "#24458b", color: "white", fontWeight: 700, fontSize: 15, cursor: "pointer" };
const secondary = { ...button, background: "white", color: "#172033", border: "1px solid #d8deea" };
