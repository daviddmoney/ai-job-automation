# Authentication implementation notes

This repository now contains the initial Auth.js integration.

## Enabled foundations
- Credentials sign-in normalizes email and verifies the stored password hash using Argon2.
- Google OAuth is registered only when both server-side Google credentials are configured.
- Auth.js uses JWT sessions; the application session exposes the user's ID and role.
- Prisma adapter models are included for OAuth accounts, database sessions, and verification tokens.

## Remaining work before production
1. Implement registration with email verification and a robust distributed rate limiter.
2. Add email OTP and authenticator-app TOTP enrollment, challenge verification, backup-code rotation, and encrypted secret storage using a managed encryption key.
3. Enforce 2FA challenges for accounts that have enabled 2FA; the current sign-in callback does not yet do this.
4. Add staff provisioning. Public registration must never allow a user to choose the STAFF role.
5. Add CSRF and origin checks, secure-cookie review, session revocation, account recovery, and security event monitoring.
6. Add automated tests for login, OAuth account linking, role escalation, session expiry, and cross-account access.
7. Run Prisma migrations and a production build against a configured test database.

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
- Add distributed rate limiting for registration, verification, login, and all OTP endpoints. The current per-user attempt counters are not a substitute for IP/account rate limiting.
- Add resend-verification workflow, backup-code issuance/rotation, account recovery, trusted-device policy, and staff provisioning.
- Add automated integration tests and run migrations/build before deployment.
- Review email sender configuration, secret management, logging redaction, session invalidation, and CSRF/origin controls.
