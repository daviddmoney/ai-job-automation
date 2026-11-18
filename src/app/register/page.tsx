"use client";

import { useState } from "react";

export default function RegisterPage() {
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "">("");
  const [busy, setBusy] = useState(false);

  async function submit(formData: FormData) {
    setBusy(true);
    setMessage("");
    setMessageType("");

    try {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.get("name"),
          email: formData.get("email"),
          password: formData.get("password")
        })
      });

      const data: { message?: string } = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(data.message || "We could not create your account. Please check your details and try again.");
        setMessageType("error");
        return;
      }

      setMessage(data.message || "Your request was received. Check your email for the next steps.");
      setMessageType("success");
    } catch {
      setMessage("We could not reach the server. Your details have not been confirmed. Please try again.");
      setMessageType("error");
    } finally {
      setBusy(false);
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Use an ordinary submit handler rather than a React form action so the
    // browser does not automatically reset the user's fields after the action.
    void submit(new FormData(event.currentTarget));
  }

  return <main className="form-page">
    <a href="/" className="action-link">AI Job Automation</a>
    <h1 style={{ fontSize: 32, marginBottom: 8 }}>Create your account</h1>
    <p style={{ color: "#596579", lineHeight: 1.6 }}>Your account starts with standard user access. Staff permissions are assigned separately by an authorised administrator.</p>
    <form onSubmit={handleSubmit} style={{ display: "grid", gap: 14, marginTop: 24 }}>
      <label style={{ display: "grid", gap: 6 }}>Full name<input name="name" required minLength={2} maxLength={80} autoComplete="name" style={field} /></label>
      <label style={{ display: "grid", gap: 6 }}>Email<input name="email" type="email" required autoComplete="email" style={field} /></label>
      <label style={{ display: "grid", gap: 6 }}>Password<input name="password" type="password" required minLength={12} maxLength={128} autoComplete="new-password" style={field} /><small style={{ color: "#697589" }}>At least 12 characters, including uppercase, lowercase, and a number.</small></label>
      <button disabled={busy} type="submit" style={{ ...button, opacity: busy ? 0.7 : 1, cursor: busy ? "wait" : "pointer" }}>{busy ? "Creating account…" : "Create account"}</button>
    </form>
    {message && <p role={messageType === "error" ? "alert" : "status"} aria-live="polite" style={{ marginTop: 18, lineHeight: 1.6, color: messageType === "error" ? "#b42318" : "#176b3a" }}>{message}</p>}
    <p style={{ marginTop: 20 }}><a href="/verify-email" style={{ color: "#3657a7" }}>Already registered? Verify your email</a></p>
  </main>;
}

const field = { width: "100%", padding: "12px 14px", border: "1px solid #d8deea", borderRadius: 9, fontSize: 15 };
const button = { width: "100%", padding: "13px 16px", border: 0, borderRadius: 9, background: "#24458b", color: "white", fontWeight: 700, fontSize: 15 };
