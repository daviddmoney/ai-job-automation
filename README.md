# AI Job Automation

A secure multi-user SaaS platform for discovering and managing job opportunities, initially focused on Lagos, Nigeria.

## Product requirements
- Search newly published or newly opened recruitment opportunities located in Lagos only.
- Include Lagos-based roles and clearly stated Lagos hybrid/remote roles; exclude roles located elsewhere.
- Keep each user's profile, CVs, saved jobs, applications, and settings private to that account.
- Require human review and approval before an application is submitted or an email is sent.

## Security baseline
- Support email/password and social sign-in.
- Support email OTP and authenticator-app TOTP as two-factor options.
- Restrict administrator access to authorised staff accounts.
- Enforce server-side authorization on every protected operation.
- Scope database reads and writes to the authenticated user's ownership.
- Use secure HTTP-only, same-site session cookies and CSRF protections.
- Hash passwords with Argon2id; validate inputs; rate-limit sensitive endpoints; audit security events.
- Keep secrets in environment variables. Never commit credentials.

## Proposed stack
Next.js App Router, TypeScript, PostgreSQL, Prisma, Auth.js, Zod, and Tailwind CSS.

## Local setup
1. Install Node.js LTS and PostgreSQL.
2. Copy `.env.example` to `.env.local` and supply local values.
3. Run `npm install`.
4. Run `npm run db:generate`.
5. Configure the database and run `npm run db:migrate`.
6. Run `npm run dev`.

## Status
Initial scaffold. Authentication providers, database migrations, job-source integrations, automated tests, and production deployment still need configuration and verification.

The application must not submit applications, send emails, or disclose personal information without explicit user approval.
