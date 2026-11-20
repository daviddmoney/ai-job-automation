# Global job and language preferences

## Scope

The Job and Language Preferences screen now uses searchable multi-select controls instead of comma-separated text inputs. It retains the existing `UserJobPreference` record and authenticated `/api/preferences/jobs` save/load flow; no destructive schema migration is required.

## User-facing controls

- **Countries:** ISO 3166-1 alpha-2 country list, displayed with localized English names and flag emoji. Multiple countries can be selected.
- **States / regions:** Loaded for the selected countries when the user opens the preferences page. Each provider-backed selection stores both the region and its country, preventing same-named states in different countries from colliding. Custom entries remain possible when a provider does not return a region.
- **Cities:** Loaded for selected regions. Each provider-backed selection stores the city, region and country together so matching remains geographically scoped. Custom entries remain possible.
- **Employment types:** Common global employment arrangements, with custom entries supported.
- **Work arrangements:** On-site, hybrid, remote and flexible are kept separate from employment contract types.
- **Job families and titles:** A broad curated set of roles plus searchable ILO ISCO-08 groups at all four levels: 10 major groups, 43 sub-major groups, 130 minor groups and 436 unit groups. Users can search and select standardized global occupation groups as well as specific titles and custom roles. ISCO-08 is a global classification of jobs, but local job titles and emerging roles still require aliases and custom entries.
- **Languages:** All five language-preference fields are now searchable. The common-language starter list is supplemented by a server-side ISO 639-3 catalogue search. Where a language has an ISO 639-1 code, that two-letter code is used for compatibility; otherwise its ISO 639-3 three-letter code is stored. The catalogue is sourced from iso-639-3@2.2.0 and should be refreshed against the current SIL-maintained tables before production release because the package snapshot is not a live feed. The API requires sign-in, rate-limits lookups, returns at most 100 search results and has no bulk-export endpoint. Attribute the code source to SIL / ISO 639-3 and review the current SIL terms before release; do not add a bulk download/export feature.

## Geography provider

The authenticated `GET /api/locations` route proxies the public CountriesNow geography dataset for state/region and city lookups. It:
- requires a signed-in user;
- accepts only the `states` and `cities` lookup types;
- validates country and region input lengths;
- limits upstream requests to eight seconds;
- sanitizes, deduplicates and sorts returned strings;
- caches the upstream response for 24 hours where the Next.js fetch cache is available; and
- returns a generic error rather than exposing upstream response bodies.

The location provider is a third-party dependency. Its coverage, uptime, rate limits, privacy terms and data licence must be reviewed before production-scale use. The interface must not claim exhaustive city coverage; the provider dataset may omit or use variant names for places. Users can add custom region/city values when a provider result is missing.

## Occupation catalogue

The authenticated `GET /api/occupations` endpoint searches the ILO ISCO-08 classification. It fetches the ILO-published CSV, parses the 2008 classification's four hierarchical levels, caches the normalized options for seven days and returns at most 100 search matches. The endpoint requires sign-in and is rate-limited. Search results include the group code and parent hierarchy; selected values are stored with their ISCO-08 code and label. The matcher extracts the label and compares it with job categories and titles.

ISCO-08 contains 10 major, 43 sub-major, 130 minor and 436 unit groups. It is a global standard for classifying jobs, not a continuously updated list of every country-specific title. The ILO has indicated that the classification is under revision; refresh the source/index when an updated standard or title index is published, and continue to support custom roles. Review ILO source terms before production-scale redistribution. The interface preserves saved values if the provider is unavailable and allows users to add custom region/city values.

## Preference and job matching behavior

The form saves to the existing private per-user preference record. The existing jobs page already reads these fields and passes them to `getRecentJobsForPreferences`:
- selected employment types are matched case-insensitively against `JobPosting.employmentType`; graduate trainee, internship, apprenticeship and entry-level selections can also match job titles;
- selected work arrangements filter `JobPosting.workMode`;
- selected job families expand to relevant role keywords and are matched against `JobPosting.jobCategory` and job titles; specific/custom titles are matched against both fields;
- selected country, region and city values are used for location matching when worldwide search is disabled; provider-backed region/city values retain their parent geography so a region or city with a duplicate name in another country does not match incorrectly; and
- worldwide search remains independently configurable.

**Important matching behavior:** when `worldwideSearch` is enabled, the current query intentionally does not restrict results to selected locations. Users can still use the selected location preferences as profile signals, but should turn worldwide search off when they want location-restricted results. Job-family matching expands common families to aliases and matches selected ISCO-08 group labels against job categories and titles. This provides a standardized global classification baseline; aliases and local title mappings should still be expanded as vacancy sources and country coverage grow.

## Language fields

The existing preference model keeps separate values for interface, native, job-description, application and employer-communication languages, plus additional languages. Language codes are persisted as strings and remain compatible with the existing translation architecture. Existing ISO 639-1 preferences remain valid; new preferences use the ISO 639-1 code where available and ISO 639-3 otherwise. The language endpoint does not expose the full code table in one response. A selected preference does not automatically translate or send an application; existing human-review and explicit-action safeguards remain applicable.

## Verification checklist

Run in the repository workspace after checking out `feat/global-job-language-preferences`:

1. `npm ci`
2. `npm run db:generate`
3. `npm run typecheck`
4. `npm test`
5. `npm run build`
6. Test with a new account and an account with existing saved preferences.
7. Test Nigeria → Lagos State → Ikeja, and at least one multi-country selection.
8. Test custom region, city, employment type, job title and additional language entries.
9. Test location provider timeout/failure and confirm saved values are not erased.
10. Confirm worldwide search on/off behavior and verify employment/work-mode/category filters against real job postings.
11. Search for a language with an ISO 639-1 code (English) and one that requires ISO 639-3; confirm the stored code is correct.
12. Verify the language and occupation APIs return no more than 100 matches per search and do not provide bulk export.
13. Test two regions with the same name in different countries and confirm their saved values and job matching remain distinct.\n14. Search the ISCO-08 catalogue for an accountant, software developer and nurse; confirm the hierarchy and saved codes.

Do not deploy until these checks pass and the external geography provider has been reviewed.
