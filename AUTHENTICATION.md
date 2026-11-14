# Authentication implementation notes

This repository now contains the initial Auth.js integration.

## Enabled foundations
- Credentials sign-in normalizes email and verifies the stored password hash using Argon2.
- Google OAuth is registered only when both server-side Google credentials are configured.
- Auth.js uses JWT sessions; the application session exposes the user's ID and role.
- Prisma adapter models are included for OAuth accounts, database sessions, and verification tokens.

## Remaining work before production
1. Add rate-limit bucket cleanup/monitoring and validate thresholds behind the production reverse proxy.
2. Add backup-code issuance/rotation, account recovery, and reauthentication-protected 2FA disable/change flows.
3. Add audited staff provisioning. Public registration must never allow a user to choose the STAFF role.
4. Complete secure-cookie review, session revocation, security event monitoring, and OAuth account-linking review.
5. Add automated tests for login, OTP replay, OAuth account linking, role escalation, session expiry, and cross-account access.
6. Run Prisma migrations and a production build against a configured test database.

## Environment
Set AUTH_SECRET and AUTH_URL, and optionally AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET, in the deployment environment. Do not commit real values.

This is an authentication foundation, not a production-ready security certification. Do not launch with real user data until the remaining controls are implemented and tested.

## Registration and two-factor implementation
- Email/password registration stores an Argon2id password hash and assigns USER role server-side.
- Email verification uses a six-digit code with a ten-minute expiry and a maximum of five verification attempts.
- Password sign-in is blocked until the email address is verified.
- Authenticator-app TOTP setup encrypts the pending secret using AES-256-GCM. Configure TOTP_ENCRYPTION_KEY as base64 for exactly 32 random bytes.
- Email OTP can be enabled from /security/2fa; sign-in requires the emailed code after the password.
- OAuth sign-in is blocked for accounts with 2FA enabled until an OAuth second-factor challenge flow is implemented; this prevents OAuth from bypassing 2FA.

## Production blockers
- Add automated cleanup and monitoring for persistent rate-limit buckets, and validate client-IP extraction behind the production reverse proxy.
- Add backup-code issuance/rotation, account recovery, trusted-device policy, and audited staff provisioning. Resend-verification is implemented.
- Add automated integration tests and run migrations/build before deployment.
- Review email sender configuration, secret management, logging redaction, session invalidation, and all state-changing route origin checks.
