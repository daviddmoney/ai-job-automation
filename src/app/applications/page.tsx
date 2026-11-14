import { requireUser } from "@/lib/server-auth";
import { prisma } from "@/lib/prisma";
import ApplicationStatusEditor from "./status-editor";

export const dynamic = "force-dynamic";

export default async function ApplicationsPage() {
  const user = await requireUser();
  const applications = await prisma.application.findMany({ where: { userId: user.id }, include: { jobPosting: true }, orderBy: { updatedAt: "desc" }, take: 100 });
  return <main style={{ maxWidth: 1080, margin: "0 auto", padding: "48px 24px" }}>
    <a href="/dashboard" style={{ color: "#3657a7" }}>← Dashboard</a>
    <h1 style={{ fontSize: 36 }}>Application tracker</h1>
    <p style={{ color: "#596579", lineHeight: 1.6 }}>This is your private application history. Adding a job here does not submit an application or contact an employer.</p>
    {applications.length === 0 ? <p style={{ marginTop: 24, color: "#596579" }}>No applications tracked yet. <a href="/jobs" style={{ color: "#3657a7" }}>Browse Lagos jobs</a>.</p> : <section style={{ display: "grid", gap: 14, marginTop: 24 }}>
      {applications.map(item => <article key={item.id} style={card}>
        <h2 style={{ fontSize: 19, margin: "0 0 6px" }}>{item.jobTitle}</h2>
        <p style={{ margin: 0, fontWeight: 700 }}>{item.company}</p>
        <p style={{ color: "#596579", fontSize: 14 }}>{item.workLocation} · {item.workMode?.toLowerCase()}</p>
        <p style={{ color: "#788397", fontSize: 12 }}>Last updated: {item.updatedAt.toLocaleDateString("en-NG")}</p>
        <ApplicationStatusEditor applicationId={item.id} initialStatus={item.status} initialNotes={item.notes ?? ""}/>
        {item.jobUrl && <p><a href={item.jobUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#24458b", fontWeight: 700 }}>Open job application page ↗</a></p>}
      </article>)}
    </section>}
  </main>;
}
const card = { background: "white", border: "1px solid #e5e9f0", borderRadius: 14, padding: 20 };
