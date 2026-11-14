"use client";

import { useState } from "react";
const statuses = ["SAVED", "PREPARING", "READY_FOR_REVIEW", "SUBMITTED", "INTERVIEW", "REJECTED", "OFFER", "WITHDRAWN"];

export default function ApplicationStatusEditor({ applicationId, initialStatus, initialNotes }: { applicationId: string; initialStatus: string; initialNotes: string }) {
  const [status, setStatus] = useState(initialStatus);
  const [notes, setNotes] = useState(initialNotes);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true); setMessage("");
    try { const response = await fetch("/api/applications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ applicationId, status, notes }) }); const data = await response.json(); setMessage(data.message ?? "Request completed."); }
    catch { setMessage("Unable to reach the server."); }
    finally { setBusy(false); }
  }
  return <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 10, marginTop: 14 }}>
    <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 700 }}>Application status<select value={status} onChange={e=>setStatus(e.target.value)} style={field}>{statuses.map(value=><option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select></label>
    <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 700 }}>Private notes<textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={3} maxLength={5000} style={field}/></label>
    <button type="button" disabled={busy} onClick={save} style={button}>{busy ? "Saving…" : "Save changes"}</button>
    {message && <span role="status" style={{ fontSize: 12, color: "#596579" }}>{message}</span>}
  </div>;
}
const field = { width: "100%", padding: "10px 12px", border: "1px solid #d8deea", borderRadius: 8, fontSize: 14 };
const button = { justifySelf: "start", border: 0, borderRadius: 8, padding: "10px 14px", background: "#24458b", color: "white", fontWeight: 700, cursor: "pointer" };
