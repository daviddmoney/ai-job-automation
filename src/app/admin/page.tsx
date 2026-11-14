import { requireStaff } from "@/lib/server-auth";

export default async function AdminPage() {
  const staff = await requireStaff();
  return <main style={{ maxWidth: 960, margin: "0 auto", padding: "64px 24px" }}>
    <p style={{ color: "#3657a7", fontWeight: 700 }}>STAFF ADMINISTRATION</p>
    <h1 style={{ fontSize: 36 }}>Administration</h1>
    <p style={{ color: "#596579", lineHeight: 1.7 }}>Signed in as authorised staff: {staff.email}. Staff tools will be added here. All administrative actions must be logged and independently authorised server-side.</p>
    <a href="/dashboard" style={{ color: "#3657a7" }}>Return to dashboard</a>
  </main>;
}
