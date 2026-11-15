# Security integrations and operations

## Repository automation

- **CodeQL:** Exact newer `main` SARIF workflow preserved. The latest candidate run successfully uploaded SARIF with zero results. The exact workflow still references `actions/checkout@v4` and `actions/upload-artifact@v4`, which emitted a non-blocking Node 20 deprecation warning; update those refs only after preserving the required SARIF behavior.
- **Dependency Review:** Pull-request workflow uses locked dependencies and fails on high-severity dependency changes.
- **Dependabot:** Weekly npm and GitHub Actions update checks.
- **Security scans:** npm audit, Semgrep, Gitleaks and Snyk. Latest candidate: npm audit reported zero vulnerabilities, Semgrep SARIF had zero results, Gitleaks SARIF had zero results, and Snyk tested 76 dependencies with zero issues and zero vulnerable paths at the high-severity threshold. Snyk requires the `SNYK_TOKEN` Actions secret.
- **Full-history Gitleaks:** Dedicated workflow fetches complete history, branches and tags, scans all reachable refs, redacts findings and retains SARIF. Gitleaks v8.30.1 is pinned and the release archive SHA-256 is verified. Latest scan: 435 commits, 9 branches, no tags, zero findings.
- **Action supply chain:** Non-CodeQL third-party actions are pinned to reviewed immutable SHAs and Node 24-compatible releases. The exact CodeQL workflow is the documented exception.

## Application security controls

- Gmail draft create/update/send JSON bodies and CV multipart uploads have streamed byte limits.
- Gmail connect, draft create/update/send and CV upload have per-user rate limits.
- Gmail OAuth tokens and CV content use an HKDF-derived domain-separated AES-256-GCM subkey. Legacy ciphertext is read-compatible and lazily re-encrypted.
- Rate limiting depends on trusted edge-injected client-IP headers plus a shared secret. Arbitrary client-supplied `X-Forwarded-For` and `X-Real-IP` values must not be trusted.

## Repository settings requiring owner verification

Open repository **Settings** and **Security** to verify:
1. Secret Scanning and push protection are enabled.
2. Dependabot alerts and security updates are enabled.
3. Dependency graph is enabled.
4. Code scanning alerts show the latest CodeQL upload; review and triage any alerts.
5. Private vulnerability reporting is enabled.
6. `main` has a ruleset/branch protection requiring reviewed pull requests and successful CI/security checks; force pushes and branch deletion are blocked.

The GitHub integration used for this audit could not read branch protection settings. Do not assume these settings are enabled based on workflow files.

## External services requiring separate activation

1. **Cloudflare or equivalent edge:** Configure DNS/proxy, managed WAF rules, DDoS protection, bot controls and rate limits. Restrict direct access to the Railway origin.
2. **Railway/database:** Use managed secrets, private networking, TLS, restricted ingress, encrypted backups and point-in-time recovery. Verify backup restoration.
3. **Wazuh/Sentinel or equivalent:** Configure secure log forwarding, retention and alert rules at a scale appropriate to the service. Minimise personal data sent to the SIEM.
4. **Gmail:** Use a dedicated Google OAuth client, exact callback URL and minimum required Gmail scopes. Store OAuth secrets server-side only. Complete live consent and attachment tests in a designated test account.

## DeepSeek independent pull-request review

The optional DeepSeek workflow uses `ENABLE_DEEPSEEK_REVIEW=true` and `DEEPSEEK_API_KEY`. It is non-blocking when the provider is unavailable. A prior review request returned HTTP 402 due insufficient provider balance, so no review comment was published. Fund the provider account if a second opinion is desired. This is not a required security control or substitute for human review.

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
