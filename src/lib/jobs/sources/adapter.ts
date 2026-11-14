import type { BoardRunResult } from "@/lib/jobs/sources/board-utils";
/** Implement one adapter per approved provider. Credentials must remain server-side. */
export interface JobSourceAdapter {
 readonly source: string;
 /** Board-aware adapters report individual targets so failed boards can be retried independently. */
 lastRunReport?: BoardRunResult[];
 fetchRecentJobs(options: { since: Date }): Promise<unknown[]>;
}
