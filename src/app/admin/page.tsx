import { requireStaff } from "@/lib/server-auth";
import SyncJobsButton from "./sync-jobs-button";
export default async function AdminPage() {
 const staff = await requireStaff();
 return <main className="page-shell">
  <span className="eyebrow">STAFF ADMINISTRATION</span><h1>Administration</h1>
  <p style={{ color: "#596579", lineHeight: 1.7 }}>Signed in as authorised staff: {staff.email}. Only staff accounts can access this area.</p>
  <section className="panel" style={{marginTop:24}}>
   <h2 style={{ fontSize: 20 }}>Global job-source management</h2>
   <p style={{ color: "#596579", lineHeight: 1.6 }}>Synchronise configured Greenhouse, Lever, Ashby and optional Jooble sources. Each source is processed independently; configure approved board identifiers in the server environment.</p>
   <SyncJobsButton />
  </section>
  <a href="/dashboard" className="breadcrumb">Return to dashboard</a>
 </main>;
}