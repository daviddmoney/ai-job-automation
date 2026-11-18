"use client";

import { useEffect, useState } from "react";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setEmail(params.get("email") || "");
    setToken(params.get("token") || "");
  }, []);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/auth/password-reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, token, newPassword: password })
      });
      const data = await response.json();
      setMessage(data.message || "Unable to reset password.");
      if (response.ok) setPassword("");
    } catch { setMessage("Unable to reach the server. Try again later."); }
    finally { setBusy(false); }
  }
  return <main className="form-page">
    <a href="/signin" className="action-link">← Back to sign in</a>
    <h1 style={{ fontSize: 30 }}>Choose a new password</h1>
    <p style={{ color: "#596579", lineHeight: 1.6 }}>Use at least 12 characters, including uppercase, lowercase and a number. Reset links expire after 15 minutes and can be used once.</p>
    <form onSubmit={submit} style={{ display: "grid", gap: 14, marginTop: 24 }}>
      <label style={{ display: "grid", gap: 6 }}>New password<input type="password" required minLength={12} maxLength={256} autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} style={field}/></label>
      <button disabled={busy || !email || !token || password.length<12} style={button}>{busy ? "Updating…" : "Reset password"}</button>
    </form>
    {message && <p role="status">{message}</p>}
  </main>;
}
const field={width:"100%",padding:"12px 14px",border:"1px solid #d8deea",borderRadius:9,fontSize:15};
const button={width:"100%",padding:"13px 16px",border:0,borderRadius:9,background:"#24458b",color:"white",fontWeight:700,cursor:"pointer"};
