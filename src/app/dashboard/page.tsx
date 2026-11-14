import { requireUser } from "@/lib/server-auth";

export default async function DashboardPage() {
  const user = await requireUser();
  return <main style={{ maxWidth: 960, margin: "0 auto", padding: "64px 24px" }}>
    <p style={{ color: "#3657a7", fontWeight: 700 }}>PRIVATE DASHBOARD</p>
    <h1 style={{ fontSize: 36 }}>Welcome</h1>
    <p style={{ color: "#596579", lineHeight: 1.7 }}>You are signed in to your private job-search workspace.</p>
    <p style={{ color: "#788397", fontSize: 13 }}>Account role: {user.role}</p>
    <p><a href="/security/2fa" style={{ color: "#3657a7" }}>Configure two-factor authentication</a></p>
    <a href="/" style={{ color: "#3657a7" }}>Return to home</a>
  </main>;
}
