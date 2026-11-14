/** Implement one adapter per approved job provider. Keep provider credentials server-side. */
export interface JobSourceAdapter {
  readonly source: string;
  fetchRecentJobs(options: { since: Date; location: "Lagos, Nigeria" }): Promise<unknown[]>;
}
