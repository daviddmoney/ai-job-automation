# Security implementation checklist

## Existing application controls observed in repository
- [x] Private repository and no production secrets in inspected source tree.
- [x] Registration assigns USER role server-side.
- [x] Argon2id password hashing.
- [x] Email verification challenge hashing, expiry and attempt limits.
- [x] AES-256-GCM encrypted TOTP secrets.
- [x] Email OTP and TOTP second-factor checks.
- [x] Database-backed staff authorization.
- [x] Security headers.
- [x] Rate limits and same-origin checks on inspected sensitive endpoints.

## Repository automation
- [x] CodeQL workflow added; requires code scanning activation and ENABLE_CODEQL=true.
- [x] Dependency review workflow added; requires dependency graph support and ENABLE_DEPENDENCY_REVIEW=true.
- [x] Dependabot configuration.
- [x] npm audit and Semgrep scans.
- [x] Gitleaks secret scan.
- [x] Optional Snyk scan; requires ENABLE_SNYK and SNYK_TOKEN.
- [x] Vulnerable dependency remediation overrides and Nodemailer upgrade committed for CI verification.

## Required before public launch
- [ ] Confirm latest npm audit has no unresolved high/critical findings; review any remaining advisories rather than using force upgrades.
- [ ] Enable GitHub code scanning, dependency graph, secret scanning, push protection, Dependabot alerts and private vulnerability reporting where available.
- [ ] Set ENABLE_CODEQL=true and ENABLE_DEPENDENCY_REVIEW=true after confirming repository plan support.
- [ ] Configure Cloudflare WAF/DDoS/bot controls and restrict direct origin access.
- [ ] Configure production secrets in a managed secret store; rotate any exposed credentials.
- [ ] Add durable audit events for staff actions and security events.
- [ ] Complete ownership-scoped CRUD tests for every private resource.
- [ ] Review OAuth account linking and verified-email handling with real provider configuration.
- [ ] Add rate-limit cleanup, abuse monitoring and trusted-proxy IP validation.
- [ ] Add recovery codes and secure 2FA recovery/disable flows.
- [ ] Add malware scanning and quarantine for uploaded files.
- [ ] Add CSP and production HSTS after validating external resources.
- [ ] Configure Wazuh/Sentinel or equivalent monitoring appropriate to scale.
- [ ] Configure encrypted backups, point-in-time recovery and test restores.
- [ ] Complete privacy, retention, data-processing and cross-border transfer reviews.
- [ ] Run independent penetration testing and remediate findings.
- [ ] Run Prisma migration, typecheck and production build in staging.

This checklist is not a security certification. Do not use real customer data until launch blockers are resolved and tested.
