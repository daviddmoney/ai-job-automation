# AI Job Automation

A secure, multi-user, global AI job discovery and application-management platform.

## Product requirements
- Discover jobs across countries and regions; never hard-code one city or country as a global restriction.
- Support on-site, hybrid, remote and flexible work.
- Let users choose countries, regions, cities, employment types, job categories and languages.
- Preserve original job descriptions and source-language metadata.
- Support multilingual job discovery and two-way applicant/employer translation.
- Require human review before applications or external messages are sent.
- Keep each user's profile, CV, saved jobs, applications and preferences private.

## Stack
Next.js App Router, TypeScript, PostgreSQL, Prisma, Auth.js and Zod.

## Job discovery
Provider-independent adapters are available for Greenhouse, Lever and Ashby public job boards. Jooble Nigeria remains an optional supplementary source. Configure approved employer board identifiers in server-side environment variables. These APIs do not provide universal access to every employer or job board; coverage depends on configured boards, permissions and provider terms.

See JOB_DISCOVERY.md.

## Translation
The server-side translation gateway supports Google Cloud Translation, DeepL, Microsoft Azure Translator, Amazon Translate and OpenAI. Configure one or more credentials and set TRANSLATION_PROVIDER_ORDER. Job descriptions can be translated from the job feed; review translations before using them in applications or employer communications.

See MULTILINGUAL_ARCHITECTURE.md.

## Email delivery
Account verification and sign-in codes use a provider-independent HTTP email gateway supporting Resend, Postmark and SendGrid with fallback. Configure a verified EMAIL_FROM address and at least one provider key.

See EMAIL_DELIVERY.md.

## Security
Repository automation includes CodeQL (when code scanning is enabled), dependency review (when dependency graph support is enabled), Dependabot, npm audit, Semgrep, Gitleaks and optional Snyk scanning. Cloudflare, Wazuh and Microsoft Sentinel require separate account and infrastructure configuration.

See SECURITY_INTEGRATIONS.md and SECURITY_CHECKLIST.md.

## Local setup
1. Install Node.js LTS and PostgreSQL.
2. Copy .env.example to .env.local and configure local values.
3. Run npm install.
4. Run npm run db:generate.
5. For a fresh development database, run npm run db:push.
6. Run npm run dev.

This scaffold did not previously contain a migration baseline. Before production migration deployment, baseline the existing database and create reviewed Prisma migrations; do not run an unbaselined schema migration against a database containing user data.

Do not use real customer data until security, privacy, ownership-isolation, backup, translation-consent and production deployment checks are complete. This repository is not a security certification. Never commit credentials.


## Gmail and CV attachments
- Connect Gmail using a dedicated Google OAuth client requesting Gmail compose and send permissions. Enable the Gmail API in Google Cloud and register the exact `GOOGLE_GMAIL_REDIRECT_URI`.
- Upload a PDF CV (maximum 8 MB) to the authenticated user's private CV vault. File bytes and OAuth tokens are encrypted at application level with the existing 32-byte `TOTP_ENCRYPTION_KEY` before database storage.
- Gmail draft creation and updates rebuild the MIME message from the original binary PDF bytes. The draft is read back from Gmail and checked for a non-empty PDF attachment before success is reported or sending is allowed.
- Sending is a separate explicit-confirmation action. Configure `GOOGLE_GMAIL_CLIENT_ID`, `GOOGLE_GMAIL_CLIENT_SECRET`, `GOOGLE_GMAIL_REDIRECT_URI`, and `TOTP_ENCRYPTION_KEY`; apply migrations and regenerate Prisma Client before deployment.
