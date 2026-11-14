"use client";

import { useState } from "react";

export default function TwoFactorSettingsPage() {
  const [setup, setSetup] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function post(url: string, body?: unknown) {
    setBusy(true); setMessage("");
    try { const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined }); const data = await response.json(); setMessage(data.message || "Request completed."); return data; }
    catch { setMessage("Unable to reach the server."); return null; }
    finally { setBusy(false); }
  }
  async function startTotp() { const data = await post("/api/security/2fa/totp/setup"); if (data?.secret) setSetup({ secret: data.secret, otpauthUrl: data.otpauthUrl }); }
  async function confirmTotp() { await post("/api/security/2fa/totp/confirm", { code }); }
  async function startEmail() { await post("/api/security/2fa/email/start"); }
  async function confirmEmail() { await post("/api/security/2fa/email/confirm", { code }); }
  return <main style={{ maxWidth: 680, margin: "56px auto", padding: 24 }}>
    <a href="/dashboard" style={{ color: "#3657a7" }}>← Dashboard</a>
    <h1 style={{ fontSize: 32 }}>Two-factor authentication</h1>
    <p style={{ color: "#596579", lineHeight: 1.6 }}>Add a second sign-in check to protect your account. Choose email codes or an authenticator app.</p>
    <section style={card}><h2>Email verification code</h2><p>Send a confirmation code to your verified email, then enter it below to enable email-based two-factor authentication.</p><button disabled={busy} onClick={startEmail} style={button}>Send email confirmation code</button><div style={{ display: "flex", gap: 8, marginTop: 12 }}><input value={code} onChange={e=>setCode(e.target.value)} placeholder="Six-digit code" inputMode="numeric" maxLength={6} style={field}/><button disabled={busy || code.length!==6} onClick={confirmEmail} style={button}>Confirm</button></div></section>
    <section style={card}><h2>Authenticator app</h2><p>Use an authenticator app that supports standard time-based one-time passwords (TOTP).</p><button disabled={busy} onClick={startTotp} style={button}>Set up authenticator</button>{setup && <div style={{ marginTop: 14 }}><p>Enter this setup key manually in your authenticator app:</p><code style={{ overflowWrap: "anywhere" }}>{setup.secret}</code><p style={{ fontSize: 12, color: "#697589" }}>The QR-compatible provisioning URI is available in the setup response. Keep the secret private.</p><div style={{ display: "flex", gap: 8 }}><input value={code} onChange={e=>setCode(e.target.value)} placeholder="Six-digit code" inputMode="numeric" maxLength={6} style={field}/><button disabled={busy || code.length!==6} onClick={confirmTotp} style={button}>Confirm</button></div></div>}</section>
    {message && <p role="status" style={{ marginTop: 16 }}>{message}</p>}
  </main>;
}
const card = { border: "1px solid #e2e7ef", borderRadius: 14, padding: 20, marginTop: 18, background: "white" };
const field = { minWidth: 0, flex: 1, padding: "12px 14px", border: "1px solid #d8deea", borderRadius: 9, fontSize: 15 };
const button = { padding: "12px 16px", border: 0, borderRadius: 9, background: "#24458b", color: "white", fontWeight: 700, cursor: "pointer" };
