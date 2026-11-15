# Public-release security and production-readiness audit

**Repository:** `daviddmoney/ai-job-automation`  
**Audit date:** 15 November 2026  
**Status:** Evidence-based assessment in progress; not a certification.

## Scope and source commits

- Main before reconciliation: `ef3105afe58e6637806d9568521a297cdc2da9d7`
- Global/multilingual candidate before reconciliation: `d4b7996d9cc5dfe5f0e733c793bea2aec24e337f`
- Merge base: `a486f0993f706f0d1f048d0372b7eb650c9c92f2`
- Main contained 5 commits not yet present on the candidate.
- The main-side changes were limited to CodeQL workflow, DeepSeek PR-review workflow and the previous production-readiness snapshot. The candidate already had the exact same CodeQL workflow blob as main. The reconciliation preserves main's exact CodeQL workflow and exact newer DeepSeek workflow; the outdated snapshot is replaced by this report.

## Confirmed automated evidence

| Control | Evidence | Result |
|---|---|---|
| Historical secret scan | Gitleaks full-history Actions run #18 on PR #7 head `068d9816152188652f328cde4cc24bf1a49f3315` | PASS — 398 reachable commits, 9 fetched branches, no tags; Gitleaks reported `no leaks found`; redacted SARIF artifact retained |
| Dependency audit | Candidate branch Actions run #222; npm audit JSON artifact | PASS — 0 info, 0 low, 0 moderate, 0 high and 0 critical vulnerabilities in the audited candidate dependency tree |
| Snyk | Candidate branch Security scans run on `d4b7996d9cc5dfe5f0e733c793bea2aec24e337f` | PASS — scan job completed successfully |
| Semgrep | Same Security scans run | PASS — source scan and SARIF artifact completed successfully |
| Candidate CI | CI run on `d4b7996d9cc5dfe5f0e733c793bea2aec24e337f` | PASS — `npm ci`, Prisma generation, unit tests, TypeScript, disposable PostgreSQL integration tests and production build |
| Dependency Review | PR #7 dependency-review run on the security hardening branch | PASS — action completed successfully |
| CodeQL SARIF ingestion | CodeQL run on PR #7 main-based hardening branch | PASS — log states results were successfully uploaded and upload status completed |

These results apply to the exact commits and workflows stated. They must be rerun on the reconciled candidate commit before merge/release. The CodeQL result above is not a substitute for a fresh run on the final candidate.

## Findings and remaining release gates

1. **Public history:** No Gitleaks findings were reported in the scan scope. This does not rule out credentials outside Git history, unsupported secret formats, or exposure in external logs/artifacts/provider dashboards. Rotate any credential known to have been exposed independently of this scan.
2. **Authentication and account recovery:** The candidate implements Argon2id, email verification, encrypted TOTP, replay protection and recovery-code foundations. Reauthentication-protected recovery/2FA disable flows, OAuth account-linking review, session revocation and full concurrency tests still require review and evidence.
3. **Tenant isolation:** A disposable PostgreSQL integration test exists and passed in candidate CI. Full ownership tests for every user-owned resource and a live two-account test remain required, including CVs, Gmail connections, preferences, saved jobs and applications.
4. **Abuse controls:** Persistent rate limits and trusted-proxy header validation are implemented. Production proxy configuration, rate-limit cleanup, alerting and abuse monitoring still need staging verification.
5. **Database:** CI migration/integration checks passed against disposable PostgreSQL. A real staging backup/restore rehearsal, migration execution, data-integrity checks and rollback plan have not been evidenced.
6. **Railway:** Provider status checks alone do not prove the intended production environment, deployed commit SHA or database health. Verify the approved SHA, live health endpoint, authenticated flows and account isolation in staging.
7. **Gmail:** OAuth and binary PDF attachment code and MIME tests are present. Live consent, token refresh, draft round-trip and PDF attachment verification in a designated test mailbox remain unverified. Do not send an external email without explicit approval.
8. **GitHub repository settings:** Branch protection/ruleset enforcement, private vulnerability reporting and secret-scanning/push-protection settings still require owner-side verification. The connected inspection could not read branch protection settings.
9. **Optional DeepSeek review:** A PR review job failed with HTTP 402 (insufficient provider balance). This is an optional external review integration, not evidence of an application vulnerability; either fund it or disable the optional review variable until service is available.

## Release decision

**NO-GO for production use with real customer data until the remaining staging, operational and independent-assessment gates are completed.**

The candidate's dependency/security workflows and tests provide meaningful evidence, but a successful scanner run is not a security certification. No production migration, production deployment, live Gmail consent, or external email send was performed by this audit.
