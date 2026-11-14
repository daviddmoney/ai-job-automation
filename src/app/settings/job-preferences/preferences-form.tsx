"use client";
import { useEffect, useState, type FormEvent } from "react";
type Preferences = {
 preferredCountries: string[]; preferredRegions: string[]; preferredCities: string[]; preferredWorkModes: string[];
 employmentTypes: string[]; jobCategories: string[]; interfaceLanguage: string; nativeLanguage: string | null;
 jobDescriptionLanguage: string; applicationLanguage: string; communicationLanguage: string; additionalLanguages: string[]; worldwideSearch: boolean;
};
const empty: Preferences = { preferredCountries: [], preferredRegions: [], preferredCities: [], preferredWorkModes: [], employmentTypes: [], jobCategories: [], interfaceLanguage: "en", nativeLanguage: "", jobDescriptionLanguage: "en", applicationLanguage: "en", communicationLanguage: "en", additionalLanguages: [], worldwideSearch: true };
const split = (value: string) => value.split(",").map(x => x.trim()).filter(Boolean);
const field = { display: "grid", gap: 6, marginBottom: 14 } as const;
const input = { width: "100%", padding: 10, border: "1px solid #ccd3df", borderRadius: 8 } as const;
export default function JobPreferencesForm() {
 const [data, setData] = useState<Preferences>(empty); const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [message, setMessage] = useState("");
 useEffect(() => { let active = true; fetch("/api/preferences/jobs").then(r => r.json()).then(result => { if (active && result.preferences) setData({ ...empty, ...result.preferences }); }).catch(() => { if (active) setMessage("Unable to load saved preferences."); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, []);
 function update<K extends keyof Preferences>(key: K, value: Preferences[K]) { setData(old => ({ ...old, [key]: value })); }
 async function save(event: FormEvent<HTMLFormElement>) {
  event.preventDefault(); setSaving(true); setMessage("");
  try { const payload = { ...data, nativeLanguage: data.nativeLanguage?.trim() || null }; const response = await fetch("/api/preferences/jobs", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }); const result = await response.json(); setMessage(response.ok ? "Preferences saved successfully." : result.message || "Unable to save preferences."); }
  catch { setMessage("Unable to reach the server."); } finally { setSaving(false); }
 }
 if (loading) return <p>Loading your preferences…</p>;
 return <form onSubmit={save} style={{ background: "white", border: "1px solid #e5e9f0", borderRadius: 14, padding: 22 }}>
  <label style={field}><strong>Preferred countries</strong><input style={input} value={data.preferredCountries.join(", ")} onChange={e => update("preferredCountries", split(e.target.value))} placeholder="Nigeria, United Kingdom, Canada"/></label>
  <label style={field}><strong>Preferred states / regions</strong><input style={input} value={data.preferredRegions.join(", ")} onChange={e => update("preferredRegions", split(e.target.value))} placeholder="Lagos, England, Ontario"/></label>
  <label style={field}><strong>Preferred cities</strong><input style={input} value={data.preferredCities.join(", ")} onChange={e => update("preferredCities", split(e.target.value))} placeholder="Lagos, London, Toronto"/></label>
  <fieldset style={{ border: 0, padding: 0, margin: "0 0 18px" }}><legend style={{ fontWeight: 700, marginBottom: 8 }}>Work arrangements</legend>
   {["ONSITE","HYBRID","REMOTE","FLEXIBLE"].map(mode => <label key={mode} style={{ display: "inline-flex", alignItems: "center", gap: 6, marginRight: 16, marginBottom: 8 }}><input type="checkbox" checked={data.preferredWorkModes.includes(mode)} onChange={e => update("preferredWorkModes", e.target.checked ? [...data.preferredWorkModes, mode] : data.preferredWorkModes.filter(x => x !== mode))}/>{mode.toLowerCase()}</label>)}
  </fieldset>
  <label style={field}><strong>Employment types</strong><input style={input} value={data.employmentTypes.join(", ")} onChange={e => update("employmentTypes", split(e.target.value))} placeholder="Full-time, Contract, Internship"/></label>
  <label style={field}><strong>Job categories</strong><input style={input} value={data.jobCategories.join(", ")} onChange={e => update("jobCategories", split(e.target.value))} placeholder="Accounting, Finance, Engineering"/></label>
  <label style={{ display: "flex", alignItems: "center", gap: 10, margin: "16px 0" }}><input type="checkbox" checked={data.worldwideSearch} onChange={e => update("worldwideSearch", e.target.checked)}/> Search worldwide, beyond my selected locations</label>
  <hr style={{ border: 0, borderTop: "1px solid #e5e9f0", margin: "20px 0" }}/>
  <h2 style={{ fontSize: 20 }}>Language preferences</h2>
  {([["interfaceLanguage","Website interface language"],["nativeLanguage","Native language"],["jobDescriptionLanguage","Preferred job-description language"],["applicationLanguage","Application language"],["communicationLanguage","Employer communication language"]] as const).map(([key,label]) => <label key={key} style={field}><strong>{label}</strong><input style={input} value={data[key] ?? ""} onChange={e => update(key, e.target.value as never)} placeholder="Language code, e.g. en, fr, de, es"/></label>)}
  <label style={field}><strong>Additional languages</strong><input style={input} value={data.additionalLanguages.join(", ")} onChange={e => update("additionalLanguages", split(e.target.value))} placeholder="fr, de, es, ar, yo"/></label>
  <button disabled={saving} type="submit" style={{ border: 0, borderRadius: 8, padding: "12px 18px", background: "#24458b", color: "white", fontWeight: 700 }}>{saving ? "Saving…" : "Save preferences"}</button>
  {message && <p role="status" style={{ color: "#3657a7" }}>{message}</p>}
 </form>;
}