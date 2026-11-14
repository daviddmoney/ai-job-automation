"use client";

import { useState } from "react";

export default function AddToApplicationsButton({ jobId }: { jobId: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function add() {
    setBusy(true); setMessage("");
    try { const response = await fetch("/api/applications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jobPostingId: jobId }) }); const data = await response.json(); setMessage(data.message ?? "Request completed."); }
    catch { setMessage("Unable to reach the server."); }
    finally { setBusy(false); }
  }
  return <div><button type="button" onClick={add} disabled={busy} style={{ marginLeft: 8, border: 0, borderRadius: 8, padding: "9px 13px", background: "#24458b", color: "white", fontWeight: 700, cursor: "pointer" }}>{busy ? "Adding…" : "Track application"}</button>{message && <span role="status" style={{ display: "block", fontSize: 12, color: "#596579", marginTop: 6 }}>{message}</span>}</div>;
}
