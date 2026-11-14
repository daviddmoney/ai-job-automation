import type { JobSourceAdapter } from "@/lib/jobs/sources/adapter";

interface JoobleJob {
  id?: string | number; title?: string; location?: string; snippet?: string; salary?: string;
  type?: string; link?: string; company?: string; updated?: string;
}
interface JoobleResponse { jobs?: JoobleJob[]; }
const SEARCH_TERMS = ["accounting", "audit", "finance", "graduate trainee", "software engineer", "customer service"];
const REQUEST_TIMEOUT_MS = 8000;
const MAX_ATTEMPTS = 3;

async function fetchJooble(endpoint: string, keywords: string): Promise<JoobleResponse> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ keywords, location: "Nigeria", page: "1", ResultOnPage: "50" }),
        cache: "no-store",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
      });
      if (response.ok) return await response.json() as JoobleResponse;
      if (attempt === MAX_ATTEMPTS || (response.status < 500 && response.status !== 429)) throw new Error("Jooble request failed: " + response.status);
      const retryAfter = Number(response.headers.get("retry-after"));
      const delay = Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter * 1000, 2000) : 250 * 2 ** (attempt - 1);
      await new Promise(resolve => setTimeout(resolve, delay));
    } catch (error) {
      if (attempt === MAX_ATTEMPTS) throw error;
      const transient = error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name);
      if (!transient) throw error;
      await new Promise(resolve => setTimeout(resolve, 250 * 2 ** (attempt - 1)));
    }
  }
  throw new Error("Jooble request exhausted retries.");
}

export class JoobleNigeriaAdapter implements JobSourceAdapter {
  readonly source = "jooble-ng";
  async fetchRecentJobs({ since }: { since: Date }): Promise<unknown[]> {
    const key = process.env.JOOBLE_NG_API_KEY;
    if (!key) return [];
    const endpoint = "https://ng.jooble.org/api/" + encodeURIComponent(key);
    const responses = await Promise.allSettled(SEARCH_TERMS.map(term => fetchJooble(endpoint, term)));
    const successful = responses.filter((result): result is PromiseFulfilledResult<JoobleResponse> => result.status === "fulfilled");
    if (!successful.length) throw new Error("All Jooble keyword searches failed.");
    const unique = new Map<string, JoobleJob>();
    for (const result of successful) for (const job of result.value.jobs ?? []) {
      const id = String(job.id ?? job.link ?? (job.title ?? "job") + ":" + (job.location ?? ""));
      if (!unique.has(id)) unique.set(id, job);
    }
    const collected: unknown[] = [];
    for (const job of unique.values()) {
      const title = (job.title ?? "").trim();
      const location = (job.location ?? "Location not specified").trim();
      const lower = (location + " " + (job.type ?? "")).toLowerCase();
      const remote = /\bremote\b|\bworldwide\b|\banywhere\b/.test(lower);
      const hybrid = /\bhybrid\b/.test(lower);
      const updated = job.updated && !Number.isNaN(Date.parse(job.updated)) ? new Date(job.updated) : null;
      if (updated && updated < since) continue;
      collected.push({
        sourceJobId: String(job.id ?? job.link ?? title + ":" + location),
        title: title || "Untitled role",
        company: (job.company ?? "Undisclosed employer").trim(),
        salaryText: job.salary ?? null,
        employmentType: job.type ?? null,
        description: job.snippet ?? null,
        applicationUrl: job.link ?? null,
        sourceUrl: job.link ?? null,
        locationText: /nigeria/i.test(location) ? location : location + ", Nigeria",
        country: "Nigeria",
        workMode: remote ? "REMOTE" : hybrid ? "HYBRID" : "ONSITE",
        // Jooble does not expose verified remote-eligible countries in this response.
        eligibleLocations: [],
        publishedAt: updated?.toISOString() ?? null,
        status: "ACTIVE"
      });
    }
    return collected;
  }
}