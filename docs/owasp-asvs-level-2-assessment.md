# OWASP ASVS Level 2 assessment register

**Target:** OWASP Application Security Verification Standard (ASVS) v5.0.0 Level 2  
**Assessment status:** In progress — not certified and not independently verified  
**Candidate evidence commit:** `4215675c62ff72153e252ff05114a8cddcea9bcd`  
**Scope:** Web application, authentication, APIs, user data isolation, job ingestion, admin functions, deployment and CI/CD.  
**Release rule:** Do not mark a requirement passed without test evidence, reviewer, date and commit/deployment identifier.

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

## Evidence register

| Control area | Evidence on candidate `4215675c62ff72153e252ff05114a8cddcea9bcd` | Status |
|---|---|---|
| CI tests, typecheck and build | GitHub Actions CI passed | Automated check passed |
| Database migration and integration | Disposable PostgreSQL migrations and account-isolation test passed | Automated check passed; staging pending |
| Dependency audit | npm audit: zero vulnerabilities | Automated check passed |
| Snyk and Semgrep | Both security jobs passed | Automated checks passed |
| Historical secrets | Gitleaks scanned 407 commits across 9 branches, no tags; no leaks found | Passed for stated scan scope |
| Incremental secrets | Narrow RFC 6238 test-vector allowlist; Gitleaks passed | Passed |
| CodeQL | SARIF successfully uploaded to GitHub Code Scanning | Automated check passed |
| Dependency Review | GitHub Dependency Review passed | Automated check passed |
| Tenant isolation | Saved-job/application integration test passed | Partial; full resource coverage and live two-account test pending |
| Trusted proxy | Shared-secret proxy header gate implemented | Pending staging configuration |
| JSON request limits | Explicit body limits on inspected sensitive JSON routes | Partial; audit remaining routes |
| Independent penetration test | No report supplied | Not tested |
| ASVS Level 2 independent assessment | No evidence package or assessor sign-off | Not tested |

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
