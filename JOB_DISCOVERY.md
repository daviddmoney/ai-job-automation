# Lagos-only job discovery

## Location inclusion rules
- On-site and hybrid roles must resolve to Lagos, Nigeria (including a clearly stated Lagos State location such as Ikeja, Lagos, Nigeria).
- Remote roles are included only when the source explicitly lists Lagos or Lagos, Nigeria in the eligible locations.
- Generic Nigeria-wide remote roles are not assumed to be Lagos-eligible.
- Records with missing, ambiguous, or out-of-Lagos locations are excluded at ingestion and again at search time.

## Import contract
A staff-only `POST /api/admin/jobs/import` endpoint accepts between 1 and 100 job records. Each record must contain a source name, stable source job ID, title, company, location text, and work mode. URLs must be valid HTTP(S) links. Duplicate source/source-job IDs are upserted.

## User experience
- `/jobs` shows active opportunities published or first discovered within the last 30 days.
- `/saved-jobs` displays only the signed-in user's saved opportunities.
- `/applications` tracks each user's own applications and notes; changing a status does not submit anything to an employer.
- `POST` and `DELETE /api/saved-jobs` use the authenticated session's user ID; the browser cannot specify an owner ID.

## Not yet connected
No external job-board source adapters or live job feeds are configured yet. The staff import endpoint and data model are ready for approved source integrations. Respect each provider's API terms, robots policies, rate limits, and licensing before connecting a source.
