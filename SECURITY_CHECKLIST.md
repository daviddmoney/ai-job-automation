# Security implementation checklist

## Implemented in this scaffold
- [x] Private repository and no committed production secrets.
- [x] Registration assigns USER role on the server; public form has no role field.
- [x] Passwords hashed with Argon2id.
- [x] Email verification challenge is hashed, expires after ten minutes, and has a per-account attempt limit.
- [x] Password sign-in requires a verified email.
- [x] TOTP authenticator secrets are encrypted with AES-256-GCM using a separate environment key.
- [x] Email OTP and TOTP second-factor checks are wired into credential sign-in.
- [x] OAuth cannot bypass enabled 2FA (OAuth sign-in is denied for accounts with 2FA enabled pending an OAuth challenge flow).
- [x] Server-side helper reads current user role from the database for staff authorization.
- [x] Security headers are configured in Next.js.

## Required before public launch
- [x] Add persistent IP/account rate limiting to registration, password login, email verification/resend, email OTP delivery, and 2FA setup/confirmation endpoints.
- [ ] Add rate-limit bucket cleanup, abuse monitoring, and validate proxy IP extraction in production.
- [x] Add resend-verification workflow.
- [ ] Add recovery codes, account recovery, and 2FA disable/change flows with reauthentication.
- [x] Add staff-only `/admin` route guarded by a database-backed role check.
- [ ] Add an audited staff provisioning process.
- [ ] Add ownership-scoped CRUD APIs and tests proving users cannot access other users' data.
- [ ] Review OAuth account linking and verified-email handling with real provider configuration.
- [x] Add same-origin checks to registration, verification, resend, email-OTP, and 2FA configuration endpoints.
- [ ] Review Auth.js cookie/CSRF settings and keep origin checks on future state-changing endpoints.
- [ ] Add automated unit, integration, and end-to-end tests, including concurrent OTP replay attempts.
- [ ] Configure production database, email delivery, AUTH_SECRET, TOTP_ENCRYPTION_KEY, and OAuth credentials in the hosting provider's secret manager.
- [ ] Run Prisma migrations, lint, typecheck, and production build against a staging environment.
- [ ] Complete privacy, retention, backup, incident-response, and vulnerability reviews.

This checklist is not a security certification. Do not use real customer data until the outstanding items are addressed and tested.
