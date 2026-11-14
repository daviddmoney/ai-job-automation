# Performance and integration strategy

## Goal

Keep the application responsive under normal network and database conditions without weakening authentication, account isolation, validation, or Lagos-only job filtering.

Response-time figures are engineering targets, not guarantees. Provider latency, hosting region, database location, cold starts, and user network quality affect observed results.

## Implemented

- Five independent Jooble keyword searches run concurrently.
- Transient Jooble network, timeout, server, and rate-limit failures receive bounded retries with exponential backoff and an 8-second per-attempt timeout.
- Partial provider success is retained; all-search failure is surfaced as an error.
- Duplicate vacancies from overlapping keyword searches are removed.
- Lagos eligibility is derived from the provider's location field only; a mention of Lagos in the description cannot qualify a different location.
- Independent job providers run concurrently.
- Job ingestion uses bounded concurrency (8 records at a time) to reduce serial wait time without flooding PostgreSQL.
- Public Lagos job results are cached for up to 60 seconds. User-specific saved-job state is fetched separately and is never placed in the shared cache.
- Successful job ingestion invalidates the public job cache.
- Composite PostgreSQL indexes support the main public Lagos job search filters.
- CI uses the repository's existing package-install approach and runs Prisma generation, TypeScript checks, and a production build.

## Performance targets to measure

| Area | Initial target |
| --- | ---: |
| Cached dashboard/API response | p95 below 100 ms |
| Indexed database read | p95 below 50 ms |
| Internal API route | p95 below 200 ms |
| Initial dashboard interaction | below 1 second |

Validate these targets with production-like load tests and real telemetry before treating them as service-level commitments.

## Remaining production hardening

1. Measure route, database, and provider latency with privacy-safe telemetry.
2. Confirm the production database supports connection pooling; configure the provider's pooler and limits for the deployment environment.
3. Add a durable background queue when sync volume or duration warrants it; do not rely on in-process work for long-running production tasks.
4. Add provider-specific rate limits and circuit breaking based on observed Jooble quotas and failure patterns.
5. Run load tests and review PostgreSQL query plans before adding further indexes.
6. Deploy migrations through the controlled release pipeline after backup and staging verification.

## Security and correctness guardrails

- Keep API keys and database credentials server-side.
- Never place authenticated or user-specific responses in a shared cache.
- Keep ownership checks on saved jobs, CVs, and applications.
- Preserve Lagos-only location validation at ingestion and query time.
- Do not auto-submit applications without the user's explicit approval.
- Do not deploy or run production database migrations as part of an unverified code update.
