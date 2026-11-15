# Optional Jooble Nigeria source setup

Jooble Nigeria is an optional supplementary source, not a platform dependency. The global job engine can collect from configured Greenhouse, Lever and Ashby public employer boards independently.

Obtain a publisher API key through the official Jooble Nigeria API page: https://ng.jooble.org/api/about

Set JOOBLE_NG_API_KEY in the server environment only. Never expose it to client-side code or commit it to Git.

The adapter searches a small set of accounting and graduate-entry terms in Nigeria. It is not a global job index and must not be treated as the only source. Review Jooble's current publisher API terms, request limits and eligibility before production use.

Manual staff sync and the protected cron endpoint include Jooble only when the key is configured. A Jooble outage is isolated from the other configured job-source adapters.
