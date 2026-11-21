"use client";

import { useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/auth/password-reset/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      const data = await response.json();
      setMessage(data.message || "If the account is eligible, a reset link will be sent.");
    } catch { setMessage("Unable to reach the server. Try again later."); }
    finally { setBusy(false); }
  }
  return <main className="form-page">
    <a href="/signin" className="action-link">← Back to sign in</a>
    <h1 style={{ fontSize: 30 }}>Reset your password</h1>
    <p style={{ color: "#596579", lineHeight: 1.6 }}>Enter your verified account email. If an account matches, we will send a one-time reset link.</p>
    <form onSubmit={submit} style={{ display: "grid", gap: 14, marginTop: 24 }}>
      <label style={{ display: "grid", gap: 6 }}>Email address<input type="email" required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)} style={field}/></label>
      <button disabled={busy || !email} style={button}>{busy ? "Sending…" : "Send reset link"}</button>
    </form>
    {message && <p role="status">{message}</p>}
  </main>;
}
const field={width:"100%",padding:"12px 14px",border:"1px solid #d8deea",borderRadius:9,fontSize:15};
const button={width:"100%",padding:"13px 16px",border:0,borderRadius:9,background:"#24458b",color:"white",fontWeight:700,cursor:"pointer"};
