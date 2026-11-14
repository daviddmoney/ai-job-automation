# Performance and integration strategy

## Goal

Keep the application responsive under normal network and database conditions without weakening authentication, account isolation, validation, or Lagos-only job filtering.

The response-time figures below are engineering targets, not guarantees. Provider latency, hosting region, database location, cold starts, and user network quality affect observed results.

## Implemented in this iteration

- Jooble keyword searches execute concurrently rather than sequentially.
- A failed keyword request no longer discards successful results from other keyword searches.
- Duplicate vacancies returned by multiple keyword searches are removed before ingestion.
- Independent job providers execute concurrently.
- Job ingestion uses bounded concurrency (8 records at a time) to reduce serial wait time without flooding PostgreSQL.
- External Jooble requests have an 8-second timeout.

## Performance targets to measure

| Area | Initial target |
| --- | ---: |
| Cached dashboard/API response | p95 below 100 ms |
| Indexed database read | p95 below 50 ms |
| Internal API route | p95 below 200 ms |
| Initial dashboard interaction | below 1 second |

These targets should be validated with production-like load tests and real telemetry before being treated as service-level commitments.

## Next optimisation steps

1. Add request-duration and provider-latency telemetry, without logging credentials or personal data.
2. Measure the most frequent Prisma queries and add only indexes justified by query plans.
3. Add a shared cache for public job-search results; never share private profile or application data across users.
4. Move scheduled provider synchronisation to a durable background queue as volume grows.
5. Add retry with backoff for transient provider failures and enforce provider rate limits.
6. Run type checks, unit tests, integration tests, and load tests in CI before deployment.

## Security and correctness guardrails

- Keep API keys and database credentials server-side.
- Do not cache authenticated or user-specific responses in a shared cache.
- Keep per-user ownership checks on saved jobs, CVs, and applications.
- Preserve Lagos-only location validation at ingestion and query time.
- Do not auto-submit applications without the user's explicit approval.
