# AGENTS.md — Budget Terry V2

Instructions for any AI coding session (or developer) working on this repository.
Applies to `apps/web`, `apps/mobile`, `apps/api`, and every package under `packages/`.

---

## 1. Before You Start

Every session, in this order:

1. Read `docs/budget-terry-v2-plan-updated.md` (the product/engineering plan).
2. Read `PROJECT_STATUS.md` (current phase, current task, known issues).
3. Read any ADRs under `docs/adr/` relevant to the task at hand.
4. Inspect the existing implementation before writing new code — do not assume, check.
5. Run `git status` to see what's already in flight.
6. Run or inspect the current quality gate (`pnpm quality`, once it exists — see §6).

Work only on the task listed under **Next Task** in `PROJECT_STATUS.md` unless there is a documented blocker. Do not rewrite working architecture without justification. Do not perform unrelated refactoring while completing a task.

---

## 2. Project Conventions (already decided — do not re-litigate without discussion)

These were decided during planning and apply across every phase. Full rationale belongs in `docs/adr/` as those are written; this is the quick-reference summary so no session re-derives or contradicts them by accident.

- **Single-user MVP, auth-ready schema.** No login/register/session UI yet, but every domain table (`Transaction`, `Bill`, `Budget`, `Goal`, etc.) carries a required `userId` from the first migration, resolved via a fixed seeded system user. This must not require a backfill migration when real auth is added later.
- **Budget periods are configurable, anchored to payday** — `WEEKLY` / `FORTNIGHTLY` / `MONTHLY` with an `anchorDate`, not fixed to calendar months. Period boundaries are computed by walking forward from the anchor.
- **Bills and goal contributions generate linked `Transaction` rows** (`relatedBillOccurrenceId`, `relatedGoalContributionId`). `Transaction` is the single source of truth for dashboard totals, category spend, and account balances — never a separate ledger to reconcile.
- **Money is always integer minor units** (e.g. cents), never floating point. Any split/allocation (payday contributions, percentage-based budget allocation) must use the shared `allocate(totalMinorUnits, weights[])` largest-remainder utility in the domain package — do not reimplement rounding logic per feature.
- **Idempotency:** create endpoints (add expense, add income, add goal contribution, etc.) accept an `Idempotency-Key` header; replays return the original resource. State-transition endpoints (mark bill paid/skipped) are idempotent by construction — guard on current status before acting, never create a duplicate linked transaction.
- **Categories and accounts are archive-only once they have any transaction history.** Hard delete is permitted only when a category/account has zero transactions referencing it. Renaming a category is always allowed regardless of history.
- **Monorepo:** pnpm workspaces (no Turborepo yet — add only if build times actually justify it). `apps/{web,mobile,api}` + `packages/{types,validation,api-client,ui}`.
- **Hosting:** Vercel (web), Render (API), Neon (Postgres) — all free-tier, GitHub-connected for auto-deploy on push. **Local development uses a local Docker Postgres via `docker compose up -d`, never the Neon instance directly.** Integration tests use Testcontainers against a real local Postgres.

---

## 3. Clean Code Rules

- Functions have one clear responsibility; keep methods short enough to understand at a glance.
- Prefer descriptive names over comments.
- Avoid hidden side effects, premature optimization, and unnecessary abstractions.
- No generic utility dumping grounds — shared logic goes in the package it actually belongs to (e.g. `allocate()` in the domain package, not a catch-all `utils.ts`).
- Keep domain/business rules independent of HTTP/controller concerns. Keep database access out of controllers. Keep business logic out of React components.
- Validate input at system boundaries (API request bodies), not defensively everywhere.
- Do not duplicate domain rules across web/mobile/api — shared rules live in `packages/`.
- Prefer composition over inheritance.
- Treat lint warnings as errors to fix, not noise. Delete dead code rather than commenting it out.
- Comments explain **why**, not what — if removing a comment wouldn't confuse a future reader, don't write it.

---

## 4. Documentation Requirements

- Public or non-obvious methods need a short doc comment covering purpose, inputs/outputs, errors, and important business rules — not restating the method name.
- Any change to behavior, architecture, configuration, or setup requires updating the relevant doc under `docs/` in the same change, not as a follow-up.
- New architectural decisions (not implementation details) get an ADR under `docs/adr/`, not just a mention in a commit message or chat.

---

## 5. Testing Requirements

- **Unit tests** cover domain/business logic heavily: budget remaining/usage calculation, the `allocate()` split utility, bill status transitions, goal progress, recurring bill generation, category totals, date/period boundary math (including month-end and payday-anchor edge cases).
- **Integration tests** use a real local Postgres via Testcontainers — verify migrations, repository behavior, constraints, and API validation. No mocking the database for these.
- **API tests** cover, per important endpoint: success, validation failure, not-found, conflict where applicable, and persistence verification.
- Idempotency behavior (replayed `Idempotency-Key` returns the same resource, doesn't duplicate) and archive-vs-hard-delete behavior are both things that need explicit test coverage, not just manual verification.
- Once multi-user auth is turned on: authorization isolation (**a user must never retrieve another user's financial records**) must be integration-tested explicitly, before that feature is considered done.

---

## 6. Quality Gate

Not yet wired up — repo bootstrap (Phase 1) hasn't happened. Once it exists, the target is:

```bash
pnpm quality
# = format:check && lint && typecheck && test && test:integration && build
```

Until `pnpm quality` exists, changes are still expected to pass whatever formatter/linter/typecheck/tests already exist at that point — never skip checks because the full gate isn't wired up yet.

---

## 7. Definition of Done

A task is complete only when:

- Acceptance criteria are satisfied.
- Unit and integration tests exist where applicable, and actually pass — never claim tests passed without running them.
- Linter, formatter, and type checking pass.
- The application builds.
- Relevant documentation is updated.
- `PROJECT_STATUS.md` is updated (see §8).
- No known blocker is left unrecorded.

---

## 8. Resumable Development / End of Session

Before finishing any session:

1. Run the relevant tests, and the full quality gate where feasible.
2. Update `PROJECT_STATUS.md`: move completed work to **Completed**, record any new decisions under **Decisions Made**, write an exact **Next Task**, and record **Known Issues** honestly (including anything left broken or untested).
3. Leave the repository in a state where a new session can resume from `PROJECT_STATUS.md` alone, without needing prior chat history.

Prefer **one small, fully complete vertical slice** (API + database + UI + tests + docs for one feature) over multiple partially-implemented layers. See Section 67 of the plan for why this matters specifically for AI-assisted sessions.

---

## 9. Git

```text
main
  └── feature/BUD-xxx-description
```

Conventional commits: `feat(budget): ...`, `fix(bills): ...`, `test(goals): ...`, `docs(api): ...`.
