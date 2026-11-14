"use client";

import { useState } from "react";

export default function RegisterPage() {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(formData: FormData) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: formData.get("name"), email: formData.get("email"), password: formData.get("password") }) });
      const data = await response.json(); setMessage(data.message || "Request completed.");
    } catch { setMessage("Unable to reach the server. Please try again."); }
    finally { setBusy(false); }
  }
  return <main style={{ maxWidth: 460, margin: "64px auto", padding: 24 }}>
    <a href="/" style={{ color: "#3657a7", fontWeight: 700 }}>AI Job Automation</a>
    <h1 style={{ fontSize: 32, marginBottom: 8 }}>Create your account</h1>
    <p style={{ color: "#596579", lineHeight: 1.6 }}>Your account starts with standard user access. Staff permissions are assigned separately by an authorised administrator.</p>
    <form action={submit} style={{ display: "grid", gap: 14, marginTop: 24 }}>
      <label style={{ display: "grid", gap: 6 }}>Full name<input name="name" required minLength={2} maxLength={80} autoComplete="name" style={field} /></label>
      <label style={{ display: "grid", gap: 6 }}>Email<input name="email" type="email" required autoComplete="email" style={field} /></label>
      <label style={{ display: "grid", gap: 6 }}>Password<input name="password" type="password" required minLength={12} maxLength={128} autoComplete="new-password" style={field} /><small style={{ color: "#697589" }}>At least 12 characters, including uppercase, lowercase, and a number.</small></label>
      <button disabled={busy} type="submit" style={button}>{busy ? "Creating account…" : "Create account"}</button>
    </form>
    {message && <p role="status" style={{ marginTop: 18, lineHeight: 1.6 }}>{message}</p>}
    <p style={{ marginTop: 20 }}><a href="/verify-email" style={{ color: "#3657a7" }}>Already registered? Verify your email</a></p>
  </main>;
}
const field = { width: "100%", padding: "12px 14px", border: "1px solid #d8deea", borderRadius: 9, fontSize: 15 };
const button = { width: "100%", padding: "13px 16px", border: 0, borderRadius: 9, background: "#24458b", color: "white", fontWeight: 700, fontSize: 15, cursor: "pointer" };
