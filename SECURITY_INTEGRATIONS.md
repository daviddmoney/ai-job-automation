# Security integrations and operations

## Repository automation

- **CodeQL:** JavaScript/TypeScript analysis; SARIF upload is enabled. The exact newer CodeQL workflow from `main` is preserved. A SARIF upload succeeded on the PR #7 hardening branch; verify a fresh successful upload and alerts on the final release commit.
- **Dependency Review:** Pull-request workflow runs `npm ci` and `npm audit --audit-level=high`.
- **Dependabot:** Weekly npm and GitHub Actions update checks.
- **Security scans:** npm audit, Semgrep, Gitleaks and Snyk. The Snyk job requires the `SNYK_TOKEN` Actions secret; it ran successfully on the candidate dependency baseline.
- **Full-history Gitleaks:** Dedicated workflow fetches complete history, branches and tags, scans all reachable refs, redacts findings and retains SARIF for 30 days. `.gitleaks.toml` preserves default rules and permits only the exact public RFC 6238 TOTP test vector in `tests/provider-hardening.test.mjs`.

## Repository settings requiring owner verification

Open repository **Settings** and **Security** to verify:
1. Secret scanning and push protection are enabled.
2. Dependabot alerts and security updates are enabled.
3. Dependency graph is enabled.
4. Code scanning alerts show the latest CodeQL upload.
5. Private vulnerability reporting is enabled.
6. `main` has a ruleset/branch protection requiring reviewed pull requests and successful CI/security checks; force pushes and branch deletion are blocked.

The GitHub integration used for this audit could not read branch protection settings. Do not assume these settings are enabled based on workflow files.

## External services requiring separate activation

1. **Cloudflare or equivalent edge:** Configure DNS/proxy, managed WAF rules, DDoS protection, bot controls and rate limits. Restrict direct access to the Railway origin.
2. **Railway/database:** Use managed secrets, private networking, TLS, restricted ingress, encrypted backups and point-in-time recovery. Verify backup restoration.
3. **Wazuh/Sentinel or equivalent:** Configure secure log forwarding, retention and alert rules at a scale appropriate to the service. Minimise personal data sent to the SIEM.
4. **Gmail:** Use a dedicated Google OAuth client, exact callback URL and minimum required Gmail scopes. Store OAuth secrets server-side only. Complete live consent and attachment tests in a designated test account.

## Trusted proxy configuration

The application must not trust arbitrary `X-Forwarded-For` or `X-Real-IP` values. Set `TRUSTED_PROXY_HEADER_SECRET` only after the edge proxy strips incoming copies of the trusted headers, injects a fresh client-IP header and matching shared token, and the origin is restricted so callers cannot bypass the edge. Until verified, treat client IP as unknown.

## DeepSeek independent pull-request review

The optional DeepSeek workflow uses the repository variable `ENABLE_DEEPSEEK_REVIEW=true` and the Actions secret `DEEPSEEK_API_KEY`. Never put the key in source, comments, chat or browser code. The latest observed review request failed with HTTP 402 (insufficient provider balance). Fund the provider account or set the variable to false until available. DeepSeek is a second opinion, not a required security control or substitute for human review.

## Operating principles

- Least privilege for users, GitHub tokens, deployment credentials and service accounts.
- MFA/passkeys for administrators; no shared admin accounts.
- Never expose secrets in source, logs, artifacts or browser bundles.
- Rotate credentials after suspected exposure.
- Rate-limit authentication, translation, imports and expensive endpoints.
- Use secure cookies, CSRF/origin protections, CSP, HSTS in production, output encoding and server-side validation.
- Quarantine and scan uploaded documents before availability.
- Keep tamper-resistant audit logs without raw sensitive message content.
- Test encrypted backups and recovery regularly.
- Perform independent penetration testing before handling real customer data.

Automated scans do not replace code review, threat modelling, incident response or independent penetration testing. This document is operational guidance, not a security certification.
