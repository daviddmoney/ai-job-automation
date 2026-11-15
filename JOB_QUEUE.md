# Durable job synchronization queue

Job-source synchronization uses PostgreSQL as its durable queue. It does not require Redis or an in-memory process to keep work alive.

## Request flow

1. The authenticated `GET /api/cron/jobs/sync` endpoint inserts (or reuses) one task for the current UTC hour and returns HTTP 202.
2. A separate scheduler calls `GET /api/cron/jobs/worker` every minute.
3. The worker atomically claims one due task, records a lease token and expiry, then fetches and ingests jobs.
4. Completed work is persisted. Failures are retried up to three attempts with exponential delay; exhausted tasks are marked FAILED.
5. If a worker process stops unexpectedly, its task becomes claimable again after the five-minute lease expires.
6. The ingestion upsert and source/job identity constraints make retrying already-ingested vacancies safe.

Both endpoints require:

```http
Authorization: Bearer <CRON_SECRET>
```

Keep `CRON_SECRET` in the hosting provider's encrypted environment-variable store. Never put it in a query string, source file, or client-side code.

## Scheduler configuration

Configure two scheduled HTTP requests in the hosting provider or an external scheduler:

| Endpoint | Suggested cadence | Purpose |
| --- | --- | --- |
| `/api/cron/jobs/sync` | Hourly | Enqueue one deduplicated sync task |
| `/api/cron/jobs/worker` | Every minute | Process due tasks and retries |

Send the Authorization header above with both requests. The queue's hourly deduplication prevents repeated scheduler calls from creating duplicate hourly tasks.

The worker processes one task per request. This keeps execution bounded and lets the scheduler invoke it again for the next task. If a task is still running when its lease expires, another worker may reclaim it; the lock token prevents an expired worker from overwriting the newer worker's queue state.

## Database rollout

The queue requires the migration:

`prisma/migrations/20261114170000_add_durable_job_sync_queue/migration.sql`

Before production use:
1. Back up the database and apply migrations in staging.
2. Run `npx prisma generate`, `npm run typecheck`, and `npm run build`.
3. Apply migrations in production using the controlled release process (`npm run db:deploy`).
4. Configure both scheduled requests and confirm a task moves from PENDING to COMPLETED in the database.

Do not enable the worker scheduler before the migration has been applied. No production migration or deployment is performed by this repository change.
