import type { JobSourceAdapter } from "@/lib/jobs/sources/adapter";
import type { BoardRunResult } from "@/lib/jobs/sources/board-utils";
import { employerName, explicitRemoteEligibility, fetchBoardJson } from "@/lib/jobs/sources/board-utils";
interface AshbyPosting { id: string; title?: string; location?: string; isRemote?: boolean; workplaceType?: string; employmentType?: string; departmentName?: string; descriptionPlain?: string; jobUrl?: string; applyUrl?: string; publishedAt?: string; eligibleCountries?: string[]; eligibleLocations?: string[]; organizationName?: string; }
export class AshbyAdapter implements JobSourceAdapter {
 readonly source = "ashby";
 lastRunReport: BoardRunResult[] = [];
 constructor(private readonly boards: string[]) {}
 async fetchRecentJobs({ since }: { since: Date }) {
  const results: unknown[] = [];
  this.lastRunReport = [];
  for (const board of this.boards) {
   try {
    const data = await fetchBoardJson<{ jobs?: AshbyPosting[]; organizationName?: string; companyName?: string }>("https://api.ashbyhq.com/posting-api/job-board/" + encodeURIComponent(board));
    const metadataName = data.organizationName ?? data.companyName ?? data.jobs?.find(x => x.organizationName)?.organizationName;
    const company = employerName(this.source, board, metadataName);
    if (!company) throw new Error("EMPLOYER_NAME_UNVERIFIED: configure JOB_BOARD_EMPLOYER_NAMES");
    for (const job of data.jobs ?? []) {
     const published = job.publishedAt ? new Date(job.publishedAt) : null;
     if (published && !Number.isNaN(published.getTime()) && published < since) continue;
     const location = job.location?.trim() || "Location not specified";
     const mode = (job.workplaceType ?? "").toLowerCase();
     const remote = job.isRemote === true || mode === "remote";
     const hybrid = mode === "hybrid";
     results.push({ sourceJobId: board + ":" + job.id, title: job.title ?? "Untitled role", company,
      jobCategory: job.departmentName ?? null, description: job.descriptionPlain ?? null,
      applicationUrl: job.applyUrl ?? job.jobUrl ?? null, sourceUrl: job.jobUrl ?? null,
      locationText: location, workMode: remote ? "REMOTE" : hybrid ? "HYBRID" : "ONSITE",
      eligibleLocations: remote ? explicitRemoteEligibility(job.eligibleCountries?.length ? job.eligibleCountries : job.eligibleLocations) : [],
      employmentType: job.employmentType ?? null, publishedAt: published && !Number.isNaN(published.getTime()) ? published.toISOString() : null, status: "ACTIVE" });
    }
    this.lastRunReport.push({ target: board, status: "succeeded" });
   } catch (error) {
    this.lastRunReport.push({ target: board, status: "failed", error: error instanceof Error ? error.message : "UNKNOWN_ERROR" });
   }
  }
  return results;
 }
}
