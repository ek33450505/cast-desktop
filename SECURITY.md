# Security Policy

## Supported Versions

| Version | Support Status |
|---------|---------------|
| 1.0.x (current) | Full support — security and bug fixes |
| < 1.0 | Not yet released |

## Reporting a Vulnerability

**Do not open a public GitHub Issue for security vulnerabilities.**

Report security issues privately via [GitHub Security Advisories](https://github.com/ek33450505/cast-desktop/security/advisories/new).
This keeps the details confidential until a fix is released.

### What to include

- Cast Desktop version
- macOS version
- Steps to reproduce the issue
- Potential impact assessment

When reporting, please describe the attack surface affected:
- **Tauri capability scope** — which native capabilities are exposed (file access, shell execution, etc.)
- **Express API surface** — which endpoints or data sources are involved
- **Local filesystem access** — scope of file read/write operations exposed by the app

### Response timeline

| Severity | Acknowledgement | Target remediation |
|----------|-----------------|--------------------|
| Critical | 48 hours | 14 days |
| High | 48 hours | 30 days |
| Medium/Low | 5 business days | Next release |

We will keep you updated throughout the remediation process and credit you in the release notes unless you prefer to remain anonymous.

## Out of Scope

The following are not in scope for this security policy:

- Social engineering attacks
- Physical access attacks
- Vulnerabilities in Tauri itself (report to [Tauri](https://www.tauri.app/))
- Vulnerabilities in Chromium or WebKit (report to [Chromium](https://bugs.chromium.org/) or [WebKit](https://bugs.webkit.org/))
- Vulnerabilities in third-party dependencies (npm packages, Rust crates) — report to those projects directly
- Vulnerabilities in the Claude API or CAST framework (report to [Anthropic](https://www.anthropic.com/security))

## Disclosure Policy

We follow [responsible disclosure](https://en.wikipedia.org/wiki/Responsible_disclosure). Once a fix is available, we will:

1. Release the patched version
2. Publish a security advisory with CVE (if applicable)
3. Credit the reporter (with permission)
