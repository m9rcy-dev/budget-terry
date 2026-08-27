# Trusted-Device Login (Skip the Login-Code Prompt on Known Devices)

**Status:** Draft — under review
**Date:** 2026-08-26

## Context

Scoped down from "passkey/trusted-device support" — confirmed with the user this means a simple trusted-device mechanism, not real WebAuthn passkeys (biometric/hardware credentials, a much larger undertaking needing a WebAuthn library and platform-specific UI on both web and mobile).

Important clarification made while researching this: a device that's already logged in essentially never sees a prompt today. `ADR-011`'s refresh-token model (`apps/api/src/auth/auth.service.ts`) already keeps a device silently signed in for up to 30 days, rotating on every use — `restoreSession()` on app launch exchanges the persisted refresh token with zero UI. So "the passcode prompt" this item is actually about is specifically the **login-code (magic email code) flow** (`POST /auth/login-code/request` + `/verify`) — the case where a device has no valid session (after an explicit logout, or the refresh token expired/was revoked) and the user chooses passwordless login. Password login itself has no "prompt" to skip beyond typing the password, so it's out of scope here.

## Decision

A new, separate **device trust token** — opaque, long-lived (90 days), stored server-side as a hash (same shape as `RefreshToken`), issued only when the user opts in ("Remember this device") on a successful login-code verification. It survives logout (unlike the refresh token, which logout explicitly revokes) — that's the point: a trusted device should skip the _code_ step even after signing out, not skip authentication forever. It does **not** skip password login — only the login-code path, since that's the specific "prompt" in scope.

## Backend

1. **`apps/api/prisma/schema.prisma`** — new `DeviceTrust` model, mirroring `RefreshToken`'s shape (`apps/api/prisma/schema.prisma:109-119`):

   ```prisma
   model DeviceTrust {
     id         String    @id @default(uuid()) @db.Uuid
     userId     String    @db.Uuid
     tokenHash  String    @unique
     expiresAt  DateTime
     revokedAt  DateTime?
     lastUsedAt DateTime  @default(now())
     createdAt  DateTime  @default(now())

     user User @relation(fields: [userId], references: [id], onDelete: Cascade)

     @@index([userId])
   }
   ```

   Migration via the same `prisma migrate dev --create-only` + review flow used for the onboarding/account-type migration (pure additive DDL this time, no hand-written backfill needed).

2. **`packages/validation/src/auth.ts`** — add `rememberDevice: z.boolean().optional()` to `verifyLoginCodeSchema` (`auth.ts:22-25`).

3. **`packages/types/src/auth.ts`** — `AuthResponse` gains an optional `deviceTrustToken?: string` (only present when `rememberDevice` was true and verification succeeded).

4. **`apps/api/src/auth/token.service.ts`** — add `generateDeviceTrustToken()`/`hashDeviceTrustToken()`, same opaque-random-token-plus-hash pattern already used for refresh tokens (`generateRefreshToken`/`hashRefreshToken`).

5. **`apps/api/src/auth/auth.service.ts`**:
   - `verifyLoginCode` accepts the `rememberDevice` flag; when true, additionally creates a `DeviceTrust` row and includes the plaintext token in the response.
   - New `deviceLogin(deviceTrustToken: string): Promise<AuthResponse>` — hash the presented token, look up an unrevoked/unexpired `DeviceTrust` row by hash (not by email — the token itself identifies the user), reject with the same generic `UnauthorizedException` pattern as `login-code/verify` on any failure (unknown/expired/revoked token — never reveal which). On success: **rotate** the trust token (issue a new one, revoke the old — same reasoning as refresh-token rotation, ADR-011), update `lastUsedAt`, and call the existing `issueTokens(user)` to also get a normal access+refresh token pair.

6. **`apps/api/src/auth/auth.controller.ts`** — new `@Public() @Throttle(AUTH_THROTTLE) @Post("device-login")` endpoint, body `{ deviceTrustToken: string }`, mirrors the shape/throttle of the existing login-code endpoints.

7. **`apps/api/src/auth/auth.service.spec.ts`** / **`apps/api/test/auth.integration-spec.ts`** — cover: verifying with `rememberDevice: true` returns a `deviceTrustToken`; `device-login` with that token succeeds and rotates it (the old token stops working, matching the existing refresh-token-rotation test's shape); an unknown/expired/revoked token is rejected generically.

## Shared package

8. **`packages/api-client/src/client.ts`** — new `TokenStorage`-adjacent concept: a second storage slot for the device trust token (extend `TokenStorage` interface with optional `getDeviceTrustToken`/`setDeviceTrustToken`, or a second constructor-injected storage — keep it separate from the existing refresh-token storage so a `logout()` call can clear the refresh token without touching device trust). `verifyLoginCode` persists the returned `deviceTrustToken` when present. New `tryDeviceLogin(): Promise<AuthenticatedUser | null>` — reads the stored trust token, calls `/auth/device-login`, persists the rotated token from the response, returns the user (or `null`/clears storage on failure) — same shape as `restoreSession()`.

## Frontend (web + mobile)

9. **`apps/web/src/lib/auth-context.tsx`** / **`apps/mobile/lib/auth-context.tsx`** — on mount, only call `tryDeviceLogin()` as a fallback _after_ `restoreSession()` finds no active session (a device with a live refresh token doesn't need this at all).

10. **Login-code verify step** (wherever the code-entry UI lives on each platform) — add a "Remember this device" checkbox, off by default, passed through as `rememberDevice`.

## Explicitly out of scope this pass

- A "manage trusted devices" UI (list/revoke) — the data model supports it (`revokedAt`, `lastUsedAt`) but building that screen is a separate, smaller follow-up once this lands.
- Trusting a device for password login — only the login-code path, per the actual "prompt" being skipped.
- Real WebAuthn passkeys — explicitly descoped per the earlier clarification.

## Verification

- `pnpm quality`.
- Manual: verify a login code with "Remember this device" checked → log out → reload the login screen → confirm it signs back in with zero code prompt. Confirm an _unchecked_ verification does **not** grant this (logging out still requires a fresh code next time).
- Confirm a revoked/expired trust token correctly falls through to the normal login UI rather than erroring visibly.
