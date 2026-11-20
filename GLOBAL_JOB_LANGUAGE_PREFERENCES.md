# Global job and language preferences

## Scope

The Job and Language Preferences screen now uses searchable multi-select controls instead of comma-separated text inputs. It retains the existing `UserJobPreference` record and authenticated `/api/preferences/jobs` save/load flow; no destructive schema migration is required.

## User-facing controls

- **Countries:** ISO 3166-1 alpha-2 country list, displayed with localized English names and flag emoji. Multiple countries can be selected.
- **States / regions:** Loaded for the selected countries when the user opens the preferences page. Custom entries remain possible when a provider does not return a region.
- **Cities:** Loaded for selected regions. Custom entries remain possible.
- **Employment types:** Common global employment arrangements, with custom entries supported.
- **Work arrangements:** On-site, hybrid, remote and flexible are kept separate from employment contract types.
- **Job families and titles:** A grouped starter taxonomy across accounting/finance, technology, administration, HR, sales/marketing, legal, engineering, healthcare, education, customer support, logistics and project/business management. Custom titles can be added.
- **Languages:** The selector uses ISO 639-1 language codes and native display names for the 184 two-letter language entries represented in the UI. Additional language values can be added. This is not a complete ISO 639-3 catalogue of every living, historical or constructed language; a complete catalogue should be added as a separately versioned dataset before marketing the product as covering every language in the world.

## Geography provider

The authenticated `GET /api/locations` route proxies the public CountriesNow geography dataset for state/region and city lookups. It:
- requires a signed-in user;
- accepts only the `states` and `cities` lookup types;
- validates country and region input lengths;
- limits upstream requests to eight seconds;
- sanitizes, deduplicates and sorts returned strings;
- caches the upstream response for 24 hours where the Next.js fetch cache is available; and
- returns a generic error rather than exposing upstream response bodies.

The location provider is a third-party dependency. Its coverage, uptime, rate limits, privacy terms and data licence must be reviewed before production-scale use. The interface preserves saved values if the provider is unavailable and allows users to add custom region/city values.

## Preference and job matching behavior

The form saves to the existing private per-user preference record. The existing jobs page already reads these fields and passes them to `getRecentJobsForPreferences`:
- selected employment types filter `JobPosting.employmentType`;
- selected work arrangements filter `JobPosting.workMode`;
- selected job categories/titles filter `JobPosting.jobCategory`;
- selected country, region and city values are used for location matching when worldwide search is disabled; and
- worldwide search remains independently configurable.

**Important matching behavior:** when `worldwideSearch` is enabled, the current query intentionally does not restrict results to selected locations. Users can still use the selected location preferences as profile signals, but should turn worldwide search off when they want location-restricted results. Job-family matching now expands common families to keyword aliases. This improves recall but is not a complete occupation taxonomy; aliases should be reviewed and expanded as the vacancy sources and country coverage grow.

## Language fields

The existing preference model keeps separate values for interface, native, job-description, application and employer-communication languages, plus additional languages. Language codes are persisted as strings and remain compatible with the existing translation architecture. A selected preference does not automatically translate or send an application; existing human-review and explicit-action safeguards remain applicable.

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

Do not deploy until these checks pass and the external geography provider has been reviewed.
