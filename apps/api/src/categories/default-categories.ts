import type { PrismaClient } from "@prisma/client";

/** Plan Section 3's example category list, seeded for every new user. */
export const DEFAULT_CATEGORY_NAMES = [
  "Mortgage / Rent",
  "Groceries",
  "Restaurants",
  "Utilities",
  "Electricity",
  "Internet",
  "Transport",
  "Fuel",
  "Insurance",
  "Health",
  "Entertainment",
  "Shopping",
  "Travel",
  "Subscriptions",
  "Miscellaneous",
];

/**
 * Shared by both real registration (AuthService) and the local-dev seed
 * script — upsert, not create, so it's always safe to call more than once.
 */
export async function seedDefaultCategories(prisma: PrismaClient, userId: string): Promise<void> {
  for (const name of DEFAULT_CATEGORY_NAMES) {
    await prisma.category.upsert({
      where: { userId_name: { userId, name } },
      update: {},
      create: { userId, name },
    });
  }
}
