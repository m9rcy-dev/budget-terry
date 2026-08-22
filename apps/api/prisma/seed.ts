import * as argon2 from "argon2";
import { PrismaClient } from "@prisma/client";
import { seedDefaultCategories } from "../src/categories/default-categories";

const prisma = new PrismaClient();

/**
 * Local dev convenience only — never a production credential. Log in with
 * this email/password after `pnpm db:seed` to explore the app without
 * registering a real account. Real auth (ADR-011) makes this just a
 * normal user row, not a special-cased "current user".
 */
const DEV_EMAIL = "dev@budgetterry.local";
const DEV_PASSWORD = "dev-password-please-change";

async function main(): Promise<void> {
  const passwordHash = await argon2.hash(DEV_PASSWORD, { type: argon2.argon2id });

  const user = await prisma.user.upsert({
    where: { email: DEV_EMAIL },
    update: {},
    create: { email: DEV_EMAIL, displayName: "Dev Account", passwordHash },
  });

  await seedDefaultCategories(prisma, user.id);

  console.warn(
    `Seeded dev account: ${DEV_EMAIL} / ${DEV_PASSWORD} (local dev only — never use in production) plus default categories.`,
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
