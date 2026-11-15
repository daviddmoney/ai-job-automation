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

  return <main className="page-shell">
    <a href="/dashboard" className="breadcrumb">← Back to your workspace</a>
    <header className="page-heading">
      <div><span className="eyebrow">GLOBAL OPPORTUNITY RADAR</span><h1>Find your next opportunity.</h1>
        <p>Explore roles matched to your selected countries, regions, cities, work modes and career interests. <a href="/settings/job-preferences">Adjust your preferences</a> whenever your goals change.</p>
      </div>
      <span className="pill">{jobs.length} matching opportunities</span>
    </header>
    {jobs.length === 0 ? <section className="empty-state"><h2>Your next opportunity is still out there.</h2><p>There are no matching jobs in the current feed. Try broadening your preferences or enabling worldwide search. New opportunities appear as configured sources are synchronised.</p><a className="button" href="/settings/job-preferences">Review job preferences</a></section> :
      <section className="job-list" aria-label="Matching job opportunities">
        {jobs.map(job => <article key={job.id} className="job-card">
          <div style={{display:"flex",flexWrap:"wrap",justifyContent:"space-between",gap:14}}>
            <div style={{minWidth:0,flex:1}}>
              <h2>{job.title}</h2>
              <div className="job-company">{job.company}</div>
              <div className="job-meta"><span>{job.locationText}</span><span>{job.workMode.toLowerCase()}</span>{job.employmentType && <span>{job.employmentType}</span>}{job.salaryText && <span>{job.salaryText}</span>}</div>
            </div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"flex-start"}}>
              <SaveJobButton jobId={job.id} initiallySaved={savedIds.has(job.id)}/>
              <AddToApplicationsButton jobId={job.id}/>
            </div>
          </div>
          {job.description && <><p className="job-description">{job.description.slice(0,700)}{job.description.length>700?"…":""}</p><TranslateJobButton text={job.description} sourceLanguage={job.sourceLanguage} targetLanguage={preferences?.jobDescriptionLanguage || "en"}/></>}
          <div className="job-meta" style={{marginTop:14}}><span>Source: {job.source}</span>{job.sourceLanguage && <span>Original language: {job.sourceLanguage}</span>}<span>{job.publishedAt ? "Published " + job.publishedAt.toLocaleDateString("en") : "Discovered " + job.discoveredAt.toLocaleDateString("en")}</span></div>
          {job.applicationUrl && <a href={job.applicationUrl} target="_blank" rel="noopener noreferrer" style={{fontSize:12,fontWeight:700}}>View original application page ↗</a>}
        </article>)}
      </section>}
  </main>;
}