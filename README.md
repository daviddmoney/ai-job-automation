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

## Authentication routes
- `/register` — create a standard user account.
- `/verify-email` — verify the email address using the emailed code.
- `/signin` — sign in with password and, when enabled, a second-factor code.
- `/security/2fa` — enable email OTP or authenticator-app TOTP after signing in.
- `/dashboard` — protected account area.

See [AUTHENTICATION.md](./AUTHENTICATION.md) and [SECURITY_CHECKLIST.md](./SECURITY_CHECKLIST.md) for configuration and launch blockers.

## Job discovery
See [JOB_DISCOVERY.md](./JOB_DISCOVERY.md) for the strict Lagos location policy, staff import contract, saved-jobs privacy model, and application tracker. Jooble Nigeria adapter code is present; a valid provider API key is still required to retrieve live vacancies.

## Staff provisioning
A verified account can be promoted through the controlled `npm run promote-staff` script using `STAFF_EMAIL` and `CONFIRM_STAFF_PROMOTION=YES` in the deployment/admin environment. Never expose these variables to the browser or public registration.


## Gmail and CV attachments
- Connect Gmail using a dedicated Google OAuth consent flow requesting Gmail draft/send permissions.
- Upload a PDF CV to the user's private database-backed CV vault. The original bytes are stored and retrieved without text/base64 corruption.
- Gmail draft creation and updates rebuild the MIME message with the selected CV attachment on every write; Gmail's draft payload is read back to verify the PDF attachment before success is reported or a draft is sent.

- CV file bytes are encrypted at application level with the configured 32-byte `TOTP_ENCRYPTION_KEY` before database storage; backups must be protected and key rotation managed separately.
- Configure GOOGLE_GMAIL_CLIENT_ID, GOOGLE_GMAIL_CLIENT_SECRET, GOOGLE_GMAIL_REDIRECT_URI and TOTP_ENCRYPTION_KEY. Run `npm run db:generate` and `npm run db:deploy` after deploying the schema.
- Set the OAuth redirect URI in Google Cloud Console to the exact GOOGLE_GMAIL_REDIRECT_URI and enable the Gmail API. Request sensitive-scope verification/production publishing as required by Google.
