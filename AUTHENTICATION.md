# Authentication implementation and production gates

This document records the authentication controls implemented on the security PR branch and the external configuration checks still required. It is not an independent security certification.

## Implemented in the security PR

- Credentials sign-in normalizes email and verifies Argon2id password hashes.
- Public registration assigns USER server-side; role values supplied by clients are not accepted.
- Google OAuth is enabled only when both provider credentials are configured, requires Google's explicit `email_verified === true` claim, and does not enable dangerous email-based account linking.
- OAuth sign-in is denied for accounts with 2FA enabled until a complete OAuth second-factor challenge flow exists.
- JWT sessions use an eight-hour maximum lifetime, secure cookies in production, and a database-backed `sessionVersion` check on every session read. Missing, stale, or unverifiable versions fail closed.
- Password reset uses a random one-time token, HMAC digest at rest, 15-minute expiry, generic request responses, rate limits, one-time transactional consumption, an audit event, and session revocation.
- Email verification uses account-bound HMAC digests, database-clock expiry, one-time atomic consumption, and a five-attempt limit.
- Email second-factor OTPs use account- and purpose-bound HMAC digests, atomic consumption, expiry and five-attempt enforcement.
- TOTP secrets are encrypted using AES-256-GCM. TOTP replay counters are stored atomically.
- TOTP recovery codes are random, stored hashed, shown once, rotated only after password and fresh TOTP proof, and audited.
- Email fallback recovery for lost TOTP/recovery codes requires the account password and a one-time code sent to the verified email; it disables TOTP and revokes all sessions.
- 2FA setup and disable operations require password reauthentication; disable additionally requires current TOTP, current email OTP, or a one-time recovery code. 2FA changes are audited and revoke sessions.
- Staff provisioning requires explicit confirmation, target account verification, an operator email and reason. The promotion is transactional and recorded in AuditEvent.
- Persistent rate-limit buckets are atomically updated. Denials are audited once per bucket/window, structured events are logged without raw identifiers, expired buckets are cleaned opportunistically in bounded batches, and a staff-only monitoring endpoint reports bucket and denial counts. A manual cleanup script is available as `npm run rate-limit:cleanup`.
- Sensitive authentication and 2FA POST routes enforce same-origin checks and bounded request bodies.

## Automated verification

The security PR's CI runs unit tests, TypeScript typechecking, disposable PostgreSQL integration/concurrency tests, migration validation and production build. New coverage checks session-version revocation, verified Google email claims, staff-role authorization, rate-limit cleanup/denial auditing, and OTP concurrency/replay behavior.

A green workflow is evidence for the exact commit tested; it does not validate Railway production settings or replace independent human review.

## Production configuration still required

1. **Railway trusted ingress:** The app and proxy currently both have public domains, and proxy HTTP logs show 504 timeouts to the app. A staged Railway patch now rotates the shared proxy secret on both services, sets `AUTH_URL` to the proxy hostname, stages removal of the application's direct public domain, and changes NGINX to resolve the app's private hostname dynamically. This patch is not live until explicitly applied and must pass external proxy smoke tests after deployment.
2. **TOTP encryption key:** `TOTP_ENCRYPTION_KEY` is absent from the inspected production app variables. Configure a base64 value containing exactly 32 random bytes only after the owner confirms no existing encrypted TOTP secrets need the previous key, or supplies the original key. Do not rotate an existing encryption key without a data migration plan.
3. **Transactional email:** The inspected production variable list did not contain `EMAIL_FROM` or any supported provider API key (`RESEND_API_KEY`, `POSTMARK_SERVER_TOKEN`, or `SENDGRID_API_KEY`). Configure a verified sender and provider credential in Railway before relying on verification, OTP, password-reset or recovery email.
4. **Google OAuth:** `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` were not present in the inspected production variable list. If Google sign-in is required, add credentials and register the callback against the trusted proxy hostname. Otherwise keep Google sign-in disabled.
5. **Independent human review:** No independent human review is recorded on PR #14. A repository owner must nominate/request an available human collaborator or security reviewer. Automated AI reviews are not a substitute.
6. **DeepSeek second opinion:** The optional GitHub Action is configured, but the provider rejected the request for insufficient balance. This is an external DeepSeek account billing condition, not a code defect. An account owner must add API credits or replace the API key with one backed by an adequately funded account; do not treat the unavailable review as a pass.
7. **Live validation:** After the staged Railway patch is applied, test proxy GET/POST paths, OAuth callback, cookie attributes, direct-origin rejection, rate-limit IP spoofing and runtime logs from outside the environment. Confirm the proxy can reach the app after app redeploys.
8. **Operational/security gates:** Verify backups and restore, alert routing, log redaction, malware scanning/quarantine for uploaded CVs, live two-account tenant isolation, privacy/retention requirements and independent penetration testing before accepting real customer data.

## Release decision

**NOT READY TO MERGE OR RELEASE** until the new PR-head CI/migration checks pass, the staged Railway changes are applied and externally verified, required email/TOTP/OAuth configuration is resolved for enabled features, and an independent human reviewer has reviewed the final commit.

Do not merge or deploy based solely on automated scans or this implementation note.
