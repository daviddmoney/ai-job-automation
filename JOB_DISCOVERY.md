# Global job discovery

## Location and preference rules
- Job ingestion is global and must not reject a vacancy because it is outside Lagos or Nigeria.
- Store original location text and structured city, region/state and country where available.
- Support ONSITE, HYBRID, REMOTE and FLEXIBLE work modes.
- Remote eligibility must be explicit in the employer/source data. Do not label a role worldwide merely because it says remote.
- Each user controls preferred countries, regions, cities and work modes through UserJobPreference.
- Empty location preferences with worldwideSearch enabled mean worldwide discovery.
- Work authorisation, visa sponsorship and language requirements must not be inferred.

## Sources
- Greenhouse public Job Board API: GREENHOUSE_BOARD_TOKENS.
- Lever public postings: LEVER_SITE_NAMES.
- Ashby public posting API: ASHBY_BOARD_NAMES.
- Jooble Nigeria is optional and requires JOOBLE_NG_API_KEY.

Adapters isolate provider failures so one source does not stop the others. These are not a universal job index. Board identifiers must be curated and sources must be used only where API terms, permissions, rate limits and licensing allow collection.

## Import and privacy
The staff-only import endpoint accepts 1–100 records. Each record requires source, stable source job ID, title, company and location text. URLs must be HTTP(S). Duplicate source/source-job IDs are upserted. Ambiguous location metadata may be retained rather than incorrectly excluded.

Saved jobs and applications are scoped to the authenticated user. Never trust a browser-supplied owner ID. Applications are tracked only and are not automatically submitted.

## Scheduled sync
The protected endpoint is /api/cron/jobs/sync and requires Authorization: Bearer <CRON_SECRET>. Configure a hosting schedule only after approved source board identifiers are supplied and tested.
