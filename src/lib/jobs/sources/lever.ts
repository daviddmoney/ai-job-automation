import type { JobSourceAdapter } from "@/lib/jobs/sources/adapter";
import type { BoardRunResult } from "@/lib/jobs/sources/board-utils";
import { employerName, explicitRemoteEligibility, fetchBoardJson } from "@/lib/jobs/sources/board-utils";
interface LeverPosting { id: string; text?: string; createdAt?: number; hostedUrl?: string; applyUrl?: string; descriptionPlain?: string; categories?: { location?: string; commitment?: string; team?: string; allLocations?: string[] }; workplaceType?: string; }
export class LeverAdapter implements JobSourceAdapter {
 readonly source = "lever";
 lastRunReport: BoardRunResult[] = [];
 constructor(private readonly sites: string[]) {}
 async fetchRecentJobs({ since }: { since: Date }) {
  const results: unknown[] = [];
  this.lastRunReport = [];
  for (const site of this.sites) {
   try {
    const postings = await fetchBoardJson<LeverPosting[]>("https://api.lever.co/v0/postings/" + encodeURIComponent(site) + "?mode=json");
    const company = employerName(this.source, site);
    if (!company) throw new Error("EMPLOYER_NAME_UNVERIFIED: configure JOB_BOARD_EMPLOYER_NAMES");
    for (const job of postings) {
     const published = job.createdAt ? new Date(job.createdAt) : null;
     if (published && !Number.isNaN(published.getTime()) && published < since) continue;
     const location = job.categories?.location?.trim() || "Location not specified";
     const mode = (job.workplaceType ?? "").toLowerCase();
     const remote = mode === "remote" || /\bremote\b/i.test(location);
     const hybrid = mode === "hybrid" || /\bhybrid\b/i.test(location);
     results.push({ sourceJobId: site + ":" + job.id, title: job.text ?? "Untitled role", company,
      jobCategory: job.categories?.team ?? null, description: job.descriptionPlain ?? null,
      applicationUrl: job.applyUrl ?? job.hostedUrl ?? null, sourceUrl: job.hostedUrl ?? null,
      locationText: location, workMode: remote ? "REMOTE" : hybrid ? "HYBRID" : "ONSITE",
      // allLocations is provider-supplied eligibility; location text alone is not eligibility.
      eligibleLocations: remote ? explicitRemoteEligibility(job.categories?.allLocations) : [],
      employmentType: job.categories?.commitment ?? null, publishedAt: published?.toISOString() ?? null, status: "ACTIVE" });
    }
    this.lastRunReport.push({ target: site, status: "succeeded" });
   } catch (error) {
    this.lastRunReport.push({ target: site, status: "failed", error: error instanceof Error ? error.message : "UNKNOWN_ERROR" });
   }
  }
  return results;
 }
}
