import { ingestJob } from "@/lib/jobs/ingest";
import type { JobSourceAdapter } from "@/lib/jobs/sources/adapter";

async function mapWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>
) {
  let nextIndex = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const index = nextIndex++;
      if (index >= items.length) return;
      await worker(items[index]);
    }
  });
  await Promise.all(runners);
}

export async function syncJobSources(adapters: JobSourceAdapter[], since: Date) {
  const totals = { created: 0, updated: 0, excludedLocation: 0, invalid: 0, sourceErrors: 0 };

  // Fetch independent providers concurrently so one slow source does not
  // delay the start of every other source.
  const sourceResults = await Promise.allSettled(
    adapters.map(async (adapter) => ({
      adapter,
      records: await adapter.fetchRecentJobs({ since, location: "Lagos, Nigeria" })
    }))
  );

  const work: Array<{ adapter: JobSourceAdapter; record: unknown }> = [];
  for (const result of sourceResults) {
    if (result.status === "rejected") {
      totals.sourceErrors++;
      continue;
    }
    for (const record of result.value.records) work.push({ adapter: result.value.adapter, record });
  }

  // Bound database pressure while avoiding the old one-record-at-a-time
  // ingestion bottleneck. Each record remains independently validated.
  await mapWithConcurrency(work, 8, async ({ adapter, record }) => {
    try {
      const result = await ingestJob({
        ...(typeof record === "object" && record !== null ? record : {}),
        source: adapter.source
      });
      if (result.outcome === "created") totals.created++;
      else if (result.outcome === "updated") totals.updated++;
      else if (result.outcome === "excluded_location") totals.excludedLocation++;
      else totals.invalid++;
    } catch {
      totals.sourceErrors++;
    }
  });

  return totals;
}
