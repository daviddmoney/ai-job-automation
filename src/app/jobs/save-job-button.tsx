"use client";

import { useState } from "react";

export default function SaveJobButton({ jobId, initiallySaved = false }: { jobId: string; initiallySaved?: boolean }) {
  const [saved, setSaved] = useState(initiallySaved);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function toggle() {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/saved-jobs", { method: saved ? "DELETE" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jobPostingId: jobId }) });
      const data = await response.json();
      if (response.ok) setSaved(!saved);
      setMessage(data.message ?? "Request completed.");
    } catch { setMessage("Unable to reach the server."); }
    finally { setBusy(false); }
  }
  return <div><button type="button" disabled={busy} onClick={toggle} style={{ border: "1px solid #d7deea", borderRadius: 8, padding: "9px 13px", background: saved ? "#eef3ff" : "white", color: "#24458b", fontWeight: 700, cursor: "pointer" }}>{busy ? "Saving…" : saved ? "Saved ✓" : "Save job"}</button>{message && <span role="status" style={{ marginLeft: 8, fontSize: 12, color: "#596579" }}>{message}</span>}</div>;
}
