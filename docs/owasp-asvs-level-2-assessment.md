# OWASP ASVS Level 2 assessment register

**Target:** OWASP Application Security Verification Standard (ASVS) v5.0.0 Level 2  
**Assessment status:** In progress — automated evidence is available; independent assessment and production verification are not complete.  
**Automated evidence candidate:** `2fc99a0249f19e5155597c76f5c18f075b495f47`  
**Scope:** Web application, authentication, APIs, user data isolation, job ingestion, admin functions, deployment and CI/CD.  
**Release rule:** Do not mark an ASVS requirement passed without test evidence, reviewer, date and commit/deployment identifier.

## Assessment method

1. Pin the ASVS version and use the official requirements/checklist from OWASP.
2. Map every applicable Level 2 requirement to a test case and evidence artifact.
3. Test in an isolated Railway staging environment with synthetic accounts and data.
4. Include USER, STAFF and unauthenticated roles; test cross-account access attempts.
5. Record each result as PASS, FAIL, NOT APPLICABLE (with reason), or NOT TESTED.
6. Fix findings, retest, and obtain independent review before public launch.
7. Repeat after material changes and at least annually.

## Required verification domains

- Architecture, threat modelling and secure design
- Authentication, authenticator lifecycle, recovery, replay and brute-force resistance
- Session management, cookies, logout and token invalidation
- Access control, privilege escalation and tenant isolation
- Validation, sanitisation, output encoding and injection resistance
- Cryptography, key management, secrets and sensitive data protection
- Error handling, logging, audit trails and monitoring
- Data protection, retention, privacy and deletion
- Communications security, TLS and trusted proxy configuration
- Malicious file upload, storage, download and malware quarantine
- API security, request size limits, rate limits and resource exhaustion
- Business logic, job ingestion, queue leases and race conditions
- Configuration, deployment, dependencies, CI/CD and supply-chain security

## Automated evidence register

All rows below are tied to candidate `2fc99a0249f19e5155597c76f5c18f075b495f47` and the GitHub Actions runs recorded in `SECURITY_CHECKLIST.md`.

| Control area | Evidence | Status |
|---|---|---|
| CI tests, typecheck and build | CI passed; 19 unit tests and 2 PostgreSQL integration tests passed | Automated PASS |
| Database migration | Five migrations applied to disposable PostgreSQL; migration status and typecheck passed | Automated PASS; staging pending |
| Dependency audit | npm audit reported 0 vulnerabilities | Automated PASS |
| Snyk | 76 dependencies tested; 0 issues and 0 vulnerable paths at high threshold | Automated PASS |
| Semgrep | 22 rules across 77 source files; 0 findings | Automated PASS |
| Historical secrets | Gitleaks 8.30.1 scanned 449 commits from 11 fetched branches; 461 reachable commits; no tags; 0 findings | Automated PASS for scanned Git refs |
| Incremental secrets | Gitleaks scan passed | Automated PASS |
| CodeQL | Analysis completed; SARIF uploaded and accepted by GitHub | Automated PASS; alert listing not independently inspected |
| Dependency Review | Pull-request dependency review passed | Automated PASS |
| Queue lease safety | Stale/reclaimed/expired worker cannot overwrite a posting; integration test passed | Automated PASS |
| Trusted proxy identity | Spoofed/missing/incorrect/malformed header and IPv4/IPv6 tests passed | Automated PASS; live edge configuration pending |
| Jooble provider reporting | Partial and all-failed keyword reporting tests passed | Automated PASS |
| Gmail/CV request controls | Streamed JSON/multipart limits and per-user rate limits; tests passed | Automated PASS; live staging pending |
| Gmail/CV encryption | HKDF-derived domain-separated AES-256-GCM and compatibility tests passed | Automated PASS; key rotation policy pending |
| Tenant isolation | Saved-job/application account-isolation integration test passed | Partial; broader resource coverage and live two-account test pending |
| Malware scanning | No production malware scanner/quarantine evidence | Not tested |
| Trusted proxy deployment | Shared-secret gate implemented; actual Railway/edge injection and origin restriction unverified | Not tested |
| Independent penetration test | No report supplied | Not tested |
| ASVS Level 2 independent assessment | No evidence package or assessor sign-off | Not tested |

## Production and owner gates

- GitHub Secret Scanning, push protection and private vulnerability reporting settings require owner verification.
- No repository rulesets were returned by the available read endpoint; classic branch protection could not be read by the connected integration.
- Railway deployed SHA, live health, trusted proxy configuration, database backup/restore and rollback remain unverified.
- Live Gmail OAuth and PDF attachment tests remain pending.
- CV malware scanning/quarantine and expanded tenant-isolation tests remain pending.
- Privacy, retention and cross-border transfer reviews remain pending.

## Out of scope until separately authorised

- Production penetration testing or exploitation
- Production database migrations or destructive tests
- Access to real customer CVs or personal data

## Sign-off

- Engineering owner: pending
- Independent assessor: pending
- Assessment date and release commit: pending
- Residual-risk acceptance: pending

This register is an assessment plan and evidence tracker, not an OWASP certification. OWASP publishes the standard; this checklist does not certify the application.
