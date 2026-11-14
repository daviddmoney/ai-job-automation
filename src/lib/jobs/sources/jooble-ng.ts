import type { JobSourceAdapter } from "@/lib/jobs/sources/adapter";

interface JoobleJob {
  id?: string | number;
  title?: string;
  location?: string;
  snippet?: string;
  salary?: string;
  source?: string;
  type?: string;
  link?: string;
  company?: string;
  updated?: string;
}
interface JoobleResponse { jobs?: JoobleJob[]; totalCount?: number; }

const SEARCH_TERMS = ["accountant", "accounting", "audit", "finance", "accounts assistant"];

export class JoobleNigeriaAdapter implements JobSourceAdapter {
  readonly source = "jooble-ng";

  async fetchRecentJobs(options: { since: Date; location: "Lagos, Nigeria" }): Promise<unknown[]> {
    const key = process.env.JOOBLE_NG_API_KEY;
    if (!key) return [];
    const endpoint = `https://ng.jooble.org/api/${encodeURIComponent(key)}`;
    const collected: unknown[] = [];

    for (const keywords of SEARCH_TERMS) {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ keywords, location: "Lagos", radius: "0", page: "1", ResultOnPage: "50", companysearch: false }),
        cache: "no-store",
        signal: AbortSignal.timeout(15000)
      });
      if (!response.ok) throw new Error(`Jooble request failed: ${response.status}`);
      const data = await response.json() as JoobleResponse;
      for (const job of data.jobs ?? []) {
        const location = (job.location ?? "").trim();
        const title = (job.title ?? "").trim();
        const details = `${location} ${title}`.toLowerCase();
        const hasLagos = details.includes("lagos");
        const workMode = details.includes("remote") ? "REMOTE" : details.includes("hybrid") ? "HYBRID" : "ONSITE";
        const date = job.updated && !Number.isNaN(Date.parse(job.updated)) ? new Date(job.updated).toISOString() : null;
        if (date && new Date(date) < options.since) continue;
        collected.push({
          source: this.source,
          sourceJobId: String(job.id ?? job.link ?? `${title}:${location}`),
          title,
          company: (job.company ?? "Undisclosed employer").trim(),
          salaryText: job.salary ?? null,
          employmentType: job.type ?? null,
          description: job.snippet ?? null,
          applicationUrl: job.link ?? null,
          sourceUrl: job.link ?? null,
          locationText: location.toLowerCase().includes("nigeria") ? location : `${location}, Nigeria`,
          city: hasLagos ? "Lagos" : null,
          state: hasLagos ? "Lagos" : null,
          country: "Nigeria",
          workMode,
          eligibleLocations: workMode === "REMOTE" && hasLagos ? ["Lagos, Nigeria"] : [],
          publishedAt: date,
          status: "ACTIVE"
        });
      }
    }
    return collected;
  }
}
