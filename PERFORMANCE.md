# Performance and integration strategy

## Goal
Keep the global job-search experience responsive under normal network and database conditions without weakening authentication, account isolation, validation, or each user's location preferences.

Response-time figures are engineering targets, not guarantees. Provider latency, hosting region, database location, cold starts and user network quality affect observed results.

## Implemented
- Independent Greenhouse, Lever, Ashby and optional Jooble Nigeria adapters.
- Five Jooble keyword searches run concurrently with bounded retries, timeout handling and partial-success retention.
- Duplicate vacancies from overlapping Jooble keyword searches are removed within that source.
- Independent job providers run concurrently so one source outage does not stop the others.
- Job ingestion uses bounded concurrency (8 records at a time) to reduce serial wait without flooding PostgreSQL.
- Public job results are cached for up to 60 seconds using search-filter arguments; each user's saved-job state is fetched separately and never enters the shared cache.
- Successful ingestion invalidates the global public-job cache.
- PostgreSQL indexes support country, city, work-mode, status and publication-date filters.
- CI runs Prisma Client generation, TypeScript checks and a production build.
- Job-source synchronization is persisted in a PostgreSQL-backed queue with hourly deduplication, atomic claims, expiring leases, lock tokens, bounded retries and recoverability after worker interruption.
- Queue enqueueing and queue processing are separate authenticated endpoints, so the scheduler can keep request work bounded.

## Performance targets to measure

| Area | Initial target |
| --- | ---: |
| Cached job-search response | p95 below 100 ms |
| Indexed database read | p95 below 50 ms |
| Internal API route | p95 below 200 ms |
| Initial dashboard interaction | below 1 second |

Validate these targets with production-like load tests and telemetry before treating them as service-level commitments.

## Remaining production hardening
1. Measure route, database and provider latency with privacy-safe telemetry.
2. Confirm production database connection pooling and provider limits.
3. Add provider-specific rate limits and circuit breaking based on observed quotas and failures.
4. Run load tests and review PostgreSQL query plans before adding further indexes.
5. Deploy migrations through a controlled release pipeline after backup and staging verification.

The queue is implemented in code but is not active in production until its migration is applied and both authenticated scheduler endpoints are configured. See [JOB_QUEUE.md](./JOB_QUEUE.md).

## Security and correctness guardrails
- Keep API keys and database credentials server-side.
- Never place authenticated or user-specific responses in a shared cache.
- Keep ownership checks on saved jobs, CVs and applications.
- Preserve each user's selected location filters; do not hard-code Lagos or any other location globally.
- Do not infer worldwide eligibility from a generic remote label.
- Do not auto-submit applications without the user's explicit approval.
- Do not deploy or run production database migrations as part of an unverified code update.
