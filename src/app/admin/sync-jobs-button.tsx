"use client";
import { useState } from "react";
export default function SyncJobsButton() {
 const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
 async function sync() {
  setBusy(true); setMessage("");
  try { const response = await fetch("/api/admin/jobs/sync", { method: "POST" }); const data = await response.json(); setMessage(data.message ?? "Sync completed."); }
  catch { setMessage("Unable to reach the server."); }
  finally { setBusy(false); }
 }
 return <div style={{ marginTop: 20 }}>
  <button type="button" disabled={busy} onClick={sync} style={{ border: 0, borderRadius: 8, padding: "12px 16px", background: "#24458b", color: "white", fontWeight: 700, cursor: "pointer" }}>{busy ? "Syncing sources…" : "Sync configured job sources"}</button>
  {message && <p role="status" style={{ color: "#596579", lineHeight: 1.6 }}>{message}</p>}
 </div>;
}