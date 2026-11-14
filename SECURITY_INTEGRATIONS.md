# Security integrations and operations

## Repository-enabled controls
- CodeQL static analysis and SARIF publishing (requires GitHub Code Security entitlement and code scanning enabled for this private repository).
- GitHub dependency review (requires dependency graph/GitHub Advanced Security availability and repository variable ENABLE_DEPENDENCY_REVIEW=true).
- Dependabot for npm and GitHub Actions.
- npm audit and Semgrep scans.
- Gitleaks secret scanning.
- Optional Snyk scanning when ENABLE_SNYK=true and SNYK_TOKEN is configured.

## External services requiring separate activation
1. Cloudflare: configure DNS/proxy, WAF managed rules, DDoS protection, bot controls, rate limits and Turnstile. Restrict direct origin access.
2. GitHub repository settings: enable the dependency graph, code scanning, secret scanning, push protection, Dependabot alerts/security updates and private vulnerability reporting where available. Private-repository code scanning and dependency review may require GitHub Code Security / Advanced Security entitlement. Workflow files cannot toggle repository settings.
3. CodeQL: enable GitHub Code Security in repository settings, then rerun the CodeQL workflow. The workflow now uploads SARIF directly to Code Scanning.
4. Dependency review: enable the dependency graph and confirm private-repository Code Security entitlement, then rerun the Dependency Review workflow.
5. Snyk: set repository variable ENABLE_SNYK=true and add a least-privilege SNYK_TOKEN as an Actions secret.
6. Wazuh: deploy agents and forward host/application/authentication logs to a secured manager.
7. Microsoft Sentinel: configure a Log Analytics workspace, connectors, retention and alert rules. Minimise personal data sent to the SIEM.
8. Hosting/database: enable managed encryption, private networking, restricted ingress, TLS, encrypted backups and point-in-time recovery.

## Operating principles
- Least privilege for users, GitHub tokens, deployment credentials and service accounts.
- MFA/passkeys for administrators; no shared admin accounts.
- Never expose secrets in source, logs, build artifacts or browser bundles.
- Use a managed secret store and rotate credentials after suspected exposure.
- Never trust X-Forwarded-For or X-Real-IP directly. Set TRUSTED_PROXY_HEADER_SECRET and configure the edge proxy to overwrite x-verified-client-ip and inject the matching x-trusted-proxy-token; otherwise client IP is treated as unknown.
- Rate-limit authentication, translation, imports and expensive endpoints.
- Use secure cookies, CSRF/origin protections, CSP, HSTS in production, output encoding and server-side validation.
- Quarantine and scan uploaded documents before availability.
- Keep tamper-resistant audit logs without storing raw sensitive message content.
- Test encrypted backups and recovery regularly.
- Perform independent penetration testing before public launch and after material changes.

No tool guarantees prevention of every attack. Automated scans do not replace code review, threat modelling, incident response or penetration testing. Vendor activation requires the owner's accounts, credentials, DNS/hosting access and any required subscriptions.


## Optional independent DeepSeek pull-request review

- Workflow: `.github/workflows/deepseek-review.yml`.
- Create a DeepSeek API key in the DeepSeek developer platform and store it only as the GitHub Actions repository secret `DEEPSEEK_API_KEY`.
- Set the repository Actions variable `ENABLE_DEEPSEEK_REVIEW=true` to enable automatic reviews on pull-request updates. After this workflow is merged into the default branch, it can also be run manually with a pull-request number.
- The workflow sends a bounded pull-request diff (maximum 60,000 characters) to the DeepSeek Chat Completions API using the `deepseek-flash` model, then posts the returned review as a PR comment.
- Do not place API keys in source files, workflow YAML, issue comments, or chat messages. Review third-party data-processing and retention terms before enabling this for confidential code.
- DeepSeek findings are a second opinion and must be verified; they are not a substitute for tests or human review.
