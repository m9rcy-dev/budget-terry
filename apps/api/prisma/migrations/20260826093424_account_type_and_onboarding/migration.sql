-- AlterEnum
-- Prisma's raw diff for this change casts existing rows straight through
-- ("type"::text::"AccountType_new"), which fails for any row still holding
-- EVERYDAY/CASH since neither value exists in the new enum. The CASE
-- expression below remaps them instead of dropping the migration into the
-- new enum blind: EVERYDAY -> CHEQUE (same concept, renamed), CASH -> OTHER
-- (no longer a distinct type; this app's usage is digital-only).
-- See docs/onboarding-plan.md, "Account Type Enum Change".
BEGIN;
CREATE TYPE "AccountType_new" AS ENUM ('CHEQUE', 'SAVINGS', 'CREDIT_CARD', 'OTHER');
ALTER TABLE "accounts" ALTER COLUMN "type" TYPE "AccountType_new" USING (
  CASE "type"::text
    WHEN 'EVERYDAY' THEN 'CHEQUE'
    WHEN 'CASH' THEN 'OTHER'
    ELSE "type"::text
  END
)::"AccountType_new";
ALTER TYPE "AccountType" RENAME TO "AccountType_old";
ALTER TYPE "AccountType_new" RENAME TO "AccountType";
DROP TYPE "public"."AccountType_old";
COMMIT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "onboardingCompletedAt" TIMESTAMP(3);

-- Backfill: existing users have already effectively "onboarded" themselves,
-- so they must never be forced through the new one-time onboarding flow
-- retroactively. Backfilling to createdAt (not now()) avoids a misleading
-- "everyone onboarded at the exact moment this migration ran" artifact if
-- this field is ever surfaced (e.g. analytics). Hand-added — Prisma's diff
-- engine only emits DDL, never data-mutating SQL.
UPDATE "users" SET "onboardingCompletedAt" = "createdAt" WHERE "onboardingCompletedAt" IS NULL;
