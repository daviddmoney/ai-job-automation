import type { JobSourceAdapter } from "@/lib/jobs/sources/adapter";
interface LeverPosting { id: string; text?: string; createdAt?: number; hostedUrl?: string; applyUrl?: string; descriptionPlain?: string; categories?: { location?: string; commitment?: string; team?: string; allLocations?: string[] }; workplaceType?: string; }
export class LeverAdapter implements JobSourceAdapter {
 readonly source = "lever";
 constructor(private readonly sites: string[]) {}
 async fetchRecentJobs({ since }: { since: Date }) {
  const results: unknown[] = [];
  for (const site of this.sites) {
   const response = await fetch("https://api.lever.co/v0/postings/" + encodeURIComponent(site) + "?mode=json", { cache: "no-store", signal: AbortSignal.timeout(15000) });
   if (!response.ok) throw new Error("Lever source unavailable");
   const postings = await response.json() as LeverPosting[];
   for (const job of postings) {
    const published = job.createdAt ? new Date(job.createdAt) : null;
    if (published && published < since) continue;
    const location = job.categories?.location?.trim() || "Location not specified";
    const mode = (job.workplaceType ?? "").toLowerCase();
    const remote = mode === "remote" || /remote/.test(location.toLowerCase());
    const hybrid = mode === "hybrid" || /hybrid/.test(location.toLowerCase());
    results.push({ sourceJobId: site + ":" + job.id, title: job.text ?? "Untitled role", company: site,
     description: job.descriptionPlain ?? null, applicationUrl: job.applyUrl ?? job.hostedUrl ?? null, sourceUrl: job.hostedUrl ?? null,
     locationText: location, workMode: remote ? "REMOTE" : hybrid ? "HYBRID" : "ONSITE",
     eligibleLocations: remote ? (job.categories?.allLocations?.length ? job.categories.allLocations : [location]) : [],
     employmentType: job.categories?.commitment ?? null, publishedAt: published?.toISOString() ?? null, status: "ACTIVE" });
   }
  }
  return results;
 }
}