import { z } from "zod";

export const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
});

/** Renaming is always allowed regardless of transaction history — see ADR-008. */
export const updateCategorySchema = z.object({
  name: z.string().min(1).max(100),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
