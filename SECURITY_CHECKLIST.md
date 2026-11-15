# Public-release security checklist

**Repository:** `daviddmoney/ai-job-automation`  
**Visibility:** Public  
**Candidate commit with completed automated evidence:** `4215675c62ff72153e252ff05114a8cddcea9bcd`  
**Assessment status:** In progress; not a formal certification.  
**Release rule:** Do not deploy with real customer data until every applicable release gate has evidence on the exact release commit.

## 1. Public repository and credential hygiene

- [x] Repository visibility is public.
- [x] `.gitignore` excludes `.env` and `.env.*` while allowing the placeholder-only `.env.example`.
- [x] Gitleaks configuration keeps default rules and narrowly allowlists only the published RFC 6238 test vector in `tests/provider-hardening.test.mjs`.
- [x] Dedicated full-history Gitleaks workflow fetches all refs and retains a redacted SARIF report.
- [x] Full-history scan passed on `4215675c62ff72153e252ff05114a8cddcea9bcd`: 407 reachable commits across 9 fetched branches, no tags, and Gitleaks reported `no leaks found`.
- [x] Incremental Gitleaks scan passed on the candidate after the narrow test-vector allowlist was added.
- [ ] Review any future findings; revoke and rotate every confirmed exposed credential (Google OAuth, Gmail, Railway, database, job-board, translation, email, AI provider and GitHub tokens).
- [ ] If a real secret is found, remove it from history using a coordinated rewrite plan, verify rewritten history and coordinate fresh clones. Do not rely on deleting it in a later commit.
- [ ] Verify GitHub Secret Scanning, push protection, Dependabot alerts and private vulnerability reporting settings in the repository UI.
- [ ] Check provider dashboards, deployment logs, Actions logs/artifacts, PRs, issues and releases for exposures outside Git history.

## 2. Static analysis and dependency security

- [x] Preserve the exact newer `main` CodeQL workflow with `security-events: write` and `upload: always`.
- [x] CodeQL completed successfully on `4215675c62ff72153e252ff05114a8cddcea9bcd`; SARIF upload was accepted and upload status completed.
- [x] Dependency Review completed successfully on `4215675c62ff72153e252ff05114a8cddcea9bcd`.
- [x] Weekly Dependabot updates are configured for npm and GitHub Actions.
- [x] npm audit, Semgrep, Gitleaks and Snyk completed successfully on `4215675c62ff72153e252ff05114a8cddcea9bcd`.
- [x] npm audit JSON report on `4215675c62ff72153e252ff05114a8cddcea9bcd`: 0 info, 0 low, 0 moderate, 0 high and 0 critical vulnerabilities (197 dependencies).
- [ ] Confirm the same zero-high/zero-critical result after this candidate is merged into `main`. The older main dependency tree previously reported 8 high and 1 moderate vulnerabilities.
- [ ] Pin third-party GitHub Actions to reviewed immutable commit SHAs and update actions to supported Node runtimes.
- [ ] Protect `main` with reviewed pull requests, required CI/security checks, no force-push and no branch deletion.

## 3. Authentication, authorization and account security

- [x] Registration assigns USER role server-side.
- [x] Password hashing uses Argon2id.
- [x] Email verification challenges are hashed, expire and have attempt limits.
- [x] TOTP secrets are encrypted using AES-256-GCM with a separate environment key.
- [x] Email OTP and TOTP second-factor checks are implemented.
- [x] Database-backed staff authorization and controlled staff promotion are implemented.
- [x] Atomic TOTP replay protection and one-time hashed recovery-code consumption are implemented.
- [x] Recovery-code regeneration requires password and fresh TOTP; codes are returned once and stored hashed.
- [ ] Add audited 2FA disable/recovery flow for users who lose both authenticator and recovery codes.
- [ ] Review OAuth account linking, verified-email handling, secure cookies, session revocation and expiry with real provider configuration.
- [ ] Test OTP replay/concurrency, brute force, privilege escalation, session expiry, account recovery and OAuth linking.

## 4. Abuse prevention, APIs and tenant isolation

- [x] Persistent IP/account rate limiting is implemented on inspected authentication and sensitive endpoints.
- [x] Spoofable X-Forwarded-For/X-Real-IP values are not trusted; the application expects a trusted edge-injected client-IP header with shared secret.
- [x] Streamed JSON body byte limits are implemented on inspected registration, verification, 2FA, preferences, applications, saved jobs, translation, recovery-code and admin-import endpoints.
- [ ] Configure and verify trusted proxy header injection and restrict direct origin access in the actual Railway environment.
- [ ] Add rate-limit bucket cleanup, monitoring and alerting; validate thresholds and client-IP behavior behind the production proxy.
- [x] Disposable PostgreSQL migration validation and saved-job/application account-isolation integration test passed on `4215675c62ff72153e252ff05114a8cddcea9bcd`.
- [ ] Expand ownership-scoped tests to every user-owned resource, including CV files, Gmail connections, preferences and every API read/update/delete/download path.
- [ ] Complete a live two-account test proving one user cannot access another user's data.
- [ ] Add malware scanning and quarantine for uploaded CVs; verify size, MIME, file signature, storage encryption, authorization and deletion.
- [ ] Verify logs redact passwords, OAuth codes, access/refresh tokens, CV contents and personal data.
- [ ] Add durable audit events for staff actions, account security changes and sensitive data access.

## 5. CI, database, deployment and operations

- [x] Candidate CI passed on `4215675c62ff72153e252ff05114a8cddcea9bcd`: `npm ci`, Prisma generation, unit tests, typecheck, disposable PostgreSQL integration tests and production build.
- [x] Migration Validation passed on `4215675c62ff72153e252ff05114a8cddcea9bcd`: all Prisma migrations applied to disposable PostgreSQL, representative multi-user/job data inserted, account-isolation test passed, migration status confirmed and typecheck passed.
- [ ] Back up the real staging database and prove restore before applying migrations; compare row counts and data integrity afterward.
- [ ] Confirm `prisma migrate status` on staging and rehearse rollback.
- [ ] Confirm Railway project, service and environment; verify deployed SHA equals approved release SHA.
- [ ] Verify live health endpoint reports application and database healthy.
- [ ] Complete authenticated staging smoke tests for registration, login, 2FA, job search, saved jobs, applications and account separation.
- [ ] Verify encrypted backups, point-in-time recovery, monitoring, alerting, incident response and rollback.
- [ ] Add CSP and production HSTS after validating external resources.
- [ ] Configure WAF, DDoS/bot controls and origin restrictions appropriate to the hosting setup.

## 6. Gmail, privacy and independent assessment

- [x] Gmail OAuth/token and PDF MIME implementation plus deterministic binary-attachment/header tests exist in the candidate.
- [ ] Complete authorised live Google OAuth consent, refresh-token test, Gmail draft read-back and PDF attachment byte/size verification in a designated test mailbox.
- [ ] Verify disconnect/revocation and account ownership with two separate test users.
- [ ] Do not send an external email without explicit user approval and a controlled test recipient.
- [ ] Complete privacy, retention, data-processing and cross-border transfer reviews for international users.
- [x] `SECURITY.md` provides private vulnerability-disclosure instructions.
- [ ] Enable GitHub private vulnerability reporting and verify the reporting route.
- [ ] Complete an independent penetration test and remediate findings.
- [ ] Complete an independent OWASP ASVS Level 2 assessment with evidence, reviewer and sign-off.

## Known non-security CI issue

The optional DeepSeek PR-review job returned HTTP 402 because the provider account had insufficient balance. This is a third-party review-service billing issue, not a finding in the application. Fund the provider account or disable the optional `ENABLE_DEEPSEEK_REVIEW` setting until it is available.

## Release decision

**NO-GO for production use with real customer data until all applicable unchecked gates are evidenced as passed on the exact release commit.**

A clean automated scan is not a security certification. No production migration, production deployment, live Gmail consent or external email send is authorised by this checklist.
