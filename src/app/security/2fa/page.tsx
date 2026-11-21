"use client";

import { useState } from "react";

export default function TwoFactorSettingsPage() {
  const [setup, setSetup] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function post(url: string, body?: unknown) {
    setBusy(true); setMessage("");
    try { const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined }); const data = await response.json(); setMessage(data.message || "Request completed."); return data; }
    catch { setMessage("Unable to reach the server."); return null; }
    finally { setBusy(false); }
  }
  async function startTotp() { const data = await post("/api/security/2fa/totp/setup", { password }); if (data?.secret) setSetup({ secret: data.secret, otpauthUrl: data.otpauthUrl }); }
  async function confirmTotp() { await post("/api/security/2fa/totp/confirm", { code, password }); }
  async function startEmail() { await post("/api/security/2fa/email/start", { password }); }
  async function confirmEmail() { await post("/api/security/2fa/email/confirm", { code, password }); }
  async function sendDisableEmailCode() { await post("/api/account/two-factor/disable-code", { password }); }
  async function disableTwoFactor() { await post("/api/account/two-factor/disable", { password, code }); setCode(""); setPassword(""); setRecoveryCodes([]); }
  async function generateRecoveryCodes() { const data = await post("/api/account/two-factor/recovery-codes", { password, code }); if (Array.isArray(data?.recoveryCodes)) { setRecoveryCodes(data.recoveryCodes); setPassword(""); setCode(""); } }
  return <main className="form-page" style={{maxWidth:680}}> 
    <a href="/dashboard" className="action-link">← Back to your workspace</a>
    <h1 style={{ fontSize: 32 }}>Two-factor authentication</h1>
    <p style={{ color: "#596579", lineHeight: 1.6 }}>Add a second sign-in check to protect your account. Choose email codes or an authenticator app.</p>
    <section style={card}><h2>Email verification code</h2><label style={{ display: "grid", gap: 6 }}>Current account password<input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} style={field}/></label><p>Send a confirmation code to your verified email, then enter it below to enable email-based two-factor authentication.</p><button disabled={busy} onClick={startEmail} style={button}>Send email confirmation code</button><div style={{ display: "flex", gap: 8, marginTop: 12 }}><input value={code} onChange={e=>setCode(e.target.value)} placeholder="Six-digit code" inputMode="numeric" maxLength={6} style={field}/><button disabled={busy || code.length!==6} onClick={confirmEmail} style={button}>Confirm</button></div></section>
    <section style={card}><h2>Authenticator app</h2><label style={{ display: "grid", gap: 6 }}>Current account password<input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} style={field}/></label><p>Use an authenticator app that supports standard time-based one-time passwords (TOTP).</p><button disabled={busy} onClick={startTotp} style={button}>Set up authenticator</button>{setup && <div style={{ marginTop: 14 }}><p>Enter this setup key manually in your authenticator app:</p><code style={{ overflowWrap: "anywhere" }}>{setup.secret}</code><p style={{ fontSize: 12, color: "#697589" }}>The QR-compatible provisioning URI is available in the setup response. Keep the secret private.</p><div style={{ display: "flex", gap: 8 }}><input value={code} onChange={e=>setCode(e.target.value)} placeholder="Six-digit code" inputMode="numeric" maxLength={6} style={field}/><button disabled={busy || code.length!==6} onClick={confirmTotp} style={button}>Confirm</button></div></div>}</section>
    <section style={card}><h2>Disable two-factor authentication</h2><p>Enter your current password and the active email or authenticator code. For TOTP you may use a saved one-time recovery code. If your active method is email, request a fresh code first.</p><button disabled={busy || !password} onClick={sendDisableEmailCode} style={button}>Send current email 2FA code</button><label style={{ display: "grid", gap: 6 }}>Current account password<input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} style={field}/></label><label style={{ display: "grid", gap: 6, marginTop: 10 }}>Current second-factor code<input value={code} onChange={e=>setCode(e.target.value)} inputMode="text" maxLength={16} placeholder="Six-digit code or recovery code" style={field}/></label><button disabled={busy || !password || !code} onClick={disableTwoFactor} style={{...button, marginTop: 12}}>Disable two-factor authentication</button></section>
    <section style={card}><h2>Authenticator recovery codes</h2><p>Generate ten one-time backup codes. You must have authenticator-app two-factor authentication enabled. Generating a new set invalidates the previous set.</p><label style={{ display: "grid", gap: 6 }}>Current account password<input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} style={field}/></label><label style={{ display: "grid", gap: 6, marginTop: 10 }}>Current authenticator code<input value={code} onChange={e=>setCode(e.target.value)} inputMode="numeric" maxLength={6} placeholder="Six-digit code" style={field}/></label><button disabled={busy || !password || code.length!==6} onClick={generateRecoveryCodes} style={{...button, marginTop: 12}}>Generate new recovery codes</button>{recoveryCodes.length>0 && <div style={{ marginTop: 14 }}><strong>Save these now. They will not be shown again.</strong><pre style={{ whiteSpace: "pre-wrap", background: "#f3f5f8", padding: 14, borderRadius: 8 }}>{recoveryCodes.join("\n")}</pre></div>}</section>
    {message && <p role="status" style={{ marginTop: 16 }}>{message}</p>}
  </main>;
}
const card = { border: "1px solid #e2e7ef", borderRadius: 14, padding: 20, marginTop: 18, background: "white" };
const field = { minWidth: 0, flex: 1, padding: "12px 14px", border: "1px solid #d8deea", borderRadius: 9, fontSize: 15 };
const button = { padding: "12px 16px", border: 0, borderRadius: 9, background: "#24458b", color: "white", fontWeight: 700, cursor: "pointer" };
