# Security integrations and operations

## Repository-enabled controls
- CodeQL static analysis (requires code scanning to be enabled for this private repository and repository variable ENABLE_CODEQL=true).
- GitHub dependency review (requires dependency graph/GitHub Advanced Security availability and repository variable ENABLE_DEPENDENCY_REVIEW=true).
- Dependabot for npm and GitHub Actions.
- npm audit and Semgrep scans.
- Gitleaks secret scanning.
- Optional Snyk scanning when ENABLE_SNYK=true and SNYK_TOKEN is configured.

## External services requiring separate activation
1. Cloudflare: configure DNS/proxy, WAF managed rules, DDoS protection, bot controls, rate limits and Turnstile. Restrict direct origin access.
2. GitHub repository settings: enable the dependency graph, code scanning, secret scanning, push protection, Dependabot alerts/security updates and private vulnerability reporting where available. Private-repository code scanning and dependency review may require GitHub Code Security / Advanced Security entitlement. Workflow files cannot toggle repository settings.
3. CodeQL: after enabling code scanning in repository settings, set repository variable ENABLE_CODEQL=true.
4. Dependency review: after enabling the dependency graph and confirming plan support, set repository variable ENABLE_DEPENDENCY_REVIEW=true.
5. Snyk: set repository variable ENABLE_SNYK=true and add a least-privilege SNYK_TOKEN as an Actions secret.
6. Wazuh: deploy agents and forward host/application/authentication logs to a secured manager.
7. Microsoft Sentinel: configure a Log Analytics workspace, connectors, retention and alert rules. Minimise personal data sent to the SIEM.
8. Hosting/database: enable managed encryption, private networking, restricted ingress, TLS, encrypted backups and point-in-time recovery.

## Operating principles
- Least privilege for users, GitHub tokens, deployment credentials and service accounts.
- MFA/passkeys for administrators; no shared admin accounts.
- Never expose secrets in source, logs, build artifacts or browser bundles.
- Use a managed secret store and rotate credentials after suspected exposure.
- Trust proxy IP headers only from configured trusted infrastructure.
- Rate-limit authentication, translation, imports and expensive endpoints.
- Use secure cookies, CSRF/origin protections, CSP, HSTS in production, output encoding and server-side validation.
- Quarantine and scan uploaded documents before availability.
- Keep tamper-resistant audit logs without storing raw sensitive message content.
- Test encrypted backups and recovery regularly.
- Perform independent penetration testing before public launch and after material changes.

No tool guarantees prevention of every attack. Automated scans do not replace code review, threat modelling, incident response or penetration testing. Vendor activation requires the owner's accounts, credentials, DNS/hosting access and any required subscriptions.
