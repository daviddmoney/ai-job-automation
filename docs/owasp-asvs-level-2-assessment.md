# OWASP ASVS Level 2 assessment register

**Target:** OWASP Application Security Verification Standard (ASVS) v5.0.0 Level 2  
**Assessment status:** In progress — not certified and not independently verified  
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

| Control area | Evidence | Status |
|---|---|---|
| Candidate CI | CI passed at candidate commit `d4b7996...`; rerun required after reconciliation | Automated check; rerun pending |
| Dependency audit | npm audit JSON reported zero vulnerabilities on candidate baseline; rerun required | Automated check; rerun pending |
| Snyk and Semgrep | Both jobs passed on candidate baseline; rerun required | Automated check; rerun pending |
| Historical secrets | Gitleaks full-history scan: 398 commits, 9 branches, no tags, no leaks on PR #7 hardening head | Passed for stated scan scope |
| Incremental secrets | Gitleaks false positive on published RFC 6238 test vector; narrow allowlist added | Rerun pending |
| CodeQL | SARIF upload succeeded on PR #7 hardening branch; final candidate run pending | Partial |
| Dependency Review | Passed on PR #7 hardening head; final candidate run pending | Partial |
| Migration validation | Disposable PostgreSQL migration and account-isolation workflow added | Run pending |
| Tenant isolation | Saved-job/application integration test exists; full resource coverage and live two-account test pending | Partial |
| Trusted proxy | Shared-secret proxy header gate implemented; actual edge proxy and origin restrictions need staging verification | Pending staging |
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
