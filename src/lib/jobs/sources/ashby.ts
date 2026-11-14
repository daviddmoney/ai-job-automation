import type { JobSourceAdapter } from "@/lib/jobs/sources/adapter";
interface AshbyPosting { id: string; title?: string; location?: string; isRemote?: boolean; workplaceType?: string; employmentType?: string; departmentName?: string; descriptionPlain?: string; jobUrl?: string; applyUrl?: string; publishedAt?: string; }
export class AshbyAdapter implements JobSourceAdapter {
 readonly source = "ashby";
 constructor(private readonly boards: string[]) {}
 async fetchRecentJobs({ since }: { since: Date }) {
  const results: unknown[] = [];
  for (const board of this.boards) {
   const response = await fetch("https://api.ashbyhq.com/posting-api/job-board/" + encodeURIComponent(board), { cache: "no-store", signal: AbortSignal.timeout(15000) });
   if (!response.ok) throw new Error("Ashby source unavailable");
   const data = await response.json() as { jobs?: AshbyPosting[] };
   for (const job of data.jobs ?? []) {
    const published = job.publishedAt ? new Date(job.publishedAt) : null;
    if (published && published < since) continue;
    const location = job.location?.trim() || "Location not specified";
    const mode = (job.workplaceType ?? "").toLowerCase();
    const remote = job.isRemote === true || mode === "remote";
    const hybrid = mode === "hybrid";
    results.push({ sourceJobId: board + ":" + job.id, title: job.title ?? "Untitled role", company: board,
     jobCategory: job.departmentName ?? null, description: job.descriptionPlain ?? null,
     applicationUrl: job.applyUrl ?? job.jobUrl ?? null, sourceUrl: job.jobUrl ?? null,
     locationText: location, workMode: remote ? "REMOTE" : hybrid ? "HYBRID" : "ONSITE",
     eligibleLocations: remote ? [location] : [], employmentType: job.employmentType ?? null,
     publishedAt: published?.toISOString() ?? null, status: "ACTIVE" });
   }
  }
  return results;
 }
}