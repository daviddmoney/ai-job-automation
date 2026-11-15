"use client";
import { useState } from "react";
export default function TranslateJobButton({ text, sourceLanguage, targetLanguage }: { text: string; sourceLanguage?: string | null; targetLanguage: string }) {
 const [translated, setTranslated] = useState(""); const [provider, setProvider] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
 async function translate() {
  setBusy(true); setError("");
  try {
   const response = await fetch("/api/translate", { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, sourceLanguage: sourceLanguage || undefined, targetLanguage }) });
   const data = await response.json();
   if (!response.ok) throw new Error(data.message || "Translation failed.");
   setTranslated(data.result.translatedText); setProvider(data.result.provider);
  } catch (e) { setError(e instanceof Error ? e.message : "Translation failed."); }
  finally { setBusy(false); }
 }
 return <div style={{ marginTop: 10 }}>
  <button type="button" disabled={busy} onClick={translate} style={{ border: "1px solid #ccd3df", borderRadius: 7, padding: "7px 10px", background: "white", cursor: "pointer" }}>{busy ? "Translating…" : translated ? "Translate again" : "Translate description"}</button>
  {error && <p role="alert" style={{ color: "#a33", fontSize: 13 }}>{error}</p>}
  {translated && <section style={{ marginTop: 10, padding: 12, borderRadius: 8, background: "#f5f7fb", whiteSpace: "pre-wrap" }}>
   <strong>AI translation · {targetLanguage.toUpperCase()}</strong><p>{translated}</p>
   <small style={{ color: "#596579" }}>Provider: {provider}. Review this translation before relying on it or sending it to an employer.</small>
  </section>}
 </div>;
}