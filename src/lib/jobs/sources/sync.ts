import { ingestJob } from "@/lib/jobs/ingest";
import type { JobSourceAdapter } from "@/lib/jobs/sources/adapter";

async function mapWithConcurrency<T>(items: T[], concurrency: number, worker: (item: T) => Promise<void>) {
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

export async function syncJobSources(
  adapters: JobSourceAdapter[],
  since: Date,
  options: { beforeIngest?: () => Promise<void>; ingest?: typeof ingestJob } = {}
) {
  const totals = { created: 0, updated: 0, invalid: 0, sourceErrors: 0, sourcesChecked: 0, boardsSucceeded: 0, boardsFailed: 0 };
  const providerResults: Array<{ provider: string; status: "succeeded" | "partial" | "failed"; boards: NonNullable<JobSourceAdapter["lastRunReport"]> }> = [];
  const sourceResults = await Promise.allSettled(adapters.map(async adapter => {
    let lastError: unknown;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try { return { adapter, records: await adapter.fetchRecentJobs({ since }) }; }
      catch (error) {
        lastError = error;
        if (attempt < 3) await new Promise(resolve => setTimeout(resolve, 400 * 2 ** (attempt - 1)));
      }
    }
    throw lastError;
  }));
  const work: Array<{ adapter: JobSourceAdapter; record: unknown }> = [];
  for (let i = 0; i < sourceResults.length; i++) {
    const result = sourceResults[i];
    const adapter = adapters[i];
    if (result.status === "rejected") {
      totals.sourceErrors++;
      providerResults.push({ provider: adapter.source, status: "failed", boards: [{ target: adapter.source, status: "failed", error: result.reason instanceof Error ? result.reason.message : "PROVIDER_FAILED" }] });
      continue;
    }
    totals.sourcesChecked++;
    const boards = adapter.lastRunReport ?? [{ target: adapter.source, status: "succeeded" as const }];
    const failed = boards.filter(board => board.status === "failed").length;
    totals.boardsSucceeded += boards.length - failed;
    totals.boardsFailed += failed;
    if (failed) totals.sourceErrors += failed;
    providerResults.push({ provider: adapter.source, status: failed === 0 ? "succeeded" : "partial", boards });
    for (const record of result.value.records) work.push({ adapter, record });
  }
  await mapWithConcurrency(work, 8, async ({ adapter, record }) => {
    try {
      await options.beforeIngest?.();
      const result = await (options.ingest ?? ingestJob)({ ...(typeof record === "object" && record !== null ? record : {}), source: adapter.source });
      if (result.outcome === "created") totals.created++;
      else if (result.outcome === "updated") totals.updated++;
      else totals.invalid++;
    } catch {
      totals.sourceErrors++;
    }
  });
  return { ...totals, providers: providerResults, retryPolicy: "Only failed provider/board targets should be resubmitted; successful board results are retained." };
}
