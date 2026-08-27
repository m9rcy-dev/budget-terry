# Welcome Email on Registration

**Status:** Draft — under review
**Date:** 2026-08-26

## Context

New users currently get no email at all on sign-up — `AuthService.register()` (`apps/api/src/auth/auth.service.ts:37-51`) creates the user, seeds default categories, and issues tokens, with no email step. The original ask also included a QR code / app-store download link — confirmed with the user to **skip that part**: the app isn't published to any store yet (`docs/deployment.md:72` — EAS is internal-distribution only, store submission explicitly deferred), so a store link/QR would point at nothing real today. This is just the welcome email itself.

## Decision

Follow the exact existing pattern: `MailService` (`apps/api/src/mail/mail.service.ts`) already centralizes email copy/content outside `AuthService`, with one method (`sendLoginCode`) sent through a provider interface (`MailProvider`) that's either Resend (production) or presumably an SMTP/dev provider locally — add `sendWelcomeEmail` the same way, one new method, same file.

**Must not block or fail registration** if the email send fails — registration succeeding is far more important than a nice-to-have welcome email. Wrapped in try/catch, logged, not re-thrown (same "best-effort" precedent already used for `logout`'s refresh-token-revocation call, `apps/api/src/auth/auth.service.ts:100-107`, and note the comment there — worth logging with the existing request-logger/correlation-id middleware so a failed send is traceable, not silent).

## Backend

1. **`apps/api/src/mail/mail.service.ts`** — add:

   ```ts
   async sendWelcomeEmail(email: string, displayName: string): Promise<void> {
     await this.provider.send({
       to: email,
       subject: "Welcome to Budget Terry",
       text: `Hi ${displayName}, welcome to Budget Terry! ...`,
       html: `...`,
     });
   }
   ```

   Copy: a short welcome, one line on what to do first (matches the new onboarding flow — "create your first account to get started," since that's literally the mandatory first step now) — no store links/QR per the scope decision above.

2. **`apps/api/src/auth/auth.service.ts`** — in `register()`, after `issueTokens` (or in parallel with it, doesn't need to block the response): call `mailService.sendWelcomeEmail(user.email, user.displayName)` wrapped in `.catch(() => {})` with a log line, not awaited into the critical path (fire-and-forget, matching the "must not block registration" decision above) — or `await`ed-but-caught if the team prefers registration to only return after the email attempt resolves for testability; either is fine, but the failure must never propagate.

3. **`apps/api/src/mail/mail.service.spec.ts`** — add a `sendWelcomeEmail` test block mirroring the existing `sendLoginCode` one.

4. **`apps/api/src/auth/auth.service.spec.ts`** — extend the `register` test to assert `mailService.sendWelcomeEmail` was called with the right args, and add a case confirming registration still succeeds when the mail call rejects.

## Explicitly out of scope this pass

- QR code / app store link — revisit once the app has an actual published listing (or, sooner, once there's at least a stable EAS internal-distribution link the team is comfortable sharing).

## Verification

- `pnpm --filter @budget-terry/api run test` (unit) — new/extended specs above.
- Manual: register locally with the SMTP/dev mail provider (Mailpit, per the Quick Start docs) running, confirm the welcome email actually arrives alongside the existing login-code-email precedent already used for other flows.
- `pnpm quality`.
