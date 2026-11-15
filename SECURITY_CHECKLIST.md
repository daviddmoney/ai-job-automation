# Public-release security checklist

**Repository:** `daviddmoney/ai-job-automation`  
**Visibility:** Public  
**Latest audited candidate commit:** `fb928d5ccf6ba11cffadb00adfd5846e4850c997`  
**Assessment status:** Automated checks passed; independent and production assurance still pending. This is not a formal certification.

## 1. Public repository and credential hygiene

- [x] Repository visibility is public.
- [x] `.gitignore` excludes `.env` and `.env.*` while allowing the placeholder-only `.env.example`.
- [x] Gitleaks configuration retains default rules and allowlists only the published RFC 6238 test vector in `tests/provider-hardening.test.mjs`.
- [x] Dedicated full-history Gitleaks workflow uses complete history and all fetched refs; binary v8.30.1 is pinned and its SHA-256 checksum is verified.
- [x] Full-history scan passed on `fb928d5ccf6ba11cffadb00adfd5846e4850c997`: 439 reachable commits, 10 fetched remote branches, no tags; Gitleaks scanned 427 commits and reported no leaks.
- [x] Incremental Gitleaks scan passed on `fb928d5ccf6ba11cffadb00adfd5846e4850c997`; zero findings.
- [ ] Review future findings; revoke and rotate every confirmed exposed credential (Google OAuth, Gmail, Railway, database, job-board, translation, email, AI provider and GitHub tokens).
- [ ] If a real secret is found, remove it from history using a coordinated rewrite plan, verify rewritten history and coordinate fresh clones.
- [ ] Verify GitHub Secret Scanning, push protection, Dependabot alerts and private vulnerability reporting settings in the repository UI.
- [ ] Check provider dashboards, deployment logs, Actions logs/artifacts, PRs, issues and releases for exposures outside Git history.

## 2. Static analysis and dependency security

- [x] Preserve the exact newer `main` CodeQL SARIF workflow.
- [x] CodeQL completed on `fb928d5ccf6ba11cffadb00adfd5846e4850c997`; GitHub confirmed successful SARIF upload and analysis completion. Review the repository's Code Scanning alerts for the current mainline.
- [x] Semgrep completed on `fb928d5ccf6ba11cffadb00adfd5846e4850c997`; 22 rules ran across 76 files with zero findings.
- [x] Gitleaks SARIF contained zero findings.
- [x] Dependency Review completed successfully.
- [x] Weekly Dependabot updates are configured for npm and GitHub Actions.
- [x] npm audit on `fb928d5ccf6ba11cffadb00adfd5846e4850c997` reported zero vulnerabilities.
- [ ] Latest-head Snyk scan is not verified: the workflow reported that `SNYK_TOKEN` is missing. Do not count this optional integration as a completed scan.
- [ ] Confirm the same zero-vulnerability result after the candidate is merged into `main`. The older main dependency tree previously reported 8 high and 1 moderate vulnerabilities.
- [x] All non-CodeQL third-party workflow actions are pinned to reviewed immutable commit SHAs and Node 24-compatible releases.
- [ ] Update checkout/upload-artifact references in the exact preserved CodeQL workflow to Node 24-compatible immutable pins after approval; current `@v4` references succeeded but emitted Node 20 deprecation warnings.
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
- [x] Gmail OAuth tokens and CV content use an HKDF-derived, domain-separated AES-256-GCM subkey; legacy ciphertext remains readable and is re-encrypted lazily.
- [ ] Add audited 2FA disable/recovery flow for users who lose both authenticator and recovery codes.
- [ ] Review OAuth account linking, verified-email handling, secure cookies, session revocation and expiry with real provider configuration.
- [ ] Test OTP replay/concurrency, brute force, privilege escalation, session expiry, account recovery and OAuth linking.

## 4. Abuse prevention, APIs and tenant isolation

- [x] Persistent IP/account rate limiting is implemented on inspected authentication and sensitive endpoints.
- [x] Spoofable X-Forwarded-For/X-Real-IP values are not trusted; the application expects a trusted edge-injected client-IP header with shared secret.
- [x] Streamed JSON body limits cover inspected auth, preference, application, saved-job, translation, recovery-code, admin-import and Gmail draft/send routes.
- [x] Streamed multipart byte limits cover CV uploads before form parsing.
- [x] Per-user rate limits cover Gmail connect, draft create/update/send and CV upload.
- [ ] Configure and verify trusted proxy header injection and restrict direct origin access in the actual Railway environment.
- [ ] Add rate-limit bucket cleanup, monitoring and alerting; validate thresholds and client-IP behavior behind the production proxy.
- [x] Disposable PostgreSQL migration and saved-job/application account-isolation integration tests passed on `0e701976e70849ec69c97f7715a8db69e5319f0a`.
- [ ] Expand ownership-scoped tests to every user-owned resource, including CV files, Gmail connections, preferences and every API read/update/delete/download path.
- [ ] Complete a live two-account test proving one user cannot access another user's data.
- [ ] Add malware scanning and quarantine for uploaded CVs; verify file signature, storage encryption, authorization and deletion.
- [ ] Verify logs redact passwords, OAuth codes, access/refresh tokens, CV contents and personal data.
- [ ] Add durable audit events for staff actions, account security changes and sensitive data access.

## 5. CI, database, deployment and operations

- [x] Candidate CI passed on `fb928d5ccf6ba11cffadb00adfd5846e4850c997`: `npm ci`, Prisma generation, unit tests, typecheck, disposable PostgreSQL integration tests and production build.
- [x] Migration Validation passed on `fb928d5ccf6ba11cffadb00adfd5846e4850c997`: migrations applied to disposable PostgreSQL, representative multi-user data inserted, account-isolation test passed, migration status confirmed and typecheck passed.
- [ ] Back up the real staging database and prove restore before applying migrations; compare row counts and data integrity afterward.
- [ ] Confirm `prisma migrate status` on staging and rehearse rollback.
- [ ] Confirm Railway project, service and environment; verify deployed SHA equals approved release SHA.
- [ ] Verify live health endpoint reports application and database healthy.
- [ ] Complete authenticated staging smoke tests for registration, login, 2FA, job search, saved jobs, applications and account separation.
- [ ] Verify encrypted backups, point-in-time recovery, monitoring, alerting, incident response and rollback.
- [ ] Add CSP and production HSTS after validating external resources.
- [ ] Configure WAF, DDoS/bot controls and origin restrictions appropriate to the hosting setup.

## 6. Gmail, privacy and independent assessment

- [x] Gmail OAuth/token and PDF MIME implementation plus deterministic binary-attachment/header tests exist.
- [x] Gmail/CV request-size limits, per-user rate limits and domain-separated encryption are implemented and passed CI.
- [ ] Complete authorised live Google OAuth consent, refresh-token test, Gmail draft read-back and PDF attachment byte/size verification in a designated test mailbox.
- [ ] Verify disconnect/revocation and account ownership with two separate test users.
- [ ] Do not send an external email without explicit user approval and a controlled test recipient.
- [ ] Complete privacy, retention, data-processing and cross-border transfer reviews for international users.
- [x] `SECURITY.md` provides private vulnerability-disclosure instructions.
- [ ] Enable GitHub private vulnerability reporting and verify the reporting route.
- [ ] Complete an independent penetration test and remediate findings.
- [ ] Complete an independent OWASP ASVS Level 2 assessment with evidence, reviewer and sign-off.

## Known optional integration

The DeepSeek PR-review workflow is now non-blocking when the provider is unavailable. The provider previously returned HTTP 402 for insufficient balance, so no independent DeepSeek review comment was produced. Fund the account if that second opinion is desired.

## Release decision

**NO-GO for production use with real customer data until all applicable unchecked gates are evidenced as passed on the exact release commit.**

The latest evidence above is from the candidate commit before this checklist-only update. The new commit must complete its own CI, CodeQL, dependency, Semgrep and full-history secret-audit runs before it is treated as the verified candidate.

Automated scans and CI pass on this candidate. The candidate PR remains unmerged; the older main dependency tree remains exposed to the previously reported advisories until the candidate is merged. A clean scan is not a security certification.
