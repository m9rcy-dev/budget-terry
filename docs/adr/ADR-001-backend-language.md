# ADR-001: Backend Language and Framework

**Status:** Accepted
**Date:** 2026-08-14

## Context

The plan (Sections 14–15) weighs NestJS/TypeScript against FastAPI/Python for the backend, and requires this comparison be recorded as an ADR before implementation begins. Budget Terry V2 targets Web, iOS, and Android from a single backend. TypeScript is already the chosen language for shared types/validation across the stack. Development is solo/AI-paced, so consistency and low context-switching overhead across sessions matters more than raw runtime performance at this stage.

We also considered folding the API into Next.js API routes instead of running a standalone backend app, to reduce the number of apps in the monorepo.

## Decision

Use **NestJS + TypeScript + Node.js** as a standalone `apps/api`, with **Prisma** as the ORM. The API is not folded into Next.js — React Native needs an independently deployable API regardless of Next.js's own build/runtime lifecycle, so a separate API app is justified by the mobile requirement alone, not just architectural preference.

## Consequences

- One language (TypeScript) across web, mobile, API, and shared packages — reduces context switching for solo/AI-assisted development.
- NestJS's controller/service/repository module structure gives a consistent scaffold that any coding session (human or AI) can resume into without reconstructing conventions from scratch.
- FastAPI/Python remains a viable option later for a separate analytics/forecasting/ML service if that need becomes substantial — this decision does not rule it out permanently, only for the core API.

## Alternatives Considered

- **FastAPI + Python** — rejected for the core API: introduces a second primary language and duplicated DTO/contract definitions between TypeScript clients and a Python backend.
- **Folding the API into Next.js route handlers** — rejected: mobile needs a standalone REST API it can call independent of the web app's deploy lifecycle.
