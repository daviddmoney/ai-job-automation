# Public-release security and production-readiness audit

**Repository:** `daviddmoney/ai-job-automation`  
**Audit date:** 15 November 2026  
**Candidate commit:** `4215675c62ff72153e252ff05114a8cddcea9bcd`  
**Status:** Automated repository checks passed on this candidate; production release remains NO-GO pending operational and independent-assessment gates. This is not a certification.

## Source and reconciliation

- Main before reconciliation: `ef3105afe58e6637806d9568521a297cdc2da9d7`
- Candidate: `4215675c62ff72153e252ff05114a8cddcea9bcd`
- Candidate is 163 commits ahead and 0 behind current `main`; merge base is the current main commit.
- The five main-side commits were reconciled with a normal two-parent merge commit; no force-push was used.
- The exact current `main` CodeQL workflow and newer DeepSeek PR-review workflow were preserved.
- The previous main-side production-readiness snapshot was replaced with this evidence-based report.

## Automated evidence on the candidate commit

| Control | Evidence | Result |
|---|---|---|
| Full-history secret scan | Actions run #? — `Pre-publication secret audit` on `4215675c62ff72153e252ff05114a8cddcea9bcd` | PASS — 407 reachable commits, 9 fetched branches, no tags; Gitleaks reported no leaks; redacted SARIF retained |
| Incremental secret scan | `Security scans` on `4215675c62ff72153e252ff05114a8cddcea9bcd` | PASS — Gitleaks completed successfully after narrow RFC 6238 test-vector allowlist |
| Dependency audit | npm audit JSON artifact from `Security scans` on `4215675c62ff72153e252ff05114a8cddcea9bcd` | PASS — 0 info, 0 low, 0 moderate, 0 high, 0 critical across 197 dependencies |
| Snyk | `Security scans` on `4215675c62ff72153e252ff05114a8cddcea9bcd` | PASS |
| Semgrep | `Security scans` on `4215675c62ff72153e252ff05114a8cddcea9bcd` | PASS — source scan and SARIF artifact completed |
| Dependency Review | GitHub Dependency Review on `4215675c62ff72153e252ff05114a8cddcea9bcd` | PASS |
| CodeQL / SARIF | CodeQL on `4215675c62ff72153e252ff05114a8cddcea9bcd` | PASS — results successfully uploaded; upload status completed |
| Application CI | CI on `4215675c62ff72153e252ff05114a8cddcea9bcd` | PASS — `npm ci`, Prisma generation, unit tests, typecheck, disposable PostgreSQL integration tests and production build |
| Migration Validation | Migration Validation on `4215675c62ff72153e252ff05114a8cddcea9bcd` | PASS — migrations applied to disposable PostgreSQL, representative multi-user data inserted, account-isolation test passed, migration status confirmed and typecheck passed |

The previous incremental Gitleaks run without the custom config flagged one published RFC 6238 TOTP test vector in `tests/provider-hardening.test.mjs`. The narrow allowlist is limited to that exact value and file; all default Gitleaks rules remain enabled. The latest full-history and incremental scans passed after this correction.

## Findings and remaining release gates

1. **Credential exposure:** No Gitleaks findings were reported in the latest 407-commit, 9-branch scan. This does not rule out credentials outside Git history, unsupported formats, or exposures in external logs/provider dashboards. Rotate any credential known to have been exposed independently of this scan.
2. **Main branch dependency baseline:** The older `main` dependency tree reported 8 high and 1 moderate vulnerabilities. The candidate dependency tree reports zero; these fixes are not in `main` until the candidate PR is merged.
3. **Authentication and recovery:** Candidate implements Argon2id, email verification, encrypted TOTP, replay protection and recovery-code foundations. Audited 2FA disable/recovery, OAuth account-linking review, session revocation and full concurrency tests remain required.
4. **Tenant isolation:** Disposable PostgreSQL migration and saved-job/application isolation tests passed. Full ownership tests for all resources and a live two-account test remain required, including CVs, Gmail connections, preferences and all API paths.
5. **Abuse controls:** Persistent rate limits and trusted-proxy header validation are implemented. Production proxy configuration, origin restriction, rate-limit cleanup, alerting and abuse monitoring still need staging verification.
6. **Database:** Migrations passed against disposable CI PostgreSQL. A real staging backup/restore rehearsal, staging migration, data-integrity checks and rollback plan have not been evidenced.
7. **Railway:** Provider status checks alone do not prove the intended production environment, deployed commit SHA or database health. Verify the approved SHA, live health endpoint, authenticated flows and account isolation in staging.
8. **Gmail:** OAuth and binary PDF attachment code and MIME tests are present. Live consent, token refresh, draft read-back and PDF attachment verification in a designated test mailbox remain unverified. Do not send an external email without explicit approval.
9. **GitHub repository settings:** Branch protection/ruleset enforcement, private vulnerability reporting and secret-scanning/push-protection settings still require owner-side verification. The connected inspection could not read branch protection settings.
10. **Optional DeepSeek review:** The PR-review job failed with HTTP 402 (insufficient provider balance). This is an optional external review integration, not evidence of an application vulnerability; fund it or disable the optional review variable until service is available.
11. **Independent assurance:** No independent penetration-test report or OWASP ASVS Level 2 assessor sign-off has been supplied.

## Release decision

**NO-GO for production use with real customer data until the remaining staging, operational and independent-assessment gates are completed.**

Automated security checks and CI have passed on the stated candidate commit. A successful scanner run is not a security certification. No production migration, production deployment, live Gmail consent, or external email send was performed by this audit.
