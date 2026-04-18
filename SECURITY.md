# Security Policy

## Threat model

Bullet Lens is a purely client-side Next.js app. There is no backend, no
user accounts, no uploads, and no persistent storage. Files dropped into
the viewer are parsed in-memory and never leave the browser. The
traditional web-app attack surface (SSRF, SQL injection, auth bypass,
CSRF, secret leakage) does not apply.

The surfaces that do matter:

- Parsing of user-supplied `.x3p` files (ZIP + XML + binary matrix).
- The npm / GitHub Actions supply chain.
- The static deploy pipeline (whoever controls it).

## Supported versions

Only the latest `main` branch is supported. Prior tags are not patched.

## Reporting a vulnerability

**Please do not open a public issue.** Instead:

- Email: ericrhare@gmail.com
- Or open a private advisory:
  <https://github.com/erichare/bullet-lens/security/advisories/new>

Include a description of the issue, reproduction steps (with a sample
`.x3p` if relevant), the browser you used, and the commit SHA.

You can expect:

- An acknowledgement within **3 business days**
- A status update within **7 days**
- A fix or coordinated disclosure within **30 days** for confirmed issues

## Scope

**In scope**

- Bugs in the parsers (`lib/x3p.ts`, `lib/geometry.ts`, `lib/flatten.ts`)
  or viewer components triggerable by a crafted `.x3p`.
- Dependency CVEs shipped in the built client bundle.
- Supply-chain issues in `.github/workflows/`.

**Out of scope**

- Self-XSS via devtools.
- Denial-of-service from pathologically large inputs (your browser's OOM
  guard already protects you).
- Anything requiring write access to the user's own machine.

## Handling user data

We don't collect any. No analytics, telemetry, cookies, or
`localStorage`. Files dropped into the viewer stay in the tab's memory
and are discarded when the tab closes. If that ever changes, it will be
documented here and opt-in.
