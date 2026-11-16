"use client";

import { useState } from "react";
import { credentialsSignIn, googleSignIn } from "./actions";

export default function SignInForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [method, setMethod] = useState("TOTP");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function sendCode() {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/auth/send-2fa-code", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
      const data = await response.json(); setMessage(data.message || "Request completed.");
    } catch { setMessage("Unable to reach the server."); }
    finally { setBusy(false); }
  }
  return <>
    <form action={credentialsSignIn} style={{ display: "grid", gap: 14, marginTop: 28 }}>
      <label style={{ display: "grid", gap: 6 }}>Email address<input name="email" type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)} style={field}/></label>
      <label style={{ display: "grid", gap: 6 }}>Password<input name="password" type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)} style={field}/></label>
      <label style={{ display: "grid", gap: 6 }}>Second-factor method<select name="secondFactorMethod" value={method} onChange={e=>setMethod(e.target.value)} style={field}><option value="TOTP">Authenticator app</option><option value="EMAIL">Email code</option></select></label>
      <label style={{ display: "grid", gap: 6 }}>Authenticator code or one-time recovery code<input name="secondFactorCode" autoComplete="one-time-code" inputMode="text" maxLength={16} style={field} placeholder="6-digit code or 16-character recovery code"/></label>
      {method === "EMAIL" && <button type="button" disabled={busy || !email || !password} onClick={sendCode} style={secondary}>{busy ? "Sending…" : "Send email sign-in code"}</button>}
      <button type="submit" style={primary}>Sign in securely</button>
    </form>
    <form action={googleSignIn} style={{ marginTop: 12 }}><button type="submit" style={secondary}>Continue with Google</button></form>
    {message && <p role="status" style={{ lineHeight: 1.6 }}>{message}</p>}
  </>;
}
const field={width:"100%",padding:"12px 14px",border:"1px solid #d8deea",borderRadius:9,fontSize:15};
const primary={width:"100%",padding:"13px 16px",border:0,borderRadius:9,background:"#24458b",color:"white",fontWeight:700,fontSize:15,cursor:"pointer"};
const secondary={width:"100%",padding:"13px 16px",border:"1px solid #d8deea",borderRadius:9,background:"white",color:"#172033",fontWeight:700,fontSize:15,cursor:"pointer"};
