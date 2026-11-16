# Railway production deployment

This project is a full-stack Next.js + Prisma + PostgreSQL application. Railway is the recommended first production host because the web service, PostgreSQL database, and scheduled HTTP jobs can be operated in one project and communicate over private networking.

## Service layout

- **Web service:** deploy this repository's `main` branch; expose port 3000 and generate a Railway domain.
- **PostgreSQL:** provision a managed PostgreSQL service in the same region as the web service. Use Railway's private/reference `DATABASE_URL`, not a public database URL.
- **Scheduler:** use Railway Cron or an external scheduler to call the two protected queue endpoints below. The application uses a PostgreSQL-backed durable queue; Redis is not required for the current queue implementation.
- **Object storage:** before enabling CV uploads for real users, configure a private S3-compatible bucket with encryption, short-lived signed URLs, malware scanning/quarantine, and a retention policy. Do not store uploaded CVs in the ephemeral application filesystem.

## Build and runtime

The repository is configured for Next.js standalone output. Build with Node.js 22 LTS:

```sh
npm install
npm run db:generate
npm run typecheck
npm run build
npm start
```

Railway should use the repository's Railpack Node build, install dependencies, generate Prisma Client, and run `npm run build`. Start command: `npm start`. The service listens on `0.0.0.0:3000`. Health check path: `/api/health`.

Do not set a production migration command until the existing database has been backed up, the migration history has been reconciled, and the exact migration set has been successfully tested against a staging copy. Then run `npm run db:deploy` as a controlled release step.

## Required web-service environment variables

- `DATABASE_URL`: Railway PostgreSQL private connection reference.
- `AUTH_SECRET`: independently generated high-entropy random secret.
- `AUTH_URL`: the final HTTPS production origin.
- `TOTP_ENCRYPTION_KEY`: base64-encoded 32-byte key, generated independently from AUTH_SECRET.
- `EMAIL_FROM`: sender address/domain verified with the email provider.
- One email provider: `RESEND_API_KEY`, `POSTMARK_SERVER_TOKEN`, or `SENDGRID_API_KEY`.
- `EMAIL_PROVIDER_ORDER`: ordered configured providers, e.g. `resend,postmark,sendgrid`.
- `CRON_SECRET`: long random secret shared only with the scheduler.
- OAuth variables only if Google sign-in is enabled: `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`.

Optional job source variables: `GREENHOUSE_BOARD_TOKENS`, `LEVER_SITE_NAMES`, `ASHBY_BOARD_NAMES`, `JOOBLE_NG_API_KEY`.

Optional translation variables: one or more of `GOOGLE_TRANSLATE_API_KEY`, `DEEPL_API_KEY`, `AZURE_TRANSLATOR_KEY` plus `AZURE_TRANSLATOR_REGION`, AWS Translate credentials/role, or `OPENAI_API_KEY`. Set `TRANSLATION_PROVIDER_ORDER` to match configured providers.

Optional security scan variables: `SNYK_TOKEN`; enable `ENABLE_SNYK=true` as a repository variable. Enable `ENABLE_CODEQL=true` and `ENABLE_DEPENDENCY_REVIEW=true` only after the corresponding GitHub repository security features are available.

Never commit real credentials, paste them into chat, or expose them through `NEXT_PUBLIC_*` variables.

## Scheduled job synchronization

Configure two authenticated HTTP schedules, using the same secret:

- Hourly: `GET https://YOUR_DOMAIN/api/cron/jobs/sync`
- Every minute: `GET https://YOUR_DOMAIN/api/cron/jobs/worker`

Both requests must include `Authorization: Bearer YOUR_CRON_SECRET`. Test them in staging first. The worker endpoint is only ready after the durable queue migration is applied.

## Before public launch

1. Create a staging environment and a separate staging database.
2. Take a restorable backup of any existing production database.
3. Reconcile Prisma migration history; do not blindly run the baseline migration against an unknown existing database.
4. Apply and test migrations in staging; verify registration, sign-in, 2FA, account isolation, job search, saved jobs, applications, translation, email and scheduler flows.
5. Configure verified email sender and send test verification/2FA messages.
6. Configure approved job-board identifiers and verify provider terms, rate limits and geographic metadata.
7. Configure translation providers and review data processing, residency, retention and consent requirements.
8. Enable GitHub secret scanning, push protection, Dependabot alerts, CodeQL and dependency review where supported.
9. Put Cloudflare DNS/WAF/rate limiting in front of the origin; restrict direct origin access where practical.
10. Enable encrypted backups and point-in-time recovery; test a restore.
11. Add error/latency monitoring and alerting; test rollback to the previous image/deployment.
12. Complete privacy, terms, retention, incident-response and independent penetration-test reviews.

A successful build is not a production launch. Do not accept real customer CVs or personal data until the controls above have been verified.
