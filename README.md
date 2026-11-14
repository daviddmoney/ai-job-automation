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
Next.js App Router, TypeScript, PostgreSQL, Prisma, Auth.js, Zod and Nodemailer.

## Job discovery
Provider-independent adapters are available for Greenhouse, Lever and Ashby public job boards. Jooble Nigeria remains an optional supplementary source. Configure approved employer board identifiers in server-side environment variables. These APIs do not provide universal access to every employer or job board; coverage depends on configured boards, permissions and provider terms.

See JOB_DISCOVERY.md.

## Translation
The server-side translation gateway supports Google Cloud Translation, DeepL, Microsoft Azure Translator, Amazon Translate and OpenAI. Configure one or more credentials and set TRANSLATION_PROVIDER_ORDER. Review translations before using them in applications or employer communications.

See MULTILINGUAL_ARCHITECTURE.md.

## Security
Repository automation includes CodeQL, dependency review, Dependabot, npm audit, Semgrep, Gitleaks and optional Snyk scanning. Cloudflare, Wazuh and Microsoft Sentinel require separate account and infrastructure configuration.

See SECURITY_INTEGRATIONS.md and SECURITY_CHECKLIST.md.

## Local setup
1. Install Node.js LTS and PostgreSQL.
2. Copy .env.example to .env.local and configure local values.
3. Run npm install.
4. Run npm run db:generate.
5. Run npm run db:migrate.
6. Run npm run dev.

After pulling schema changes, run prisma migrate deploy in staging/production and regenerate Prisma Client.

Do not use real customer data until security, privacy, ownership-isolation, backup, translation-consent and production deployment checks are complete. This repository is not a security certification. Never commit credentials.
