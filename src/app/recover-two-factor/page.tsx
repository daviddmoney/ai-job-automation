"use client";

import { useState } from "react";

export default function RecoverTwoFactorPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  async function post(path: string, body: unknown) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json();
      setMessage(data.message || "Request completed.");
      if (response.ok && path.endsWith("/start")) setSent(true);
    } catch { setMessage("Unable to reach the server. Try again later."); }
    finally { setBusy(false); }
  }
  return <main className="form-page">
    <a href="/signin" className="action-link">← Back to sign in</a>
    <h1 style={{ fontSize: 30 }}>Recover authenticator access</h1>
    <p style={{ color: "#596579", lineHeight: 1.6 }}>If you lost your authenticator and recovery codes, enter your account email and password. A one-time code will be sent to your verified email. This recovery disables the lost TOTP method and revokes existing sessions.</p>
    <form onSubmit={e=>{e.preventDefault(); void post("/api/auth/recover-2fa/start",{email,password});}} style={{ display: "grid", gap: 14, marginTop: 24 }}>
      <label style={{ display: "grid", gap: 6 }}>Email address<input type="email" required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)} style={field}/></label>
      <label style={{ display: "grid", gap: 6 }}>Account password<input type="password" required maxLength={256} autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} style={field}/></label>
      <button disabled={busy || !email || !password} style={button}>Send recovery code</button>
    </form>
    {sent && <form onSubmit={e=>{e.preventDefault(); void post("/api/auth/recover-2fa/confirm",{email,password,code});}} style={{ display: "grid", gap: 14, marginTop: 24 }}>
      <label style={{ display: "grid", gap: 6 }}>Six-digit email recovery code<input inputMode="numeric" autoComplete="one-time-code" maxLength={6} required value={code} onChange={e=>setCode(e.target.value)} style={field}/></label>
      <button disabled={busy || code.length!==6} style={button}>Confirm recovery</button>
    </form>}
    {message && <p role="status">{message}</p>}
  </main>;
}
const field={width:"100%",padding:"12px 14px",border:"1px solid #d8deea",borderRadius:9,fontSize:15};
const button={width:"100%",padding:"13px 16px",border:0,borderRadius:9,background:"#24458b",color:"white",fontWeight:700,cursor:"pointer"};
