# Employer board configuration

Configure approved public job boards using `GREENHOUSE_BOARD_TOKENS`, `LEVER_SITE_NAMES` and `ASHBY_BOARD_NAMES`.

Set `JOB_BOARD_EMPLOYER_NAMES` to a JSON object containing reviewed employer names for boards whose public endpoint does not return an authoritative organization name. Keys use `provider:board-id` format.

Example:

```json
{
  "lever:example-company": "Example Company Limited",
  "greenhouse:example-board": "Example Employer"
}
```

Store this JSON as a server-side environment variable, not in client-exposed configuration. Do not use board identifiers as employer names. A board with no verified name is reported as failed and its vacancies are not imported.

Remote work mode does not mean worldwide eligibility. The importer only stores country/region eligibility when the provider explicitly supplies it. An empty eligibility list means the source did not provide confirmed eligible locations; users must check the employer's original vacancy page.
