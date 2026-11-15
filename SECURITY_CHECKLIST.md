# Public-release security checklist

**Repository:** `daviddmoney/ai-job-automation`  
**Visibility:** Public  
**Policy:** A checked implementation item is not considered verified until its required automated or operational test has passed. Do not describe this checklist as a certification.

## 1. Repository exposure and credentials

- [x] `.gitignore` excludes `.env` and `.env.*`, while allowing the placeholder-only `.env.example`.
- [ ] Complete a Gitleaks scan of all reachable commits, branches and tags; retain the redacted SARIF report.
- [ ] Review every Gitleaks finding; distinguish test fixtures from real credentials.
- [ ] Revoke and rotate every confirmed exposed credential (Google OAuth, Gmail, Railway, database, job-board, translation, email, AI provider, GitHub tokens).
- [ ] If secrets were exposed, remove them from Git history using a coordinated history-rewrite plan, then verify the rewritten history and coordinate fresh clones. Do not rely on deleting a file in a later commit.
- [ ] Enable GitHub Secret Scanning and push protection where available; verify the repository settings and test a safe dummy canary without publishing a real credential.
- [ ] Confirm no secrets are present in Actions logs, artifacts, PR diffs, issues, releases, or public documentation.
- [ ] Keep production secrets only in the hosting provider's secret manager and GitHub Actions secrets/variables where strictly required.

## 2. Static analysis and dependency security

- [x] CodeQL workflow is present on `main` and requests SARIF upload with `security-events: write`.
- [ ] Run CodeQL against the current `main`; verify the run succeeds and findings appear in Security → Code scanning alerts.
- [ ] Run Gitleaks full-history workflow and confirm a clean exit status.
- [x] Add weekly Dependabot configuration for npm and GitHub Actions on this branch.
- [ ] Merge and verify Dependabot security updates on `main`; enable dependency graph and review alerts.
- [ ] Run `npm audit --audit-level=high` against the committed lockfile; review and resolve high/critical advisories.
- [ ] Add and verify Semgrep or equivalent application security rules on `main`.
- [ ] Pin third-party GitHub Actions to reviewed immutable commit SHAs and define least-privilege workflow permissions.
- [ ] Protect `main`: require reviewed pull requests and successful CI/security checks; disallow force pushes and deletion.

## 3. Application authentication and authorization

- [x] Registration assigns the USER role server-side; public registration must not accept a staff role.
- [x] Password hashing uses Argon2id.
- [x] Email verification challenges are hashed, expire, and have an attempt limit.
- [x] Authenticator-app TOTP secrets are encrypted using AES-256-GCM and a separate environment key.
- [x] Credential sign-in supports email OTP/TOTP checks; OAuth is blocked for accounts with 2FA enabled until an OAuth second-factor challenge exists.
- [x] Staff authorization uses a database-backed role check and a controlled staff-promotion script.
- [ ] Add recovery codes, secure account recovery, and reauthentication-protected 2FA disable/change flows.
- [ ] Add durable audit events for staff promotion, staff actions, authentication events and sensitive account changes.
- [ ] Review OAuth account linking, verified-email semantics, session expiry/revocation and secure cookie settings with real provider configuration.
- [ ] Review CSRF/origin validation on every state-changing route, including newly added endpoints.
- [ ] Add and pass tests for OTP replay/concurrency, brute-force throttling, role escalation, session expiry, OAuth linking and account recovery.

## 4. Abuse prevention and tenant isolation

- [x] Persistent IP/account rate limiting is implemented for registration, password login, email verification/resend, email OTP and 2FA setup/confirmation.
- [ ] Add rate-limit bucket cleanup, monitoring and alerting; validate trusted client-IP extraction behind the actual Railway proxy.
- [ ] Prove ownership-scoped access for every user-owned resource: profile, CV files, saved jobs, applications, preferences, Gmail connections and tokens.
- [ ] Pass two-account integration tests proving one user cannot read, update, delete or download another user's data.
- [ ] Verify upload limits, PDF validation, storage encryption, access control and deletion/retention behavior for CV files.
- [ ] Verify logs redact passwords, OAuth codes, access/refresh tokens, CV contents and other personal data.

## 5. CI, database and release engineering

- [ ] CI uses a real disposable PostgreSQL service and runs unit, integration, migration, typecheck and production-build checks.
- [ ] Use `npm ci` with a committed and reviewed lockfile; do not rely on an unlocked `npm install` in CI.
- [ ] Validate Prisma migrations against disposable CI PostgreSQL and the actual staging database.
- [ ] Back up staging and prove restore before applying migrations; verify row counts and data integrity afterward.
- [ ] Complete privacy, retention, incident-response, backup/restore, monitoring and rollback reviews.
- [ ] Confirm the exact candidate commit SHA is the one deployed to the intended Railway production service/environment.
- [ ] Verify the live health endpoint reports application and database health; complete authenticated user and tenant-isolation smoke tests.
- [ ] Complete a real Gmail OAuth test with a designated test account; verify refresh-token handling and PDF attachment round-trip. Do not send external email without explicit approval.

## 6. Public product and operational readiness

- [ ] Update public documentation so it accurately describes the current global/multilingual product and does not retain obsolete Lagos-only or private-repository statements.
- [x] Add `SECURITY.md` with private vulnerability disclosure instructions.
- [ ] Enable GitHub private vulnerability reporting in repository settings and verify the reporting route.
- [ ] Review public issue templates, support logs, demo data and screenshots for personal or confidential information.
- [ ] Complete an independent penetration test or documented security assessment before handling real customer data.

## Release decision

**NO-GO until all applicable unchecked release gates are evidenced as passed.**

The repository currently has useful security foundations, but the full-history secret scan, CodeQL ingestion, dependency checks, tenant isolation, staging migration/backup, live Railway verification and Gmail OAuth/PDF round-trip are not yet evidenced as complete. A green scanner alone is not a security certification.
