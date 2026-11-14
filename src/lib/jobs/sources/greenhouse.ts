import type { JobSourceAdapter } from "@/lib/jobs/sources/adapter";
interface GreenhouseJob { id: number; title?: string; updated_at?: string; absolute_url?: string; content?: string; location?: { name?: string }; departments?: Array<{ name?: string }>; }
export class GreenhouseAdapter implements JobSourceAdapter {
 readonly source = "greenhouse";
 constructor(private readonly boards: string[]) {}
 async fetchRecentJobs({ since }: { since: Date }) {
  const results: unknown[] = [];
  for (const board of this.boards) {
   const response = await fetch("https://boards-api.greenhouse.io/v1/boards/" + encodeURIComponent(board) + "/jobs?content=true", { cache: "no-store", signal: AbortSignal.timeout(15000) });
   if (!response.ok) throw new Error("Greenhouse source unavailable");
   const data = await response.json() as { jobs?: GreenhouseJob[] };
   for (const job of data.jobs ?? []) {
    const published = job.updated_at ? new Date(job.updated_at) : null;
    if (published && published < since) continue;
    const location = job.location?.name?.trim() || "Location not specified";
    const lower = location.toLowerCase();
    const remote = /remote|distributed|work from home/.test(lower);
    const hybrid = /hybrid/.test(lower);
    results.push({ sourceJobId: board + ":" + job.id, title: job.title ?? "Untitled role", company: board,
     jobCategory: job.departments?.map(x => x.name).filter(Boolean).join(", ") ?? null,
     description: job.content?.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() ?? null,
     applicationUrl: job.absolute_url ?? null, sourceUrl: job.absolute_url ?? null, locationText: location,
     workMode: remote ? "REMOTE" : hybrid ? "HYBRID" : "ONSITE", eligibleLocations: remote ? [location] : [],
     publishedAt: published?.toISOString() ?? null, status: "ACTIVE" });
   }
  }
  return results;
 }
}