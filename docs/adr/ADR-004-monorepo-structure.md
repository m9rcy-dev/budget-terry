# ADR-004: Monorepo Structure and Tooling

**Status:** Accepted
**Date:** 2026-08-14

## Context

The plan (Section 22) recommends pnpm workspaces plus Turborepo, and rules out Nx as unnecessary initial complexity. Development is solo/AI-paced (plan Section 67 explicitly frames this around limited AI coding sessions), so minimizing the number of tools and config files a session has to reason about when resuming cold matters more, at this stage, than build-time optimization across a workspace that currently has only a handful of packages.

## Decision

One Git repository. **pnpm workspaces only** — no Turborepo initially, no Nx. Structure:

```text
apps/{web, mobile, api}
packages/{types, validation, api-client, ui}
```

## Consequences

- Fewer configuration files and tools for any session (human or AI) to reconcile when resuming work.
- Slightly slower workspace-wide builds as the codebase grows — acceptable at current scale.
- Turborepo can be introduced later, without restructuring the repo, if build times become a genuine problem. This is a deliberately revisitable choice, not a permanent architectural commitment.

## Alternatives Considered

- **Turborepo from day one** — deferred, not rejected outright; add when build-time pain actually appears.
- **Nx** — rejected per the plan's own guidance, unnecessary complexity for the current stage.
- **Separate repositories per app** — rejected: breaks the goal of sharing `types`/`validation`/`api-client` contracts between web, mobile, and API without manual re-syncing.
