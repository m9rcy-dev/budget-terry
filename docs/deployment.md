# Deployment Runbook (Phase 14)

Follows the hosting decision in [ADR-009](adr/ADR-009-hosting-and-deployment.md): Vercel (web), Render (API), Neon (database), plus Resend (production email, replacing the MailerLite mentioned in ADR-009's original write-up — see `docs/architecture/security.md`) and EAS (mobile builds).

**Scope of this first pass**: a single production environment only — no separate staging. Vercel preview deployments (per-branch/PR URLs) will be CORS-blocked by the API, since `WEB_ORIGIN` only allows one fixed origin. Accepted for a hobby-scale project (see ADR-009); revisit if this project ever needs a real staging environment.

**Domains**: `m9rcy.dev` is registered and will host multiple projects, not just this one, so budget-terry gets its own subdomain rather than the root: **`budget-terry.m9rcy.dev`** (web) and **`api.budget-terry.m9rcy.dev`** (API) — nested under the project subdomain so a future project just becomes `foo.m9rcy.dev` + `api.foo.m9rcy.dev` without colliding with this one.

Every step below requires your own account credentials — none of this can be done on your behalf. Do them in order; several steps depend on values produced by an earlier one.

## 1. Neon (database)

1. Create a new project. Note the region — pick whichever is closest to Render's region (Oregon, US West, is Render's default free-tier region).
2. From the project dashboard, copy the connection string for the default branch (`postgresql://...`). This is your `DATABASE_URL` for Render, below.
3. Do **not** run `pnpm --filter @budget-terry/api run db:seed` against this database — that script creates a known dev login (`dev@budgetterry.local` / `dev-password-please-change`) and is local-dev-only.

## 2. Render (API)

The repo's `render.yaml` is a [Blueprint](https://render.com/docs/infrastructure-as-code) — Render reads it automatically and provisions the service from it.

1. In the Render dashboard: **New** → **Blueprint**, connect the GitHub repo. Render finds `render.yaml` and shows the `budget-terry-api` service it defines.
2. You'll be prompted for the `sync: false` env vars declared in `render.yaml`. Fill in:
   - `DATABASE_URL` — the Neon connection string from step 1.
   - `AUTH_SECRET` — generate one: `openssl rand -base64 48`. Never reuse the local-dev value from `.env`.
   - `RESEND_API_KEY` — from the Resend dashboard (API Keys).
   - `MAIL_FROM` — a verified sender on the `notify.m9rcy.dev` subdomain (step 4), e.g. `Budget Terry <no-reply@notify.m9rcy.dev>`.
   - `WEB_ORIGIN` — set this to `https://budget-terry.m9rcy.dev` now (the intended final domain, not a placeholder) — you'll attach the domain to Vercel in step 3, but CORS just needs the string to match, so no need for a temporary value or coming back to fix it.
3. Deploy. First deploy runs `pnpm install`, `prisma generate && nest build` (via the `build` script), then `prisma migrate deploy` (the `preDeployCommand`, applying every migration in `apps/api/prisma/migrations/` to the fresh Neon database) before starting the service.
4. Once live at Render's default `*.onrender.com` URL, verify: `curl https://<your-service>.onrender.com/health` should return `{"status":"ok"}`. If it doesn't, check the Render logs — a 500 here almost always means `DATABASE_URL` is wrong (the health check now pings the database, not just the process — see `docs/architecture/security.md`).
5. **Attach the custom domain**: `render.yaml` already declares `domains: [api.budget-terry.m9rcy.dev]`, so Render's service settings will show it as a pending custom domain once the Blueprint syncs. Render displays the exact DNS record to add (a CNAME, typically pointing at your service's `*.onrender.com` hostname) — add that record at your DNS provider for `m9rcy.dev`. Propagation and TLS issuance can take a few minutes; Render's dashboard shows the domain going from "Pending" to "Verified".
6. Once verified, re-check: `curl https://api.budget-terry.m9rcy.dev/health` should return the same `{"status":"ok"}`.
7. Render's free tier spins the service down after inactivity — the first request after idle takes several seconds (a known, accepted trade-off, see ADR-009). Don't mistake this for a broken deploy.

## 3. Vercel (web)

1. **Add New → Project**, import the repo.
2. **Root Directory**: set to `apps/web`.
3. Framework should auto-detect as Next.js. Leave Build/Install/Output commands on their defaults — `apps/web/vercel.json` (committed in the repo) overrides just the build command to build `@budget-terry/types`/`@budget-terry/validation`/`@budget-terry/ui`/`@budget-terry/api-client` before `next build`, since `apps/web` consumes their compiled `dist` output, not raw source (same reason those packages need a manual rebuild in local dev — see `AGENTS.md`).
4. Add one environment variable before deploying: `NEXT_PUBLIC_API_URL` = `https://api.budget-terry.m9rcy.dev` (the final API domain from step 2 — safe to reference even before its DNS/TLS finishes verifying, since this is just a string baked into the client bundle, not fetched at build time). This is baked in at build time, so it must be set before the first deploy, not after.
5. Deploy. Vercel will initially be reachable only at its default `https://<project>.vercel.app` URL.
6. **Add the custom domain**: in the project's Settings → Domains, add `budget-terry.m9rcy.dev`. Vercel shows the exact DNS record to add (typically a CNAME to `cname.vercel-dns.com`) — add it at your DNS provider for `m9rcy.dev`. Vercel issues TLS automatically once DNS resolves.
7. `WEB_ORIGIN` on Render was already set to `https://budget-terry.m9rcy.dev` in step 2 — no need to come back and change it, since both domains were decided upfront.

> **If the Vercel build fails to find `@budget-terry/*` packages**: this is the one step in this runbook with genuine residual uncertainty — Vercel's exact monorepo build-sandboxing behavior with a Root Directory set wasn't something I could fully verify without an actual deploy. If the build log shows it can't resolve a workspace package, tell me the exact error and I'll adjust `apps/web/vercel.json` (the likely fix is dropping the Root Directory setting entirely and using a root-level `vercel.json` with an explicit `outputDirectory` instead).

## 4. Resend (email)

`notify.m9rcy.dev` is registered and verified as a sending subdomain in Resend — real users can receive login codes, not just the account owner. Use any address on that subdomain as `MAIL_FROM` (e.g. `no-reply@notify.m9rcy.dev`); Resend doesn't require the mailbox itself to exist, only the domain's DNS records to be verified (SPF/DKIM), which they are.

If `notify.m9rcy.dev` is ever re-verified or DNS changes, check the Resend dashboard's Domains page shows it as verified before relying on it — an unverified or newly-changed domain will silently fail to send rather than erroring loudly.

## 5. EAS (mobile — internal distribution only, no store submission)

No Apple/Google developer accounts yet (this session's scope decision) — this produces an installable build for your own device only.

```bash
cd apps/mobile
npx eas-cli login                                  # your Expo account
npx eas-cli init                                   # links this project, writes extra.eas.projectId into app.json
npx eas-cli build --profile preview --platform ios      # or --platform android
```

`eas build` runs in Expo's cloud, no local Xcode/Android Studio needed. When it finishes, EAS gives you an install link/QR code — for iOS, your device's UDID needs to be registered first (EAS walks you through this the first time via `eas device:create`); for Android, the resulting `.apk` link installs directly.

The `eas.json` committed in the repo (`apps/mobile/eas.json`) already has the `preview` profile configured for internal distribution. Its `production` profile is scaffolded but unused until real store submission is pursued (Apple Developer Program, $99/yr; Google Play Console, $25 one-time — deliberately deferred).

## 6. Smoke Test

Once both custom domains are verified and live:

1. Open `https://budget-terry.m9rcy.dev`, register a new account through the actual UI (not curl).
2. Log out, log back in via the passwordless code flow — check the registered account's inbox for the code (any address now works, not just the Resend account owner's, since `notify.m9rcy.dev` is verified).
3. Create an account/category/transaction, confirm it persists (reload the page).
4. Confirm CORS is correctly scoped: calling an authenticated endpoint at `https://api.budget-terry.m9rcy.dev` from browser devtools on a _different_ origin should be blocked; from `https://budget-terry.m9rcy.dev` it should work.

This mirrors how every previous phase in this project was verified — against the real running system, not just passing tests.
