import { requireUser } from "@/lib/server-auth";
import JobPreferencesForm from "./preferences-form";
export default async function JobPreferencesPage() {
 await requireUser();
 return <main style={{ maxWidth: 900, margin: "0 auto", padding: "48px 24px" }}>
  <a href="/dashboard" style={{ color: "#3657a7" }}>← Dashboard</a>
  <h1 style={{ fontSize: 34 }}>Job and language preferences</h1>
  <p style={{ color: "#596579", lineHeight: 1.7 }}>Choose where you want to work and which languages you prefer. These settings are private to your account and can be changed at any time.</p>
  <JobPreferencesForm />
 </main>;
}