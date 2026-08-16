# Security

Source of truth for the _why_: ADR-003 (auth-ready schema, revised to build real auth in Phase 3) and ADR-011 (session/token mechanics). This document is the practical summary of what's actually implemented and how to reason about it.

## Password Storage

Passwords are hashed with **argon2id** (`argon2` package), OWASP's current recommended default. Never logged, never stored in plaintext, never compared with `===` (always via `argon2.verify`, which is timing-safe).

## Authentication Flow

- `POST /auth/register` — creates a user, hashes the password, seeds the 15 default categories for that user, returns tokens.
- `POST /auth/login` — verifies credentials, returns tokens. A wrong password and an unknown email return the **identical** generic message (`"Invalid email or password."`) — never reveal which one was wrong.
- `POST /auth/refresh` — exchanges a valid, unexpired, unrevoked refresh token for a new access token **and a new refresh token** (rotation — the old one is revoked in the same operation).
- `POST /auth/logout` — revokes the presented refresh token server-side.
- `GET /auth/me` — returns the authenticated user; requires a valid access token.

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

`JwtAuthGuard` is registered globally (`APP_GUARD`) — **every route requires a valid access token unless explicitly marked `@Public()`**. This is a fail-safe default: a new endpoint added later without thinking about auth is protected, not accidentally open. Currently `@Public()`: `GET /` (root info), `GET /health`, and the four `/auth/*` endpoints that authenticate by other means (credentials or a refresh token in the body, not an access token).

## The Critical Guarantee

> A user must never be able to retrieve another user's financial records. (Plan Section 39.)

This is enforced two ways:

1. Every authenticated request resolves `req.user` from a verified JWT — services scope every query by that id (`WHERE userId = req.user.sub`), never by a client-supplied id.
2. It's **integration-tested**, not just asserted: `apps/api/test/auth.integration-spec.ts` registers two real users against a real database and confirms neither can see the other's categories via `GET /categories`. Any future endpoint that touches user-owned data should get the same treatment.

## Known Gaps (Deliberately Deferred, Not Forgotten)

- **Structured error model** (plan Section 50 — `{ code, message, correlationId }`) isn't implemented yet; errors currently use Nest's default exception JSON shape. Worth doing once there's more than one API consumer relying on error shapes.
- **Rate limiting** on `/auth/login` and `/auth/register` isn't implemented. Plan Section 39 calls for it; it's explicitly Phase 13 (Security Hardening) scope, not Phase 3.
- **CSRF** isn't a concern under the current Bearer-token approach (no ambient credentials for a malicious page to ride along with) — revisit only if/when the HTTP-only-cookie option above is adopted.
