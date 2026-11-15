# Public-release security checklist

**Repository:** `daviddmoney/ai-job-automation`  
**Visibility:** Public  
**Automated evidence candidate:** `2fc99a0249f19e5155597c76f5c18f075b495f47`  
**Assessment date:** 2026-11-15  
**Automated evidence status:** PASS on the stated candidate and workflow runs.  
**Public production release status:** NO-GO — operational, platform-setting and independent-assessment gates remain open.  
**Certification scope:** This is an engineering-issued attestation of automated checks, not an independent penetration-test report, OWASP certification, or guarantee of vulnerability-free software.

## 1. Automated evidence — verified on the same candidate commit

- [x] Repository is public.
- [x] CI workflow passed: run [#43735386883](https://github.com/daviddmoney/ai-job-automation/actions/runs/43735386883).
- [x] Migration Validation passed: run [#43735386819](https://github.com/daviddmoney/ai-job-automation/actions/runs/43735386819).
- [x] Security scans passed: run [#43735386894](https://github.com/daviddmoney/ai-job-automation/actions/runs/43735386894).
- [x] CodeQL passed and SARIF upload/analysis completed: run [#43735386992](https://github.com/daviddmoney/ai-job-automation/actions/runs/43735386992). The connector did not expose the current alert listing, so this checklist does not claim a zero-alert count.
- [x] Full-history Gitleaks audit passed: run [#43735386857](https://github.com/daviddmoney/ai-job-automation/actions/runs/43735386857).
- [x] Dependency Review passed: run [#43735386860](https://github.com/daviddmoney/ai-job-automation/actions/runs/43735386860).
- [x] Automated DeepSeek PR-review workflow completed successfully: run [#43735386956](https://github.com/daviddmoney/ai-job-automation/actions/runs/43735386956). This is not a substitute for human approval or independent review.
- [x] Unit tests: 19 passed, 0 failed.
- [x] PostgreSQL integration tests: 2 passed, 0 failed, including stale/reclaimed/expired queue-lease write prevention.
- [x] TypeScript typecheck and production build passed.
- [x] Five Prisma migrations applied successfully to disposable PostgreSQL; migration status and schema access checks passed.
- [x] npm audit reported 0 vulnerabilities.
- [x] Snyk tested 76 dependencies and reported 0 issues and 0 vulnerable paths at the configured high-severity threshold.
- [x] Semgrep ran 22 rules across 77 source files and reported 0 findings.
- [x] Incremental Gitleaks scan passed.

### Historical secret audit evidence

- Gitleaks version: 8.30.1 (pinned binary; SHA-256 verified before execution).
- Reachable commits in the fetched checkout: 461.
- Remote branches fetched: 11.
- Commits scanned by Gitleaks: 449.
- Tags fetched: none.
- Findings: 0.
- Result: `no leaks found`.
- A redacted SARIF report was uploaded as a workflow artifact.
- [x] No confirmed credential exposure was found in the scanned Git history. No credential rotation or destructive history rewrite is justified by this scan.
- [ ] Continue to review external provider dashboards, deployment logs, Actions logs/artifacts, PRs, issues and releases; Git history scanning cannot prove that credentials were never exposed elsewhere.

### Security-related code fixes and regression coverage

- [x] Queue-owned job writes now verify task id, PROCESSING state, exact lock token and unexpired lease under `SELECT ... FOR UPDATE` in the same transaction as the JobPosting upsert.
- [x] Worker lease renewal runs every 15 seconds and fails closed if ownership cannot be confirmed.
- [x] Regression test confirms a reclaimed or expired worker cannot overwrite a posting.
- [x] Jooble reports per-keyword success/failure; partial and all-failed cases have regression tests.
- [x] Trusted client-IP identity logic is isolated and tested against spoofed forwarding headers, missing/incorrect tokens, invalid addresses, IPv4/IPv6 and stable hashed rate-limit keys.
- [x] CodeQL workflow checkout and artifact actions were updated to immutable Node 24-compatible action pins.
- [x] Both P2 stale-worker review threads on PR #1 have been replied to with test evidence and resolved.

## 2. GitHub repository controls — still require owner verification

- [x] Public repository visibility confirmed.
- [x] Dependabot weekly update configuration is present.
- [ ] Verify and enable GitHub Secret Scanning.
- [ ] Verify and enable secret-scanning push protection.
- [ ] Verify Dependabot alerts and security updates are enabled in repository settings.
- [ ] Enable and test private vulnerability reporting.
- [ ] Protect `main`: require pull requests, required CI/security checks, approvals, no force-push and no branch deletion.
- [ ] No repository rulesets were returned by the available read endpoint. Classic branch-protection read was denied to the connected integration (HTTP 403), so the actual branch-protection state remains unverified.
- [ ] Review the GitHub Code Scanning alerts page after the SARIF upload; a successful upload alone does not prove the alert list is empty.

## 3. Authentication, authorization and account security

- [x] Server-side registration assigns USER role.
- [x] Password hashing uses Argon2id.
- [x] Email-verification challenges are hashed, expire and have attempt limits.
- [x] TOTP secrets use AES-256-GCM encryption.
- [x] Atomic TOTP replay protection and one-time hashed recovery-code consumption are implemented.
- [x] Recovery-code regeneration requires password and fresh TOTP; codes are returned once and stored hashed.
- [x] Database-backed staff authorization and controlled staff promotion are implemented.
- [ ] Add and independently review a secure 2FA recovery/disable path for a user who loses both authenticator and recovery codes.
- [ ] Test OAuth account linking, verified-email handling, session revocation/expiry, secure cookies, brute-force resistance and privilege escalation against real provider configuration.
- [ ] Review whether NextAuth provider tokens stored in the adapter Account table require encryption or scope minimisation.

## 4. API abuse prevention, uploads and tenant isolation

- [x] Persistent database rate limiting and request-size limits are implemented on inspected sensitive routes.
- [x] Spoofable X-Forwarded-For/X-Real-IP headers are not trusted by the application helper.
- [x] Proxy identity is accepted only when the edge-provided IP is valid and accompanied by the shared token.
- [ ] Configure the actual Railway/edge proxy to strip client-supplied identity headers, overwrite them, inject the secret and prevent direct-origin bypass. Without this deployment configuration, IP identity falls back to `unknown`.
- [ ] Add rate-limit bucket cleanup, alerting and production proxy-behaviour verification.
- [x] Disposable PostgreSQL account-isolation tests pass for saved jobs and applications.
- [ ] Extend ownership tests to CV files, Gmail connections, preferences and every user-owned API read/update/delete/download path.
- [ ] Complete live two-account isolation tests.
- [x] CV uploads enforce streamed byte limits, PDF MIME/extension and file-signature checks, and encrypted database storage.
- [ ] Add malware scanning/quarantine, secure download review and retention/deletion tests before accepting real CVs.
- [ ] Verify logs redact credentials, OAuth codes/tokens, CV contents and personal data.
- [ ] Add and verify durable audit events for staff actions and sensitive account/data changes.

## 5. Database, deployment and operations

- [x] Disposable PostgreSQL migration validation passed.
- [x] Disposable PostgreSQL integration tests passed.
- [ ] Back up the actual staging database and prove restore before migration; compare row counts and data integrity.
- [ ] Reconcile and rehearse staging migrations and rollback.
- [ ] Verify the actual Railway project/service/environment and deployed SHA.
- [ ] Verify the live health endpoint and database connectivity.
- [ ] Complete authenticated staging smoke tests for registration, login, 2FA, job search, saved jobs, applications, translation and account separation.
- [ ] Verify encrypted backups, point-in-time recovery, monitoring, alerting, incident response and rollback.
- [ ] Validate CSP, HSTS, WAF/bot controls and direct-origin restrictions in the real deployment.
- [ ] Verify rate-limit edge configuration with real requests.

## 6. Gmail, privacy and independent assurance

- [x] Gmail token/CV encryption and binary PDF MIME tests pass.
- [x] Gmail/CV request-size limits and per-user rate limits pass CI.
- [ ] Complete authorised live Google OAuth consent, refresh-token, Gmail draft read-back and PDF attachment verification in a designated test mailbox.
- [ ] Verify Gmail disconnect/revocation and account ownership with two test users.
- [ ] Do not send external email without explicit approval and a controlled recipient.
- [ ] Complete privacy, retention, data-processing and cross-border transfer reviews for international users.
- [x] `SECURITY.md` documents private vulnerability disclosure instructions.
- [ ] Verify GitHub private vulnerability reporting is enabled.
- [ ] Complete an independent penetration test and remediate findings.
- [ ] Complete an independent OWASP ASVS Level 2 assessment with evidence and independent assessor sign-off.

## Release decision

**AUTOMATED SECURITY EVIDENCE: PASS** for candidate `2fc99a0249f19e5155597c76f5c18f075b495f47` and the seven successful workflow runs listed above.

**PUBLIC PRODUCTION RELEASE: NO-GO** until all applicable owner/platform, staging, live OAuth, upload-malware, tenant-isolation, privacy and independent-assessment gates are closed on the exact release commit.

The candidate PR remains open and unmerged. The automated pass on the feature candidate does not transfer to the current `main` branch or a Railway deployment until those exact revisions are verified. Do not accept real customer CVs or personal data based solely on this automated evidence.
