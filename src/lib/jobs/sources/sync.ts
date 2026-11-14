import { ingestJob } from "@/lib/jobs/ingest";
import type { JobSourceAdapter } from "@/lib/jobs/sources/adapter";

export async function syncJobSources(adapters: JobSourceAdapter[], since: Date) {
  const totals = { created: 0, updated: 0, excludedLocation: 0, invalid: 0, sourceErrors: 0 };
  for (const adapter of adapters) {
    let records: unknown[];
    try { records = await adapter.fetchRecentJobs({ since, location: "Lagos, Nigeria" }); }
    catch { totals.sourceErrors++; continue; }
    for (const record of records) {
      const result = await ingestJob({ ...(typeof record === "object" && record !== null ? record : {}), source: adapter.source });
      if (result.outcome === "created") totals.created++;
      else if (result.outcome === "updated") totals.updated++;
      else if (result.outcome === "excluded_location") totals.excludedLocation++;
      else totals.invalid++;
    }
  }
  return totals;
}
