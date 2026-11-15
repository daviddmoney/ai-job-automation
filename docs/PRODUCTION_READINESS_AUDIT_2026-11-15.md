# Production readiness audit — 15 November 2026

## Scope and method

This snapshot independently inspects the repository's current `main` branch and compares it with the open remediation work. It does not claim access to Railway runtime logs, staging database credentials/data, Google OAuth consent, or a real user session.

## Production source of truth

- Repository: `daviddmoney/ai-job-automation`
- Branch: `main`
- Latest commit observed: `46dd5338192750ceac74884efacea7cc71828af4`
- Commit: https://github.com/daviddmoney/ai-job-automation/commit/46dd5338192750ceac74884efacea7cc71828af4

## Findings

| Area | Result | Evidence and interpretation |
|---|---|---|
| Main-branch CI | FAIL / incomplete | `.github/workflows/ci.yml` on main runs install, Prisma generation, typecheck and build. It does not configure a PostgreSQL service, run the database integration suite, or validate migrations. No CI status check appeared in the combined status returned for the observed main SHA. |
| CodeQL / Code Scanning | FAIL on main | `.github/workflows/codeql.yml` is absent from main. The prior security feature branch's CodeQL workflow explicitly used `upload: never` and only uploaded a SARIF artifact. An artifact is not Code Scanning ingestion. PR #6 adds a mainline workflow with `upload: always`; it remains an unmerged draft and requires Code Security entitlement/availability plus an observed successful upload and visible alert listing. |
| Dependency/security checks | NOT VERIFIED on main | Main's package manifest still specifies Next.js `^15.5.6` and Nodemailer `^7.0.10`. Security scan workflows exist in feature-branch PR #1, not on main. Current scan results for main were not established in this audit. |
| Staging migration | NOT VERIFIED | PR #1 includes a migration-validation workflow that applies migrations to a disposable PostgreSQL service and runs integration tests. Its runbook explicitly states this does not replace validation against the actual staging database. No staging migration status, backup/restore proof, or before/after data integrity evidence was supplied. |
| Tenant isolation | PARTIAL / NOT VERIFIED end to end | Feature-branch test `tests/database-isolation.integration.mjs` checks that saved jobs and applications queried by userId are not visible to another test user. This is useful but does not establish isolation across every user-owned resource, CV files, Gmail connections, preferences, API authorization paths, or a live two-account smoke test. |
| Railway deployment | PARTIAL | Main's combined status for commit `46dd533...` returned two green Railway status checks. They identify two Railway services/environments, but do not prove which one is the intended production environment, the deployed commit SHA, a live `/api/health` response with `database: ok`, or a real-user smoke test. The health endpoint and Railway healthcheck configuration are present in the feature PR, not main. |
| Gmail OAuth and PDF attachment | PARTIAL / NOT VERIFIED live | Feature-branch code implements OAuth token exchange/refresh and PDF MIME attachment creation; MIME unit tests check exact attachment bytes and header sanitisation. No authorised live OAuth connection, token refresh against Google, real Gmail draft verification, or explicit test send/receipt was evidenced. |
| Branch consolidation | INCOMPLETE | PR #1 contains substantial global/multilingual/security/database/deployment work and remains open. PR #4 is an open Dependabot update. PR #6 is a new draft PR for the CodeQL upload fix. The feature work must be rebased/validated against current main before merging; do not assume old feature-branch checks certify current main. |

## Changes made in this remediation pass

1. Created branch `fix/production-readiness-sarif-mainline` from the observed main SHA.
2. Added `.github/workflows/codeql.yml` with CodeQL analysis and `upload: always`, while preserving a SARIF artifact for audit.
3. Opened draft PR #6: https://github.com/daviddmoney/ai-job-automation/pull/6
4. The PR is not merged. Its workflow has not yet produced verifiable run/check results in the evidence available at audit time.

## Required launch gates

1. Enable GitHub Code Security/code scanning for this private repository if available on the repository's plan. Verify PR #6 CodeQL run succeeds, SARIF is accepted, and findings are visible under Security > Code scanning alerts.
2. Consolidate PR #1 and related branches onto current main. Resolve conflicts and ensure Next.js/dependency updates, Gmail attachment code, migration files, tenant tests, Railway config and docs are all in the resulting mainline before considering a release.
3. Run all required CI and security workflows on the exact candidate release commit. Include a real PostgreSQL service in CI and the relevant database/tenant integration tests.
4. Back up the real staging database and verify that the backup is restorable. Apply the exact latest Prisma migrations to staging, confirm `prisma migrate status`, compare representative row counts, and run separate-account smoke tests. Preserve logs and results as release evidence.
5. Identify the intended Railway project, service and environment. Confirm the deployed commit SHA matches the approved candidate; call the live `/api/health` endpoint and verify `status: ok` and `database: ok`; perform a real-user smoke test for sign-in, job search, saved jobs, application tracking and account separation.
6. Complete an explicitly authorised Gmail OAuth test using a designated test account. Verify consent/scopes, refresh-token persistence, create a draft containing a non-sensitive test PDF, inspect the attachment in Gmail, and only send to a controlled test recipient after explicit approval.
7. Produce a final release report with immutable commit SHA, workflow run links, Code Scanning evidence, staging migration/backup evidence, Railway environment/deployment evidence, health response and smoke-test results.

## Launch decision

**NO-GO / NOT READY TO LAUNCH based on evidence currently available.**

This is an evidence-based hold, not a claim that every implementation is defective. The repository contains useful feature-branch implementations, and the latest main commit has green Railway provider status checks, but the required checks have not all been demonstrated on the current production branch and the real staging/live environment evidence is missing.

No production migration, production deployment, live OAuth consent, or email send was performed by this audit.
