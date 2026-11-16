# Public-release security and production-readiness audit

**Repository:** `daviddmoney/ai-job-automation`  
**Audit date:** 15 November 2026  
**Candidate commit:** `0e701976e70849ec69c97f7715a8db69e5319f0a`  
**Candidate PR:** #1 (open; 106 changed files; 191 commits; 0 commits behind current main)  
**Status:** Automated repository checks passed on this candidate. Production release remains NO-GO pending operational and independent-assessment gates. This is not a formal certification.

## Source and reconciliation

- Main before reconciliation: `ef3105afe58e6637806d9568521a297cdc2da9d7`
- Candidate commit: `0e701976e70849ec69c97f7715a8db69e5319f0a`
- Candidate branch is 191 commits ahead and 0 behind `main`; merge base is current main.
- The five main-side commits were reconciled with a normal two-parent merge commit; no force-push was used.
- The exact newer `main` CodeQL SARIF workflow was preserved.
- All non-CodeQL third-party workflow actions are pinned to immutable commit SHAs and Node 24-compatible releases. The exact CodeQL workflow retains its original `@v4` checkout/upload-artifact references and logs a non-blocking Node 20 deprecation warning.
- The obsolete privileged Next.js upgrade workflow with `contents: write` and an automatic branch push was removed after the upgrade was completed.

## Automated evidence on the candidate commit

| Control | Evidence | Result |
|---|---|---|
| Full-history secret scan | Actions run #43732745783 | PASS — 435 reachable commits, 9 fetched branches, no tags; Gitleaks v8.30.1 reported no leaks; redacted SARIF retained |
| Incremental secret scan | Security scans run #43732745842 | PASS — Gitleaks SARIF contained 0 results |
| Dependency audit | npm audit artifact from run #43732745842 | PASS — 0 info, 0 low, 0 moderate, 0 high, 0 critical across 197 dependencies |
| Snyk | Security scans run #43732745842 | PASS — 76 dependencies tested, 0 issues and 0 vulnerable paths at high-severity threshold |
| Semgrep | Security scans run #43732745842 | PASS — uploaded SARIF contained 0 results |
| Dependency Review | Actions run #43732745841 | PASS |
| CodeQL / SARIF | Actions run #43732745884 | PASS — successful upload; SARIF contained 0 results; upload status complete |
| Application CI | Actions run #43732745854 | PASS — `npm ci`, Prisma generation, unit tests, typecheck, disposable PostgreSQL integration tests and production build |
| Migration Validation | Actions run #43732745762 | PASS — migrations applied to disposable PostgreSQL, representative multi-user data inserted, account-isolation test passed, migration status confirmed and typecheck passed |
| DeepSeek review | Actions run #43732745732 | Workflow non-blocking; provider review unavailable due insufficient balance, so no review comment was published |

The earlier incremental Gitleaks scan flagged one published RFC 6238 TOTP test vector in `tests/provider-hardening.test.mjs`. The narrow allowlist is limited to that exact value and file; default Gitleaks rules remain enabled. The subsequent full-history and incremental scans passed with zero findings.

## Additional application hardening

- Gmail draft create/update/send routes now enforce streamed JSON request-size limits.
- CV uploads enforce a streamed multipart byte ceiling before form parsing.
- Gmail connect, draft create/update/send and CV upload now have per-user rate limits.
- Gmail OAuth tokens and CV documents use an HKDF-derived, domain-separated AES-256-GCM subkey. Legacy ciphertext remains readable and is re-encrypted lazily.
- New tests cover multipart request limits and Gmail encryption/domain separation; the complete candidate CI test suite passed.
- DeepSeek review is optional and non-blocking when the external provider is unavailable.

## Findings and remaining release gates

1. **Credential exposure:** No Gitleaks findings were reported in the latest 435-commit, 9-branch scan. This does not rule out credentials outside Git history, unsupported formats, or exposures in external logs/provider dashboards. Rotate any credential known to have been exposed independently of this scan.
2. **Main branch dependency baseline:** The older `main` dependency tree reported 8 high and 1 moderate vulnerabilities. The candidate dependency tree reports zero; these fixes are not in `main` until PR #1 is merged.
3. **Authentication and recovery:** Candidate implements Argon2id, email verification, encrypted TOTP, replay protection and recovery-code foundations. Audited 2FA disable/recovery, OAuth account-linking review, session revocation and full concurrency tests remain required.
4. **Tenant isolation:** Disposable PostgreSQL migration and saved-job/application isolation tests passed. Full ownership tests for all resources and a live two-account test remain required, including CVs, Gmail connections, preferences and all API paths.
5. **Abuse controls:** Persistent rate limits and trusted-proxy header validation are implemented. Production proxy configuration, origin restriction, rate-limit cleanup, alerting and abuse monitoring still need staging verification.
6. **Database:** Migrations passed against disposable CI PostgreSQL. A real staging backup/restore rehearsal, staging migration, data-integrity checks and rollback plan have not been evidenced.
7. **Railway:** Provider status checks alone do not prove the intended production environment, deployed commit SHA or database health. Verify the approved SHA, live health endpoint, authenticated flows and account isolation in staging.
8. **Gmail:** OAuth and binary PDF attachment code and MIME tests are present. Live consent, token refresh, draft read-back and PDF attachment verification in a designated test mailbox remain unverified. Do not send an external email without explicit approval.
9. **GitHub repository settings:** Branch protection/ruleset enforcement, private vulnerability reporting and native secret-scanning/push-protection settings still require owner-side verification. The connected inspection could not read branch protection settings.
10. **Independent assurance:** No independent penetration-test report or OWASP ASVS Level 2 assessor sign-off has been supplied.

## Release decision

**NO-GO for production use with real customer data until the remaining staging, operational and independent-assessment gates are completed.**

Automated security checks and application CI have passed on the stated candidate commit. The candidate PR remains unmerged; therefore the previous main dependency advisories remain on the public default branch. A successful scanner run is not a security certification. No production migration, production deployment, live Gmail consent, or external email send was performed by this audit.
