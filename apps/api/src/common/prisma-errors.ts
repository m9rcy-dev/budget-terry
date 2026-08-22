import { Prisma } from "@prisma/client";

/**
 * True when a write failed because it violated a foreign key constraint —
 * e.g. deleting an Account/Category still referenced by a Transaction.
 * The DB constraint (Restrict, per ADR-008) is the real safety net; this
 * just turns its rejection into a friendly 409 instead of a raw 500.
 */
export function isForeignKeyViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003";
}

/** True when a write failed because it violated a `@@unique` constraint. */
export function isUniqueConstraintViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}
