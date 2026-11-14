import { requireUser } from "@/lib/server-auth";
import { prisma } from "@/lib/prisma";
import { getRecentJobsForPreferences } from "@/lib/jobs/query";
import SaveJobButton from "./save-job-button";
import AddToApplicationsButton from "./add-to-applications-button";
import TranslateJobButton from "./translate-job-button";

export const dynamic = "force-dynamic";

export default async function JobsPage() {
  const user = await requireUser();
  const preferences = await prisma.userJobPreference.findUnique({ where: { userId: user.id } });
  const jobs = await getRecentJobsForPreferences({
    preferredCountries: preferences?.preferredCountries ?? [],
    preferredRegions: preferences?.preferredRegions ?? [],
    preferredCities: preferences?.preferredCities ?? [],
    preferredWorkModes: preferences?.preferredWorkModes ?? [],
    employmentTypes: preferences?.employmentTypes ?? [],
    jobCategories: preferences?.jobCategories ?? [],
    worldwideSearch: preferences?.worldwideSearch ?? true
  });

  // Fetch per-user state separately; never place it in the shared public-job cache.
  const saved = jobs.length ? await prisma.savedJob.findMany({
    where: { userId: user.id, jobPostingId: { in: jobs.map(job => job.id) } },
    select: { jobPostingId: true }
  }) : [];
  const savedIds = new Set(saved.map(item => item.jobPostingId));

  return <main style={{ maxWidth: 1080, margin: "0 auto", padding: "48px 24px" }}>
    <a href="/dashboard" style={{ color: "#3657a7" }}>← Dashboard</a>
    <h1 style={{ fontSize: 36, marginBottom: 8 }}>Global job opportunities</h1>
    <p style={{ color: "#596579", lineHeight: 1.6 }}>Browse active opportunities worldwide. <a href="/settings/job-preferences">Edit your location, work-mode and language preferences</a>. With worldwide search enabled or no location restrictions, global results are shown.</p>
    <p style={{ color: "#788397", fontSize: 13 }}>{jobs.length} matching opportunities · Maximum 100 results</p>
    {jobs.length === 0 ? <section style={empty}><h2>No matching jobs yet</h2><p>New opportunities appear as configured sources are synchronised. Try broadening your preferences or enabling worldwide search.</p></section> : <section style={{ display: "grid", gap: 16, marginTop: 24 }}>
      {jobs.map(job => <article key={job.id} style={card}>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 12 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h2 style={{ fontSize: 20, margin: "0 0 6px" }}>{job.title}</h2>
            <p style={{ margin: 0, fontWeight: 700 }}>{job.company}</p>
            <p style={{ color: "#596579", margin: "8px 0", fontSize: 14 }}>{job.locationText} · {job.workMode.toLowerCase()}{job.employmentType ? " · " + job.employmentType : ""}</p>
            {job.salaryText && <p style={{ margin: "6px 0", fontWeight: 700 }}>{job.salaryText}</p>}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <SaveJobButton jobId={job.id} initiallySaved={savedIds.has(job.id)}/>
            <AddToApplicationsButton jobId={job.id}/>
          </div>
        </div>
        {job.description && <>
          <p style={{ color: "#596579", lineHeight: 1.6, whiteSpace: "pre-wrap", margin: "12px 0" }}>{job.description.slice(0, 700)}{job.description.length > 700 ? "…" : ""}</p>
          <TranslateJobButton text={job.description} sourceLanguage={job.sourceLanguage} targetLanguage={preferences?.jobDescriptionLanguage || "en"}/>
        </>}
        <p style={{ color: "#788397", fontSize: 12 }}>Source: {job.source} · {job.sourceLanguage ? "Original language: " + job.sourceLanguage + " · " : ""}{job.publishedAt ? "Published " + job.publishedAt.toLocaleDateString("en") : "Discovered " + job.discoveredAt.toLocaleDateString("en")}</p>
        {job.applicationUrl && <a href={job.applicationUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#24458b", fontWeight: 700 }}>View application page ↗</a>}
      </article>)}
    </section>}
  </main>;
}

const card = { background: "white", border: "1px solid #e5e9f0", borderRadius: 14, padding: 20 };
const empty = { marginTop: 24, background: "white", border: "1px solid #e5e9f0", borderRadius: 14, padding: 24, color: "#596579" };