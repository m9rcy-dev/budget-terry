import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Fixed id for the single seeded system user MVP resolves "current user"
 * to (ADR-003). Real auth will replace how this id is resolved, not the
 * schema, so keeping it a stable constant matters.
 */
export const SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000001";

const DEFAULT_CATEGORY_NAMES = [
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

async function main(): Promise<void> {
  const user = await prisma.user.upsert({
    where: { id: SYSTEM_USER_ID },
    update: {},
    create: {
      id: SYSTEM_USER_ID,
      email: "you@budgetterry.local",
      displayName: "Budget Terry",
    },
  });

  for (const name of DEFAULT_CATEGORY_NAMES) {
    await prisma.category.upsert({
      where: { userId_name: { userId: user.id, name } },
      update: {},
      create: { userId: user.id, name },
    });
  }

  console.warn(
    `Seeded system user (${user.email}) and ${DEFAULT_CATEGORY_NAMES.length} default categories.`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
