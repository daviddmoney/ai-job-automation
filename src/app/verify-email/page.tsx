"use client";

import { useState } from "react";

export default function VerifyEmailPage() {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function post(url: string, body: unknown) {
    setBusy(true); setMessage("");
    try { const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const data = await response.json(); setMessage(data.message || "Request completed."); }
    catch { setMessage("Unable to reach the server. Please try again."); }
    finally { setBusy(false); }
  }
  return <main style={{ maxWidth: 440, margin: "72px auto", padding: 24 }}>
    <a href="/" style={{ color: "#3657a7", fontWeight: 700 }}>AI Job Automation</a>
    <h1 style={{ fontSize: 32 }}>Verify your email</h1>
    <p style={{ color: "#596579", lineHeight: 1.6 }}>Enter the six-digit code sent to your email address. Codes expire after 10 minutes.</p>
    <form action={formData => post("/api/verify-email", { email: formData.get("email"), code: formData.get("code") })} style={{ display: "grid", gap: 14, marginTop: 24 }}>
      <label style={{ display: "grid", gap: 6 }}>Email<input name="email" type="email" required autoComplete="email" style={field} /></label>
      <label style={{ display: "grid", gap: 6 }}>Six-digit code<input name="code" inputMode="numeric" pattern="[0-9]{6}" minLength={6} maxLength={6} required style={field} /></label>
      <button type="submit" disabled={busy} style={button}>{busy ? "Verifying…" : "Verify email"}</button>
    </form>
    <form action={formData => post("/api/resend-verification", { email: formData.get("email") })} style={{ marginTop: 12, display: "grid", gap: 10 }}>
      <label style={{ display: "grid", gap: 6 }}>Email to resend code<input name="email" type="email" required autoComplete="email" style={field} /></label>
      <button type="submit" disabled={busy} style={secondary}>Resend verification code</button>
    </form>
    {message && <p role="status" style={{ marginTop: 18, lineHeight: 1.6 }}>{message}</p>}
    <p style={{ marginTop: 20 }}><a href="/signin" style={{ color: "#3657a7" }}>Return to sign in</a></p>
  </main>;
}
const field = { width: "100%", padding: "12px 14px", border: "1px solid #d8deea", borderRadius: 9, fontSize: 15 };
const button = { width: "100%", padding: "13px 16px", border: 0, borderRadius: 9, background: "#24458b", color: "white", fontWeight: 700, fontSize: 15, cursor: "pointer" };
const secondary = { ...button, background: "white", color: "#172033", border: "1px solid #d8deea" };
