# ADR-011: Session and Token Strategy

**Status:** Accepted
**Date:** 2026-08-15

## Context

ADR-003 originally deferred building real authentication for MVP, resolving "current user" via a hardcoded seeded user id. That decision is now reversed (see the revision note in ADR-003) — real register/login/logout is being built in Phase 3, not deferred. This ADR covers the mechanics: how sessions are represented, where tokens live, and how password hashing works.

The plan (Section 20) recommends email + password initially, a short-lived access token plus a refresh/session token, HTTP-only cookies "where appropriate" for web, and secure platform storage for mobile. ADR-009 already put web (Vercel) and the API (Render) on different origins/domains, which matters here: cross-origin HTTP-only cookies require `SameSite=None; Secure` plus CORS configured for credentials with a specific (non-wildcard) origin, and the plan's own security baseline (Section 39) flags that cookie-authenticated web flows need CSRF consideration — real, but avoidable complexity if cookies aren't used.

## Decision

**Password hashing:** `argon2id` (via the `argon2` package), OWASP's current recommended default, satisfying the Section 39 "proven password hashing algorithm" requirement.

**Tokens:**

- **Access token** — a short-lived (15 minute) JWT, signed with `AUTH_SECRET`, containing `{ sub: userId, email }`. Never persisted to disk on any client — held in memory only (a React context on web, a React state/context on mobile). A stolen access token is only useful for 15 minutes.
- **Refresh token** — a long-lived (30 day) opaque random token, **not** a JWT. Only its hash is stored server-side, in a new `RefreshToken` table (`userId`, `tokenHash`, `expiresAt`, `revokedAt`). `POST /auth/refresh` exchanges a valid refresh token for a new access token **and rotates the refresh token** (issues a new one, revokes the old) — limits the damage window if a refresh token is ever leaked. `POST /auth/logout` revokes the current refresh token.

**Transport:** both web and mobile send the access token as a `Bearer` token in the `Authorization` header — **not** an HTTP-only cookie. This is a deliberate simplification given ADR-009's cross-origin hosting: it avoids `SameSite`/CORS-credentials configuration and the CSRF mitigation cookies would otherwise require, at the cost of the token being reachable by JS on the page it's issued to. The mitigation is that the access token is short-lived and never persisted (memory only) — an XSS vulnerability would need to run at the exact moment a token exists in memory to steal it, versus a cookie which persists across page loads.

**Storage of the refresh token:**

- **Web:** `localStorage`. Accepted trade-off, same reasoning as above — this is a personal hobby app, not handling other people's money, and the alternative (HTTP-only cookie) needs same-origin hosting to avoid CSRF/CORS complexity that doesn't exist yet. Revisit if/when web and API share an origin (e.g. via a reverse proxy) — tracked as a Phase 13 (Security Hardening) candidate, not blocking now.
- **Mobile:** Expo `SecureStore` (plan Section 13 already names this as the intended mobile option) — OS-level encrypted storage, not JS-accessible.

## Consequences

- `packages/api-client` needs to know how to attach the access token and transparently retry once on a 401 by calling `/auth/refresh` — this is shared logic, not duplicated per platform.
- Logout must revoke the specific refresh token server-side, not just discard it client-side, or a stolen refresh token would keep working after the legitimate user "logs out."
- The critical authorization test (plan Section 39 — "a user must never retrieve another user's financial records") is now directly testable, since a second real user can exist. It must be written as an integration test against a real protected endpoint, not asserted in the abstract.
- Moving web's refresh-token storage to an HTTP-only cookie later is possible without changing the API's token model — only the transport/storage layer in `packages/api-client` and the web app would change.

## Alternatives Considered

- **HTTP-only cookies for both tokens on web** — rejected for now given ADR-009's cross-origin hosting; the CSRF/CORS-credentials setup this requires is real work better scheduled deliberately (Phase 13) than absorbed into Phase 3's critical path.
- **Session tokens stored server-side only (opaque session id, no JWT)** — rejected: a JWT access token lets every request be verified without a DB round-trip, which matters more once Phase 4+ endpoints are all guarded.
- **bcrypt instead of argon2id** — bcrypt remains acceptable, but argon2id is OWASP's current first recommendation and has no meaningful downside here.
