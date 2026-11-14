import { requireStaff } from "@/lib/server-auth";
import SyncJobsButton from "./sync-jobs-button";
export default async function AdminPage() {
 const staff = await requireStaff();
 return <main style={{ maxWidth: 960, margin: "0 auto", padding: "64px 24px" }}>
  <p style={{ color: "#3657a7", fontWeight: 700 }}>STAFF ADMINISTRATION</p><h1 style={{ fontSize: 36 }}>Administration</h1>
  <p style={{ color: "#596579", lineHeight: 1.7 }}>Signed in as authorised staff: {staff.email}. Only staff accounts can access this area.</p>
  <section style={{ marginTop: 24, border: "1px solid #e5e9f0", borderRadius: 14, padding: 20, background: "white" }}>
   <h2 style={{ fontSize: 20 }}>Global job-source management</h2>
   <p style={{ color: "#596579", lineHeight: 1.6 }}>Synchronise configured Greenhouse, Lever, Ashby and optional Jooble sources. Each source is processed independently; configure approved board identifiers in the server environment.</p>
   <SyncJobsButton />
  </section>
  <a href="/dashboard" style={{ display: "inline-block", marginTop: 24, color: "#3657a7" }}>Return to dashboard</a>
 </main>;
}