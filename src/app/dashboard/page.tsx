import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");
  return <main style={{ maxWidth: 960, margin: "0 auto", padding: "64px 24px" }}>
    <p style={{ color: "#3657a7", fontWeight: 700 }}>PRIVATE DASHBOARD</p>
    <h1 style={{ fontSize: 36 }}>Welcome{session.user.name ? `, ${session.user.name}` : ""}</h1>
    <p style={{ color: "#596579", lineHeight: 1.7 }}>You are signed in. Your job profile and application workspace will appear here as those modules are implemented.</p>
    <p style={{ color: "#788397", fontSize: 13 }}>Account role: {session.user.role}</p>
    <p><a href="/security/2fa" style={{ color: "#3657a7" }}>Configure two-factor authentication</a></p>
    <a href="/" style={{ color: "#3657a7" }}>Return to home</a>
  </main>;
}
