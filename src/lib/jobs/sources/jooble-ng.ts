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
const REQUEST_TIMEOUT_MS = 8_000;

export class JoobleNigeriaAdapter implements JobSourceAdapter {
  readonly source = "jooble-ng";

  async fetchRecentJobs(options: { since: Date; location: "Lagos, Nigeria" }): Promise<unknown[]> {
    const key = process.env.JOOBLE_NG_API_KEY;
    if (!key) return [];
    const endpoint = `https://ng.jooble.org/api/${encodeURIComponent(key)}`;

    // Independent keyword searches run concurrently instead of adding their
    // network latency together. A failed keyword search does not discard
    // successful results from the other searches.
    const responses = await Promise.allSettled(SEARCH_TERMS.map(async (keywords) => {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ keywords, location: "Lagos", radius: "0", page: "1", ResultOnPage: "50", companysearch: false }),
        cache: "no-store",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
      });
      if (!response.ok) throw new Error(`Jooble request failed: ${response.status}`);
      return await response.json() as JoobleResponse;
    }));

    const successful = responses.filter((result): result is PromiseFulfilledResult<JoobleResponse> => result.status === "fulfilled");
    if (successful.length === 0 && responses.length > 0) {
      throw new Error("All Jooble keyword searches failed.");
    }

    // The same vacancy can appear under multiple search terms.
    const uniqueJobs = new Map<string, JoobleJob>();
    for (const result of successful) {
      for (const job of result.value.jobs ?? []) {
        const id = String(job.id ?? job.link ?? `${job.title ?? ""}:${job.location ?? ""}`);
        if (!uniqueJobs.has(id)) uniqueJobs.set(id, job);
      }
    }

    const collected: unknown[] = [];
    for (const job of uniqueJobs.values()) {
      const location = (job.location ?? "").trim();
      const title = (job.title ?? "").trim();
      const locationLower = location.toLowerCase();
      const modeText = `${location} ${title} ${job.type ?? ""}`.toLowerCase();
      // Only the provider location field can establish Lagos eligibility.
      // A mention of Lagos in a description must not qualify another location.
      const hasLagos = /\\blagos\\b/.test(locationLower);
      if (!hasLagos) continue;
      const isRemote = /\\bremote\\b/.test(modeText);
      const isHybrid = /\\bhybrid\\b/.test(modeText);
      const workMode = isRemote ? "REMOTE" : isHybrid ? "HYBRID" : "ONSITE";
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
    return collected;
  }
}
