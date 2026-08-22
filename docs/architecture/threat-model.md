# Threat Model

Written for Phase 13 (Security Hardening, plan Section 60). Companion to `security.md` (the practical "what's implemented" summary) — this document is the "why these specific things matter" survey: assets, actors, trust boundaries, and the concrete threats each part of the system faces, with what mitigates them today and what's a deliberately accepted residual risk.

Scope: a single hobby-scale personal finance app (ADR-009: Vercel + Render + Neon, free tiers), not a multi-tenant SaaS product with a security team or compliance obligations. The bar is "meaningfully resist a real attacker who finds this app on the internet," not "survive a nation-state adversary."

## Assets (What's Worth Protecting)

Ranked by how bad it would be if compromised:

1. **User financial records** — transactions, accounts, budgets, bills, goals. The plan's own critical rule exists because of this asset: "A user must never be able to retrieve another user's financial records" (Section 39).
2. **Credentials** — password hashes and refresh tokens. A leak here doesn't just expose one user's data, it lets an attacker impersonate them going forward.
3. **The database itself** — a single Postgres instance holds every user's data (ADR-002). Its compromise is total, not per-user.
4. **Availability** — a hobby app doesn't have an SLA, but a trivially-DoS-able auth endpoint (see Rate Limiting below) would make the app unusable for its actual owner, not just a hypothetical attacker's target.
5. **The AUTH_SECRET signing key** — anyone who obtains it can forge valid access tokens for any user without ever touching the database.

## Actors

- **Legitimate users** — the only user type the product currently has (no admin role, no household/shared-account model yet — plan Section 69's open questions).
- **Unauthenticated external attacker** — the primary threat actor for a public internet-facing app: automated scanners, credential-stuffing bots, opportunistic exploitation of known CVEs in dependencies.
- **An authenticated attacker (a legitimate account holder attempting to reach another user's data)** — the specific actor the plan's critical rule is written for. Distinct from the external attacker: this one already has a valid access token, just for the wrong user.
- **A compromised dependency** — not a person, but a real threat class for any Node project (see Dependency Vulnerability Scan in `security.md`). Out of this project's direct control beyond staying current and reviewing `pnpm audit` output.
- **Malicious insider / the developer themself** — explicitly out of scope. This is a single-maintainer hobby project; there is no team boundary to defend against.

## Trust Boundaries

```text
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│  Browser / App   │  HTTPS  │   apps/api        │  TLS    │   Postgres       │
│  (Vercel/EAS)    │────────▶│   (Render)        │────────▶│   (Neon)         │
│  apps/web,       │         │   NestJS          │         │                  │
│  apps/mobile     │◀────────│                   │◀────────│                  │
└─────────────────┘  JSON   └──────────────────┘         └─────────────────┘
       ▲                             ▲
       │ untrusted input              │ untrusted input
       │ (anyone with a browser)      │ (any HTTP client, not just apps/web/mobile)
```

Two boundaries matter:

1. **Client → API**: the API must never trust anything from the client beyond what a signed access token cryptographically proves. Every service scopes every query by `req.user.sub` (resolved from the verified JWT), never by a client-supplied `userId` in the body or query string.
2. **API → Database**: the API is the only thing that talks to Postgres (local dev via Docker, production via Neon over TLS — ADR-009). No client, browser, or mobile app ever holds database credentials.

A third, weaker boundary: **web/mobile → API is cross-origin by design** (ADR-009), so CORS and Bearer-token-in-header (not a cookie) are load-bearing security decisions, not incidental ones — see ADR-011 and `security.md`'s "Where Tokens Live Per Platform".

## Threats and Mitigations

### T1 — A user reads/edits/deletes another user's financial data (IDOR)

The plan's critical rule, and the single most important threat this app faces given its asset list.

- **Mitigation**: every service method scopes its Prisma query by `userId` in the `WHERE` clause itself (`findFirst({ where: { id, userId } })`), never fetch-then-check. A request for another user's resource 404s — indistinguishable from a nonexistent resource, not a 403 that would confirm the resource exists.
- **Verified**: every one of the 10 resource types has a dedicated `CRITICAL` integration test registering two real users and confirming cross-access fails (grepped and confirmed complete during this phase — see "Authorization Test Coverage Audit" below).

### T2 — Credential theft (password guessing, credential stuffing, stolen database)

- **Mitigation**: argon2id hashing (deliberately slow, resists offline cracking of a stolen hash), 12-character minimum password length (OWASP's current length-over-complexity guidance), generic login error message (doesn't confirm which part was wrong), and — new this phase — rate limiting on `/auth/login` (20/min per IP) makes both online guessing and the CPU-exhaustion angle of unthrottled hashing impractical.
- **Residual risk**: IP-based throttling can be shared across users behind the same NAT (see `security.md`'s Rate Limiting section) and doesn't stop a slow, distributed credential-stuffing attempt spread across many IPs. Acceptable at this scale; would need per-account lockout or a CAPTCHA to fully close.

### T3 — Token theft (XSS stealing a refresh token, stolen device)

- **Mitigation**: access tokens are never persisted to disk on either platform (in-memory only, 15-minute TTL — a stolen one is only useful briefly). Refresh tokens live in `localStorage` (web) or Expo `SecureStore` (mobile, OS-level encrypted) — see ADR-011 for the full reasoning on why this is a deliberate trade-off given the cross-origin architecture, not an oversight. Refresh token rotation means a copied-but-unused token has a one-time window before the legitimate client's next refresh invalidates it.
- **Residual risk**: `localStorage` is readable by any script running on the web origin — a successful XSS attack (see T5) could exfiltrate the refresh token. This is the concrete reason T5 matters as much as it does for this app specifically.

### T4 — Forged/tampered access tokens

- **Mitigation**: JWTs signed with `AUTH_SECRET` (HS256, minimum 32 characters, validated at startup — `env.ts`). Algorithm-confusion attacks (the classic "alg: none" or RS256-key-as-HMAC-secret tricks) don't apply to this design: there's no asymmetric keypair anywhere in the system for an attacker to exploit, purely a single shared HMAC secret.
- **Residual risk**: if `AUTH_SECRET` itself leaks (e.g., a misconfigured hosting environment variable dashboard), an attacker can forge tokens for any user without ever touching the database. Mitigated by "secrets only through environment/secret management, never committed to Git" (confirmed clean — see Secret Scan in `security.md`) — there is no further in-app mitigation for a leaked signing key beyond rotating it, which would invalidate every active session (an acceptable, if disruptive, incident response).

### T5 — XSS in the web app

- No `dangerouslySetInnerHTML` or raw HTML injection anywhere in `apps/web` (React escapes all rendered text by default — grepped, none found). No user-generated content is ever rendered as HTML; every financial figure, name, and note is rendered as plain React text content.
- **Residual risk**: no CSP is configured (see `security.md`'s Security Headers — deliberately skipped, since this app loads no third-party scripts and a misconfigured CSP has real breakage risk for no current benefit). If a future feature ever renders user-supplied HTML or adds a third-party script, a CSP becomes worth revisiting.

### T6 — SQL/NoSQL injection

- **Mitigation**: 100% Prisma ORM query builder usage — grepped `apps/api/src` for `$queryRaw`/`$executeRaw`, found none. Every query is parameterized by construction, not by developer discipline.

### T7 — Resource exhaustion / DoS

- **Mitigation**: app-wide rate limiting (100 req/min per IP, new this phase), stricter limits on the CPU-expensive auth endpoints (20 req/min), and argon2id's cost is bounded by the library's sane defaults (not attacker-tunable). Transactions are server-paginated (plan Section 55) rather than allowing an unbounded `GET /transactions` fetch.
- **Residual risk**: no request body size limit is explicitly configured beyond Express/NestJS defaults; not tested against a large-payload attack this phase. Low priority given the API's fields are all short strings/numbers with Zod length validation, not file uploads.

### T8 — Vulnerable dependencies

- **Mitigation**: `pnpm audit` run this phase, three real production-runtime findings patched via `pnpm.overrides` (`body-parser`, `multer`, `lodash`), two significant ones identified and deliberately deferred with documented reasoning (`next`, `@nestjs/core` — both need major-version upgrades). Full breakdown in `security.md`'s Dependency Vulnerability Scan section.
- **Residual risk**: no automated recurring scan (e.g., a CI step or Dependabot) exists yet — this was a one-time manual pass. Worth automating in a future phase so new advisories don't go unnoticed between manual reviews.

### T9 — Secrets committed to version control

- **Mitigation**: `.gitignore` covers all `.env*` variants except `.env.example`; confirmed via `git log --all` that no `.env` file was ever committed at any point in this project's history. See `security.md`'s Secret Scan section for the full check performed this phase.

### T10 — Login code interception or brute force (Post-Phase-13, passwordless email login)

A new auth surface added after this document was first written — the same asset (T1's financial records) is now also reachable via a 6-digit emailed code, not just a password.

- **Mitigation**: three independent layers — a 10-minute expiry, a 5-attempt-per-code lockout (the primary defense against the code's small 1,000,000-value keyspace), and IP-level rate limiting on both the request and verify endpoints. Full detail in `security.md`'s Passwordless Email Login section.
- **A new threat this method specifically introduces that a password doesn't: email account compromise.** Whoever controls the recipient's email inbox can request and read a login code without knowing anything else about the account. This is a real, deliberately accepted trade-off of choosing email-based passwordless auth at all, not something this app's own code can mitigate — the user's email provider's own security (its password, its own MFA) becomes part of Budget Terry's effective security boundary. Worth being explicit about rather than leaving implicit.
- **Residual risk**: see `security.md` for the accepted, low-probability 6-digit collision-across-users risk, and the note that IP-based throttling can be shared across users behind the same NAT (same limitation as T2's login throttle).

## Out of Scope (Deliberately, Not Forgotten)

- **CSRF** — not a concern under the current Bearer-token-in-header approach (no ambient browser-attached credential for a malicious page to ride along with). Would need revisiting only if the app ever moves to HTTP-only cookie auth (see ADR-011).
- **DDoS at the network/infrastructure layer** — out of this application's control; would be Render/Vercel/Neon's responsibility at their respective tiers.
- **Physical device security** — if a user's phone or laptop is physically compromised while unlocked and logged in, no application-layer control here defends against that.
- **Malicious insider** — see Actors above; not applicable to a single-maintainer project.
