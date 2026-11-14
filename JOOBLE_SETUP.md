# Jooble Nigeria source setup

The first provider adapter targets Jooble's Nigeria API (`ng.jooble.org`). Obtain a publisher API key through the official [Jooble Nigeria API page](https://ng.jooble.org/api/about). The API requires a key and country-specific registration; the documented free tier is limited to 100 requests per day per country key.

## Configure
Set `JOOBLE_NG_API_KEY` in the server environment only. Never expose it to client-side code or commit it to Git.

## Sync
- Staff can trigger a sync with `POST /api/admin/jobs/sync` while signed in.
- A hosting-platform cron can call `GET /api/cron/jobs/sync` with `Authorization: Bearer <CRON_SECRET>`.
- Set `CRON_SECRET` to a long random secret in the hosting environment.
- The adapter currently searches accounting, accountant, audit, finance, and accounts-assistant terms. Five searches per sync are made, so schedule within the provider's daily request limit.

## Location safeguards
The provider search requests Lagos, but source results are independently checked by the platform's strict location allow-list before storage. A remote vacancy is accepted only when Lagos is explicitly present in its returned location/title data and is recorded as Lagos-eligible. Generic Nigeria-wide remote jobs are excluded.

## Important
Review Jooble's current API terms and publisher requirements before production use. Provider results and timestamps should be verified against the original listing. The platform does not auto-submit applications.
