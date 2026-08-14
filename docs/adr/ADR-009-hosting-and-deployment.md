# ADR-009: Hosting and Deployment Strategy

**Status:** Accepted
**Date:** 2026-08-14

## Context

The plan (Sections 14, 64) names the technology stack but not where it runs. This is a free-tier-conscious hobby project with a preference for GitHub-driven deploys, matching the existing V1 app's GitHub Pages workflow. Railway was initially considered for the API and database but no longer offers a genuine free tier (trial-credit-then-paid model), so it doesn't fit the "free as possible" requirement.

## Decision

- **Web** (`apps/web`, Next.js): hosted on **Vercel**, free Hobby tier.
- **API** (`apps/api`, NestJS): hosted on **Render**, free tier. Accepted trade-off: the service spins down after inactivity, producing a several-second cold start on the first request after idle — acceptable for a personal-use app without constant live traffic.
- **Database** (PostgreSQL, see ADR-002): production database hosted on **Neon**, free tier — serverless Postgres with no forced project pause.
- All three are connected directly to the GitHub repository for automatic deploy on push to `main` (and preview environments where supported).
- **Local development uses a local Dockerized Postgres** via `docker compose up -d` — local dev never connects to the Neon instance directly. This keeps local dev fully independent of any online service and matches the Testcontainers-based integration testing approach (ADR-002).
- Mobile builds and store submission use Expo's EAS Build/Submit when that phase is reached (plan Phase 14); no separate mobile hosting decision is needed.

## Consequences

- $0/month hosting at current scale.
- Cold starts on the API after idle periods are an accepted trade-off, not treated as a production SLA concern.
- Local dev and CI integration tests exercise a real local Postgres, keeping dev/prod parity on database engine even though the actual instances (local Docker vs Neon) differ.
- Moving any of these three off their current provider later does not require application code changes — this is a "start here, revisit if outgrown" choice, not a permanent architectural commitment.

## Alternatives Considered

- **Railway** for API + database — rejected: no longer has a free tier.
- **Supabase** for Postgres — rejected in favor of Neon: Supabase free projects pause after a week of inactivity, which is more likely to affect an intermittently-used hobby app than Neon's model.
- **Pointing local development directly at Neon** — rejected: explicit preference for local dev to remain fully independent of any online database.
