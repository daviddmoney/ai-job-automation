import { requireUser } from "@/lib/server-auth";
import { prisma } from "@/lib/prisma";
import SaveJobButton from "@/app/jobs/save-job-button";

export const dynamic = "force-dynamic";

export default async function SavedJobsPage() {
  const user = await requireUser();
  const saved = await prisma.savedJob.findMany({
    where: { userId: user.id },
    include: { jobPosting: true },
    orderBy: { createdAt: "desc" },
    take: 100
  });
  return <main className="page-shell">
    <a href="/dashboard" className="breadcrumb">← Back to your workspace</a>
    <header className="page-heading"><div><span className="eyebrow">YOUR SHORTLIST</span><h1>Saved opportunities</h1></div></header>
    <p style={{ color: "#596579" }}>Only you can see the opportunities saved to your account.</p>
    {saved.length === 0 ? <p style={{ marginTop: 24, color: "#596579" }}>You have not saved any jobs yet. <a href="/jobs" style={{ color: "#3657a7" }}>Browse global opportunities</a>.</p> : <section className="job-list">
      {saved.map(item => <article key={item.id} className="job-card">
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div><h2 style={{ fontSize: 19, margin: "0 0 6px" }}>{item.jobPosting.title}</h2><p style={{ margin: 0, fontWeight: 700 }}>{item.jobPosting.company}</p><p style={{ color: "#596579", fontSize: 14 }}>{item.jobPosting.locationText} · {item.jobPosting.workMode.toLowerCase()}</p><p style={{ color: "#788397", fontSize: 12 }}>Status: {item.jobPosting.status.toLowerCase()}</p></div>
          <SaveJobButton jobId={item.jobPostingId} initiallySaved={true}/>
        </div>
        {item.jobPosting.applicationUrl && <a href={item.jobPosting.applicationUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#24458b", fontWeight: 700 }}>Open application page ↗</a>}
      </article>)}
    </section>}
  </main>;
}
const card = { background: "white", border: "1px solid #e5e9f0", borderRadius: 14, padding: 20 };
