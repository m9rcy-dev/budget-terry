# Backup and Restore Strategy

Phase 13 (Security Hardening, plan Section 60) task. Covers local development and the production setup from ADR-009 (Vercel + Render + Neon).

## What Needs Backing Up

Only one thing: the Postgres database. Everything else in this system is either stateless (the API, both frontends) or reproducible from source (migrations, seed data). There is no file storage, no uploaded assets, nothing else holding state.

## Local Development

Local dev runs Postgres in Docker (`docker compose up -d`, ADR-009) — disposable by design, and normally recovered by re-running migrations against a fresh container rather than restoring a backup. Still, a quick manual backup is sometimes useful before a risky local experiment (e.g., testing a destructive migration by hand):

```bash
# Back up the local dev database to a file
docker compose exec -T postgres pg_dump -U budget_terry budget_terry_dev > backup.sql

# Restore it into a fresh container (docker compose down -v first to wipe the volume)
docker compose up -d
cat backup.sql | docker compose exec -T postgres psql -U budget_terry budget_terry_dev
```

For most local-dev "I broke my database" situations, the faster path is simply:

```bash
docker compose down -v          # drops the local volume entirely
docker compose up -d            # fresh empty Postgres
pnpm --filter @budget-terry/api run db:migrate
pnpm --filter @budget-terry/api run db:seed
```

## Production (Neon)

Neon (the ADR-009 production Postgres host) provides built-in point-in-time recovery and branching as a platform feature — the primary recovery mechanism for production data, not something this project needs to reimplement. Practically:

- Neon retains a window of point-in-time history (the exact retention period depends on the plan tier — check the current value in the Neon dashboard rather than trusting a number written down here, since free-tier terms are the most likely to change over time).
- Recovery is done by creating a new branch from a past point in time (via Neon's dashboard or CLI) and pointing `DATABASE_URL` at it, rather than an in-place restore — which has the added benefit of being non-destructive: the "bad" state is never touched, so a recovery attempt can't make things worse.

**Defense in depth beyond the platform feature**: relying solely on one hosting provider's built-in retention is a single point of failure if that provider has an outage or the retention window has already passed by the time data loss is noticed. A periodic off-platform export is cheap insurance:

```bash
# Run this against the production DATABASE_URL (from Render's environment,
# or Neon's dashboard) — never commit the output, it contains real user data.
pg_dump "$PRODUCTION_DATABASE_URL" --format=custom --file="budget-terry-$(date +%Y%m%d).dump"
```

This isn't automated yet (no scheduled job exists to run it) — at current single-user, pre-launch scale, a manual export before any risky production change (a migration, a major dependency upgrade) is the practical near-term approach. Automating a recurring export (e.g., a scheduled GitHub Action piping to encrypted cloud storage) is a reasonable follow-up once there's real user data worth protecting on a schedule rather than on-demand.

## Restore Runbook

1. **Platform point-in-time recovery** (preferred — non-destructive): use Neon's dashboard/CLI to create a new branch at the desired point in time, get its connection string, and update `DATABASE_URL` in Render's environment configuration to point at it. Verify the app works against the restored branch before deleting the old one.
2. **Restore from a manual `pg_dump` export** (fallback, if platform recovery is unavailable or insufficient):
   ```bash
   pg_restore --dbname="$TARGET_DATABASE_URL" --clean --if-exists budget-terry-YYYYMMDD.dump
   ```
   `--clean --if-exists` drops existing objects before recreating them, so this is safe to run against an already-provisioned (but wrong-state) database, not just an empty one.
3. **After any restore**: run `pnpm --filter @budget-terry/api run db:migrate` to confirm the restored schema is at the latest migration (a backup taken before a since-applied migration would otherwise leave the schema behind).

## What's Explicitly Not Covered

- **Point-in-time recovery mid-transaction** — Postgres/Neon's own consistency guarantees handle this; not something this project's tooling needs to reason about separately.
- **Cross-region disaster recovery** — out of scope at hobby-app scale; would only become relevant at a size where Neon's own regional availability stops being sufficient.
