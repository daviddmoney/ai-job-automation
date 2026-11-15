import { requireUser } from "@/lib/server-auth";

export default async function DashboardPage() {
  const user = await requireUser();
  return <main style={{ maxWidth: 960, margin: "0 auto", padding: "64px 24px" }}>
    <p style={{ color: "#3657a7", fontWeight: 700 }}>PRIVATE DASHBOARD</p>
    <h1 style={{ fontSize: 36 }}>Welcome</h1>
    <p style={{ color: "#596579", lineHeight: 1.7 }}>You are signed in to your private job-search workspace.</p>
    <p style={{ color: "#788397", fontSize: 13 }}>Account role: {user.role}</p>
    <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, marginTop: 28 }}>
      <a href="/jobs" style={tile}><h2>Lagos job search</h2><p>Browse recent opportunities located in Lagos.</p></a>
      <a href="/saved-jobs" style={tile}><h2>Saved jobs</h2><p>View opportunities saved privately to your account.</p></a>
      <a href="/applications" style={tile}><h2>Application tracker</h2><p>Track preparation, review, submission, and interview progress.</p></a>
      <a href="/settings/email" style={tile}><h2>Email and CV settings</h2><p>Connect Gmail and upload the CV automatically attached to drafts.</p></a>
      <a href="/security/2fa" style={tile}><h2>Account security</h2><p>Configure email or authenticator two-factor authentication.</p></a>
      {user.role === "STAFF" && <a href="/admin" style={tile}><h2>Staff administration</h2><p>Access staff-only tools.</p></a>}
    </section>
  </main>;
}
const tile = { display: "block", background: "white", border: "1px solid #e5e9f0", borderRadius: 14, padding: 20 };
