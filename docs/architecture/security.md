# Security

Source of truth for the _why_: ADR-003 (auth-ready schema, revised to build real auth in Phase 3) and ADR-011 (session/token mechanics). This document is the practical summary of what's actually implemented and how to reason about it.

## Password Storage

Passwords are hashed with **argon2id** (`argon2` package), OWASP's current recommended default. Never logged, never stored in plaintext, never compared with `===` (always via `argon2.verify`, which is timing-safe).

## Authentication Flow

- `POST /auth/register` — creates a user, hashes the password, seeds the 15 default categories for that user, returns tokens.
- `POST /auth/login` — verifies credentials, returns tokens. A wrong password and an unknown email return the **identical** generic message (`"Invalid email or password."`) — never reveal which one was wrong.
- `POST /auth/login-code/request` / `POST /auth/login-code/verify` — passwordless email login, the default on both frontends (see below).
- `POST /auth/refresh` — exchanges a valid, unexpired, unrevoked refresh token for a new access token **and a new refresh token** (rotation — the old one is revoked in the same operation).
- `POST /auth/logout` — revokes the presented refresh token server-side.
- `GET /auth/me` — returns the authenticated user; requires a valid access token.

## Passwordless Email Login (Post-Phase-13)

The default login method on both `apps/web` and `apps/mobile` — password login still works, reachable via a "Log in with password instead" link, not removed.

- **Flow**: `POST /auth/login-code/request { email }` always returns `204`, whether or not the email has an account — same non-enumeration principle as password login's generic error message. If the email does match a user, a 6-digit code is generated, hashed (SHA-256, same "only the hash is stored" principle as refresh tokens — see `LoginCode` in `schema.prisma`), and emailed via `MailService`. `POST /auth/login-code/verify { email, code }` returns the same `AuthResponse` shape (user + tokens) as `/auth/login`/`/auth/register` on success.
- **Code generation**: `crypto.randomInt(0, 1_000_000)` (cryptographically secure, not `Math.random`), zero-padded to 6 digits. `TokenService.generateLoginCode()`/`hashLoginCode()`, alongside the existing refresh-token methods.
- **Three independent defenses against a 6-digit code's small keyspace** (1,000,000 possibilities, far fewer than a password or a 48-byte refresh token):
  1. **Short expiry** — `LOGIN_CODE_TTL_MINUTES` (default 10).
  2. **Per-code attempt lockout** — `MAX_LOGIN_CODE_ATTEMPTS = 5` in `AuthService`. A code becomes permanently unusable after 5 wrong guesses, independent of IP or request volume — this is the primary brute-force defense, not the rate limiter below.
  3. **Per-IP rate limiting** — `/request` at 10/min (tighter than the general `AUTH_THROTTLE`, since it has a real external cost: an email send), `/verify` at 20/min (same as `AUTH_THROTTLE` — deliberately not tighter, since the attempt lockout above is what actually stops guessing one issued code; this is defense-in-depth on top of it, not a replacement).
- **Single-use and self-invalidating**: a code is marked consumed on successful verification (can't be replayed), and requesting a new code immediately invalidates any previous still-unconsumed one for that user (`updateMany` before `create`) — only ever one live code per user.
- **Accepted residual risk, not a bug**: two different users could plausibly be issued the _same_ 6-digit code around the same time (a real, if small, collision chance at only 1,000,000 possible values — unlike refresh tokens' 48 random bytes, which are unique with overwhelming probability). This isn't exploitable in practice: `verifyLoginCode` always scopes its comparison to the _submitted email's own_ latest code, so a coincidental hash match on someone else's code doesn't help an attacker who doesn't know the victim's email is even in play, and both the 5-attempt lockout and 10-minute expiry bound the exposure window regardless. Verified explicitly with a `CRITICAL` integration test asserting one user's real code is rejected against a different user's email.
- **Email delivery is provider-swappable by design**: `apps/api/src/mail/mail-provider.interface.ts` defines a `MailProvider` interface; `SmtpMailProvider` (nodemailer) is the only implementation so far, configured entirely via env vars (`SMTP_HOST`/`PORT`/`SECURE`/`USER`/`PASSWORD`, `MAIL_FROM`). The same class serves local dev (Mailpit, `docker-compose.yml`, no auth) and is intended to serve production (MailerLite's SMTP relay) — switching is a config change, not a code change. A provider that only exposes an HTTP API (no SMTP) would get its own `MailProvider` implementation selected in `mail.module.ts`'s factory, without touching `AuthService` or any caller. **Not yet done**: actually wiring real MailerLite credentials into a production environment — that's Phase 14 (Deployment) scope, tracked in Known Issues below, not this work.
- **Integration-tested with a fake mail provider, not a real SMTP dependency**: `apps/api/test/fake-mail.provider.ts` overrides the `MAIL_PROVIDER` DI token in the integration test harness (`test/integration-app.ts`) so tests never depend on Mailpit being reachable — and so tests can observe the plaintext code at all, since the database only ever stores its hash. 7 integration tests cover the full round trip, silent no-op for unknown emails, wrong-code rejection, cross-user isolation (CRITICAL), attempt lockout, previous-code invalidation, and single-use; 17 unit tests cover the same logic at the service layer; 2 dedicated rate-limit tests assert the exact `429` boundary on both endpoints.

## Tokens

- **Access token**: JWT, 15 minutes (`ACCESS_TOKEN_TTL_SECONDS`), signed with `AUTH_SECRET`. Contains `{ sub: userId, email }`. Held in memory only on every client — never written to disk, localStorage, or SecureStore. A stolen access token is only useful for 15 minutes.
- **Refresh token**: opaque random value (not a JWT), 30 days (`REFRESH_TOKEN_TTL_DAYS`). Only its SHA-256 hash is stored server-side (`refresh_tokens` table) — a database leak doesn't hand out usable tokens. Rotated on every use.

## Where Tokens Live Per Platform

| Platform | Access token              | Refresh token                           |
| -------- | ------------------------- | --------------------------------------- |
| Web      | In-memory (React context) | `localStorage`                          |
| Mobile   | In-memory (React context) | Expo `SecureStore` (OS-level encrypted) |

Both send the access token as `Authorization: Bearer <token>` — not an HTTP-only cookie. This is a **deliberate trade-off**, not an oversight: ADR-009 puts web and the API on different origins, and HTTP-only cross-origin cookies would require `SameSite=None; Secure` plus CORS configured for credentials, and the CSRF mitigation the plan's own security baseline (Section 39) flags as necessary for cookie-authenticated web flows. See ADR-011 for the full reasoning and what it would take to revisit this (tracked as a Phase 13 candidate, not urgent).

`packages/api-client` owns the retry logic: any request that gets a 401 (except calls to `/auth/*` themselves) triggers one silent refresh-and-retry before surfacing the error to the app.

## Authorization: Every Route Is Protected By Default

`JwtAuthGuard` is registered globally (`APP_GUARD`) — **every route requires a valid access token unless explicitly marked `@Public()`**. This is a fail-safe default: a new endpoint added later without thinking about auth is protected, not accidentally open. Currently `@Public()`: `GET /` (root info), `GET /health`, and every `/auth/*` endpoint except `GET /auth/me` — each of those authenticates by other means (credentials, an email code, or a refresh token in the body, not an access token).

## Rate Limiting (Phase 13)

`@nestjs/throttler`, registered globally via `APP_GUARD` in `app.module.ts`. Two tiers, both per-client-IP:

- **App-wide default**: 100 requests/minute on every route — a baseline anti-abuse/DoS floor, high enough that no normal usage pattern should ever hit it.
- **`/auth/login`, `/auth/register`, `/auth/refresh`**: overridden to 20 requests/minute each (`AuthController`, independent counters per endpoint — confirmed by reading `ThrottlerGuard`'s key generation, which includes the handler name). These three specifically run argon2id hashing/verification or issue real tokens, so the limit isn't just about credential-guessing throughput (12+ character passwords make brute force computationally infeasible regardless) — it's about denying an attacker the ability to force repeated expensive CPU work or token issuance. `/auth/logout` stays under the app-wide default; it doesn't do expensive work and revoking a token you hold isn't a sensitive action.
- Proven with a real request burst, not just code review: `apps/api/test/rate-limit.integration-spec.ts` fires 21 rapid `/auth/login` calls against a fresh app instance and asserts the 21st gets `429`; also manually verified against a running dev server with `curl` (20× `401`, then `429`).
- Known limitation: tracking is by IP address, the library's default. Multiple legitimate users behind the same NAT/corporate network share a budget. Acceptable for a hobby-scale app; revisit (per-account tracking, or a distributed store instead of in-memory) only if this becomes a real multi-tenant deployment.

## Security Headers (Phase 13)

- **`apps/api`**: `helmet`, applied via `src/configure-app.ts` (shared by both `main.ts`'s real bootstrap and `test/integration-app.ts`'s test harness — see that file's comment for why sharing it matters). CSP explicitly disabled (`contentSecurityPolicy: false`): this is a pure JSON API with no HTML views or Swagger UI for a content policy to protect, and a default CSP has nothing to restrict here. Every other helmet default applies: `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, HSTS, `Referrer-Policy`, etc. `crossOriginResourcePolicy` explicitly set to `cross-origin` (helmet's default is `same-origin`, which would otherwise fight the CORS config immediately below it — API and web are on different origins by design, ADR-009). Verified two ways: `test/security-headers.integration-spec.ts` asserts the headers on a real request/response, and a real running dev server was `curl`'d directly to confirm.
- **`apps/web`**: `apps/web/next.config.mjs` sets `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` (the app is never meant to be iframed), `Referrer-Policy: strict-origin-when-cross-origin`, and `poweredByHeader: false` (drops the default `X-Powered-By: Next.js` header — minor stack-fingerprinting information disclosure with no upside). No custom CSP here either, for the same reason as the API: the app loads no third-party scripts/styles beyond its own Next.js bundles, so a CSP would add real breakage risk for no current benefit. Verified by restarting the dev server (Next config changes aren't picked up by hot reload) and `curl`ing a real page.

## Structured Request Logging (Phase 13)

`LOG_LEVEL` was defined in the env schema (`src/config/env.ts`) since Phase 3 but never actually used anywhere — no logging of any kind existed until now. `src/common/request-logger.middleware.ts`, wired in via `configureApp()`, now emits one JSON line per request (plan Section 40's recommended fields exactly): `correlationId`, `method`, `path`, `statusCode`, `durationMs`, and `userId` when the request is authenticated (read from `req.user.sub`, set by `JwtAuthGuard` earlier in the same request's lifecycle — safe to read because Express's `res.on("finish", ...)` fires only after the whole request completes, and both the middleware and the guard share the same mutable `req` object).

- **Correlation ID**: reused from an incoming `X-Correlation-Id` request header if the caller sent one (useful for a future scenario with a reverse proxy or client that generates its own), otherwise generated with `crypto.randomUUID()`. Always echoed back as a response header, regardless of log level, so a client can always report "what correlation id was this request" even when logging is quiet.
- **Never logs `req.body`/`res.body` at all** — passwords, tokens, and full financial payloads (plan Section 40's explicit "never log" list) are excluded by construction, not by remembering to redact fields from a payload the logger never touches in the first place.
- **`LOG_LEVEL` now does something**: at `warn` or `error`, request-completion logging (treated as `info`-level) is suppressed entirely — the correlation header is still set either way, only the log line is skipped. Verified with a dedicated test asserting nothing is written to stdout at `warn`.
- Verified three ways: 5 unit tests (`request-logger.middleware.spec.ts`) covering header generation/reuse, the logged fields, userId inclusion, and level suppression; an integration test asserting the header round-trips through a real request; and a real running dev server, `curl`'d directly, producing a real structured log line.

## Auth Security Review (Phase 13)

Read through the full auth path end to end (`PasswordService`, `TokenService`, `JwtStrategy`, `JwtAuthGuard`, `AuthService`) looking specifically for the classic JWT/password mistakes. No code changes came out of this — everything below was already correct from Phase 3, confirmed rather than assumed:

- **Password hashing**: `argon2.hash(password, { type: argon2.argon2id })` — no explicit `memoryCost`/`timeCost`/`parallelism` overrides, which is fine: the `argon2` npm package's built-in defaults (64MB memory, time cost 3, parallelism 4) already meet OWASP's current minimums.
- **Algorithm confusion (the classic "alg: none" / RS256-as-HMAC-key attack)**: doesn't apply here. This is an HS256-only, single-shared-secret (`AUTH_SECRET`) design with no public/private keypair anywhere in the system — the attack requires an asymmetric scheme where a public key can be fed back in as an HMAC secret. Confirmed `JwtStrategy` sets `ignoreExpiration: false` explicitly (not relying on a default) and doesn't accept an `algorithms` override from anywhere client-controlled.
- **Password hash never leaves `auth.service.ts`**: grepped the entire `apps/api/src` for `passwordHash` — every read site is inside `AuthService` itself (create at register, verify at login); every response-shaping function (`toAuthenticatedUser`) explicitly builds a narrow `{ id, email, displayName }` object rather than passing a Prisma row through, so there's no `select`-forgetting risk of the hash leaking into a JSON response.
- **Login's generic error message vs. register's `409 Conflict`**: a deliberate, reviewed asymmetry, not an oversight. Login must not reveal whether an email is registered (same message for "unknown email" and "wrong password"). Register necessarily _does_ reveal it — a user has to be told to log in instead when their email is already taken. This is the standard, broadly-accepted trade-off (most consumer apps work this way); noted here so a future reviewer doesn't mistake it for an inconsistency.
- **Refresh tokens**: opaque, 48 random bytes (`crypto.randomBytes(48)`, base64url) — computationally infeasible to guess regardless of rate limiting. Only the SHA-256 hash is ever persisted; the raw value is returned to the client exactly once, at issuance, and never again (no endpoint lists or re-displays a refresh token).

## Session Expiration Review (Phase 13)

Confirmed already solid from Phase 3/ADR-011 — no gaps found, no code changes needed:

- **Access token**: 15 minutes, enforced by `passport-jwt` itself (`ignoreExpiration: false`), not manually re-checked. A stolen access token is only useful for 15 minutes.
- **Refresh token**: 30 days, but rotated on every use — `AuthService.refresh()` revokes the presented token and issues a new one in the same call, so a token that's actually being used regularly never reaches its 30-day expiry; only an unused, leaked-but-dormant token does.
- **Expiry and revocation are both enforced on every refresh attempt**, checked together in one condition (`!stored || stored.revokedAt !== null || stored.expiresAt < new Date()`) — covered by both a unit test (mocked clock-past `expiresAt`) and an integration test (use-after-logout, use-after-rotation).
- **Multiple simultaneous sessions are intentional, not a gap**: `issueTokens` always creates a new refresh token row rather than invalidating existing ones, so logging in on both web and mobile at once works as expected — each device holds its own independently-revocable refresh token.
- **No "log out everywhere" / revoke-all-sessions action exists yet** — genuinely out of scope right now: there's no password-change endpoint either (the usual trigger for forcing a global re-auth), so there's nothing yet that would need to invalidate every session at once. Worth adding together with a future change-password feature, not before.

## Sensitive-Data Review (Phase 13)

- **Password hashes**: covered above under Auth Security Review — confirmed to never leave `AuthService`.
- **New request logging never touches request/response bodies** (see Structured Request Logging above) — passwords, tokens, and financial payloads can't leak through it by construction.
- **No custom exception filter exists** — relies entirely on Nest's built-in default, which is already safe: `HttpException`s return their own status/message, and any unexpected (non-`HttpException`) error returns a generic `{ statusCode: 500, message: "Internal server error" }` with the real stack trace only ever going to the server's own console, never the HTTP response.
- **`GET /` and `GET /health`** (the two unauthenticated info endpoints) return only `{ name, version }` and `{ status: "ok" }` respectively — no environment details, config, or internal state.
- **No static file serving is configured anywhere** (`ServeStaticModule`/`express.static` — grepped, neither appears in `apps/api/src`), so there's no route through which `.env` or any other server file could accidentally become web-servable.
- **The seed script's hardcoded dev credential** (`dev@budgetterry.local` / `dev-password-please-change`) is deliberate and already documented in the README Quick Start — not a real secret, covered again here for completeness since a sensitive-data review should account for every hardcoded credential in the codebase, explained or not.

## The Critical Guarantee

> A user must never be able to retrieve another user's financial records. (Plan Section 39.)

This is enforced two ways:

1. Every authenticated request resolves `req.user` from a verified JWT — services scope every query by that id (`WHERE userId = req.user.sub`), never by a client-supplied id.
2. It's **integration-tested**, not just asserted: `apps/api/test/auth.integration-spec.ts` registers two real users against a real database and confirms neither can see the other's categories via `GET /categories`. Any future endpoint that touches user-owned data should get the same treatment.

## Known Gaps (Deliberately Deferred, Not Forgotten)

- **Structured error model** (plan Section 50 — `{ code, message, correlationId }`) isn't implemented yet; errors currently use Nest's default exception JSON shape. Worth doing once there's more than one API consumer relying on error shapes.
- **CSRF** isn't a concern under the current Bearer-token approach (no ambient credentials for a malicious page to ride along with) — revisit only if/when the HTTP-only-cookie option above is adopted.
- **Production email provider isn't wired up yet** — `SmtpMailProvider` is built and works against Mailpit locally, but no real MailerLite (or other) SMTP credentials exist in any deployed environment yet, because no environment is deployed yet (Phase 14). Wiring it is expected to be an env var change, not a code change, per the swappable design above — worth confirming that expectation holds once Phase 14 actually does it.

## Dependency Vulnerability Scan (Phase 13, 2026-08-21)

`pnpm audit` found 90 advisories at the start of this review. Three were real, safely-fixable production-runtime findings and were patched via `pnpm.overrides` in the root `package.json` (verified: quality gate stayed green after the bump):

- `body-parser` (pulled in by `@nestjs/platform-express`) — DoS when an invalid `limit` value silently disables size enforcement. Pinned to `>=1.20.6 <2.0.0` (patch-level fix, stayed on the 1.x line deliberately — Express's own major version — to avoid an unplanned breaking bump).
- `multer` (also via `@nestjs/platform-express`) — three DoS advisories. Pinned to `>=2.1.1`. Not actually reachable today (no `FileInterceptor`/file-upload endpoint exists anywhere in `apps/api/src`), but fixed anyway since the dependency is present in the tree regardless of whether it's invoked.
- `lodash` (via `@nestjs/config`) — code-injection advisory in `_.template`, a function `@nestjs/config` never calls with attacker-controlled input. Pinned to `>=4.18.1` anyway — free, zero-risk patch bump (already resolved elsewhere in the tree at that version).

Two findings are real but **deliberately not fixed this phase** — both require a major-version upgrade with real breaking-change risk, not a patch bump:

- **`next` (21 advisories, several high-severity DoS/SSRF/middleware-bypass)** — every fix requires Next.js **15.x**; the project is pinned to 14.x (`^14.2.18`), and every advisory's vulnerable range covers all of 14.x. This is the most significant open finding, since Next.js is what actually serves the production web app. A 14→15 upgrade is a real migration (App Router changes, async request APIs) across all 8 pages rebuilt in Phase 12 — tracked as a dedicated future task, not attempted inside a security-hardening phase.
- **`@nestjs/core` (moderate, CVE-2026-35515)** — an SSE (Server-Sent Events) event-injection bug in `SseStream._transform()`. Not exploitable here: `apps/api` has no `@Sse()` endpoint anywhere. Fixing it requires NestJS 11.x, a major bump across every `@nestjs/*` package this project depends on. Deferred for the same reason as Next.js — not urgent given the vulnerable code path is unused, but a real upgrade eventually.
- **`qs` (moderate)** — a DoS in `qs.stringify` with a specific option combination. The app never calls `qs.stringify` itself (Express uses `qs.parse` internally for incoming query strings); low practical risk, left as-is.

Everything else in the audit (`tar`, `@xmldom/xmldom`, `postcss`, `vite`, `tmp`, `webpack`, `file-type`, `picomatch`, `image-size`, `esbuild`, `glob`, `ajv`, `uuid`, `vitest`, `deepmerge-ts` — 2 of them "critical" by severity label) resolves entirely to **dev/build tooling** — `@nestjs/cli`, `testcontainers`, Expo/Metro/`jest-expo`, `vitest`, Prisma's config loader — none of which ship in what a user's browser or phone actually runs, or are reachable by a request to the live app. Not zero risk (a compromised dev dependency can still run code on a developer's or CI machine), but out of scope for this phase's "harden the running app" goal; revisit if any of these tools are ever exposed to untrusted input (e.g. running `vitest --ui` publicly, which this project never does).

## Secret Scan (Phase 13, 2026-08-21)

Checked for committed secrets across the full tracked file set: `git log --all --diff-filter=A --name-only` for any `.env` file ever added (none, at any point in history — every commit that touches env config only touches `.env.example`), a broad grep across every tracked file for common secret-shaped patterns (AWS access keys, PEM private key headers, Slack/Google/GitHub/Stripe token prefixes, and a long inline `AUTH_SECRET=` assignment) — no matches. `.gitignore` covers `.env`, `.env.local`, and `.env.*.local`. All three `.env.example` files (`apps/api`, `apps/web`, `apps/mobile`) contain only placeholder values or genuinely public config (`NEXT_PUBLIC_API_URL`, `EXPO_PUBLIC_API_URL`) — nothing that needs to stay secret. The seed script's hardcoded `dev@budgetterry.local` / `dev-password-please-change` credential is a deliberate, already-documented (README Quick Start) local-only convenience, not a leaked real secret. Clean.
