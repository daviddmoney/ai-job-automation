# Automated Security Evidence Attestation

**Project:** AI Job Automation  
**Repository:** https://github.com/daviddmoney/ai-job-automation  
**Visibility:** Public  
**Candidate commit assessed:** `2fc99a0249f19e5155597c76f5c18f075b495f47`  
**Assessment date:** 2026-11-15  
**Assessment type:** Automated engineering evidence review

## Attestation

The seven GitHub Actions workflows associated with candidate commit `2fc99a0249f19e5155597c76f5c18f075b495f47` completed successfully:

| Workflow | Run | Result |
|---|---:|---|
| CI | 43735386883 | PASS |
| Migration Validation | 43735386819 | PASS |
| Security scans | 43735386894 | PASS |
| CodeQL | 43735386992 | PASS |
| Pre-publication secret audit | 43735386857 | PASS |
| Dependency Review | 43735386860 | PASS |
| DeepSeek PR review workflow | 43735386956 | PASS |

## Measured evidence

- Unit tests: 19 passed, 0 failed.
- PostgreSQL integration tests: 2 passed, 0 failed.
- TypeScript typecheck: passed.
- Production build: passed.
- Prisma migrations: five applied successfully to disposable PostgreSQL; migration status and schema checks passed.
- npm audit: 0 vulnerabilities.
- Snyk: 76 dependencies; 0 issues and 0 vulnerable paths at the high-severity threshold.
- Semgrep: 22 rules across 77 source files; 0 findings.
- CodeQL: analysis completed; SARIF upload accepted by GitHub and analysis upload status completed. This attestation does not state a zero-alert count because the current alert listing was not independently inspected.
- Dependency Review: passed.
- Gitleaks 8.30.1 historical scan: 461 reachable commits, 11 fetched remote branches, 449 commits scanned, no tags fetched, 0 findings. Redacted SARIF artifact uploaded.
- Incremental Gitleaks: passed.

## Remediations included in the candidate

1. Atomic queue lease fencing: each queue-owned JobPosting upsert verifies the task id, PROCESSING state, lock token and unexpired lease under `SELECT ... FOR UPDATE` in the same transaction as the write.
2. Lease heartbeat: worker renews every 15 seconds and fails closed if ownership cannot be confirmed.
3. Stale-worker regression: integration test proves reclaimed or expired workers cannot overwrite a posting.
4. Jooble provider reporting: keyword-level partial/all-failed outcomes are retained and tested.
5. Trusted proxy identity: spoofed forwarding headers are ignored unless a valid edge token and valid client IP are supplied; IPv4/IPv6 and hashed-key tests pass.
6. CodeQL workflow action references use immutable Node 24-compatible pins.

## Limitations and exclusions

This is an engineering attestation of automated checks only. It is not:

- An independent penetration-test report.
- An OWASP ASVS Level 2 certification.
- A guarantee that the code is free of vulnerabilities.
- Proof that GitHub Secret Scanning, push protection or branch protection settings are enabled.
- Proof of Railway production deployment, live health, production database backup/restore or rollback.
- Proof of live Gmail OAuth, PDF delivery, malware scanning/quarantine, complete tenant isolation or privacy-law compliance.

The candidate PR remains open and unmerged. The evidence does not automatically certify the current `main` branch or any deployed environment.

## Release conclusion

**Automated security evidence: PASS for the exact candidate commit stated above.**

**Public production release clearance: NOT GRANTED.** The remaining owner/platform, staging, operational and independent-assessment gates are recorded in `SECURITY_CHECKLIST.md` and `docs/owasp-asvs-level-2-assessment.md`.

Signed by: Automated engineering evidence review  
Date: 2026-11-15
