import type { JobSourceAdapter } from "@/lib/jobs/sources/adapter";
import type { BoardRunResult } from "@/lib/jobs/sources/board-utils";
import { employerName, explicitRemoteEligibility, fetchBoardJson } from "@/lib/jobs/sources/board-utils";
interface GreenhouseJob { id: number; title?: string; updated_at?: string; absolute_url?: string; content?: string; location?: { name?: string; }; departments?: Array<{ name?: string }>; }
interface GreenhouseBoard { name?: string; }
export class GreenhouseAdapter implements JobSourceAdapter {
 readonly source = "greenhouse";
 lastRunReport: BoardRunResult[] = [];
 constructor(private readonly boards: string[]) {}
 async fetchRecentJobs({ since }: { since: Date }) {
  const results: unknown[] = [];
  this.lastRunReport = [];
  for (const board of this.boards) {
   try {
    const [metadata, data] = await Promise.all([
      fetchBoardJson<GreenhouseBoard>("https://boards-api.greenhouse.io/v1/boards/" + encodeURIComponent(board)),
      fetchBoardJson<{ jobs?: GreenhouseJob[] }>("https://boards-api.greenhouse.io/v1/boards/" + encodeURIComponent(board) + "/jobs?content=true")
    ]);
    const company = employerName(this.source, board, metadata.name);
    if (!company) throw new Error("EMPLOYER_NAME_UNVERIFIED: configure JOB_BOARD_EMPLOYER_NAMES");
    for (const job of data.jobs ?? []) {
     const published = job.updated_at ? new Date(job.updated_at) : null;
     if (published && !Number.isNaN(published.getTime()) && published < since) continue;
     const location = job.location?.name?.trim() || "Location not specified";
     const remote = /\bremote\b|\bdistributed\b|\bwork from home\b/i.test(location);
     const hybrid = /\bhybrid\b/i.test(location);
     results.push({ sourceJobId: board + ":" + job.id, title: job.title ?? "Untitled role", company,
      jobCategory: job.departments?.map(x => x.name).filter(Boolean).join(", ") ?? null,
      description: job.content?.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() ?? null,
      applicationUrl: job.absolute_url ?? null, sourceUrl: job.absolute_url ?? null, locationText: location,
      workMode: remote ? "REMOTE" : hybrid ? "HYBRID" : "ONSITE",
      // Greenhouse public board data does not provide eligible countries; never infer them from "Remote".
      eligibleLocations: explicitRemoteEligibility((job as GreenhouseJob & { eligibleLocations?: unknown }).eligibleLocations),
      publishedAt: published && !Number.isNaN(published.getTime()) ? published.toISOString() : null, status: "ACTIVE" });
    }
    this.lastRunReport.push({ target: board, status: "succeeded" });
   } catch (error) {
    this.lastRunReport.push({ target: board, status: "failed", error: error instanceof Error ? error.message : "UNKNOWN_ERROR" });
   }
  }
  return results;
 }
}
