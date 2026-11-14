import type { JobSourceAdapter } from "@/lib/jobs/sources/adapter";
interface JoobleJob { id?: string | number; title?: string; location?: string; snippet?: string; salary?: string; type?: string; link?: string; company?: string; updated?: string; }
interface JoobleResponse { jobs?: JoobleJob[]; }
const SEARCH_TERMS = ["accountant", "accounting", "audit", "finance", "graduate trainee"];
export class JoobleNigeriaAdapter implements JobSourceAdapter {
 readonly source = "jooble-ng";
 async fetchRecentJobs({ since }: { since: Date }): Promise<unknown[]> {
  const key = process.env.JOOBLE_NG_API_KEY;
  if (!key) return [];
  const endpoint = "https://ng.jooble.org/api/" + encodeURIComponent(key);
  const collected: unknown[] = [];
  for (const keywords of SEARCH_TERMS) {
   const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ keywords, location: "Nigeria", page: "1", ResultOnPage: "50" }), cache: "no-store", signal: AbortSignal.timeout(15000) });
   if (!response.ok) throw new Error("Jooble request failed: " + response.status);
   const data = await response.json() as JoobleResponse;
   for (const job of data.jobs ?? []) {
    const updated = job.updated && !Number.isNaN(Date.parse(job.updated)) ? new Date(job.updated) : null;
    if (updated && updated < since) continue;
    const location = (job.location ?? "Location not specified").trim();
    const lower = location.toLowerCase();
    const remote = /remote|worldwide|anywhere/.test(lower);
    const hybrid = /hybrid/.test(lower);
    collected.push({ sourceJobId: String(job.id ?? job.link ?? (job.title ?? "job") + ":" + location),
     title: job.title ?? "Untitled role", company: job.company ?? "Undisclosed employer", salaryText: job.salary ?? null,
     employmentType: job.type ?? null, description: job.snippet ?? null, applicationUrl: job.link ?? null, sourceUrl: job.link ?? null,
     locationText: location, workMode: remote ? "REMOTE" : hybrid ? "HYBRID" : "ONSITE",
     eligibleLocations: remote ? [location] : [], country: /nigeria/i.test(location) ? "Nigeria" : null,
     publishedAt: updated?.toISOString() ?? null, status: "ACTIVE" });
   }
  }
  return collected;
 }
}