import { startIntegrationDb, type IntegrationDb } from "./integration-db";

describe("database plumbing", () => {
  let db: IntegrationDb;

  beforeAll(async () => {
    db = await startIntegrationDb();
  });

  afterAll(async () => {
    await db.stop();
  });

  it("persists a user and a category created for them", async () => {
    const user = await db.prisma.user.create({
      data: { email: "plumbing-1@example.com", displayName: "Test User" },
    });

    const category = await db.prisma.category.create({
      data: { userId: user.id, name: "Groceries" },
    });

    const found = await db.prisma.category.findUniqueOrThrow({ where: { id: category.id } });

    expect(found.name).toBe("Groceries");
    expect(found.userId).toBe(user.id);
  });

  it("enforces one category name per user (ADR-008-adjacent integrity rule)", async () => {
    const user = await db.prisma.user.create({
      data: { email: "plumbing-2@example.com", displayName: "Test User" },
    });

    await db.prisma.category.create({ data: { userId: user.id, name: "Fuel" } });

    await expect(
      db.prisma.category.create({ data: { userId: user.id, name: "Fuel" } }),
    ).rejects.toThrow();
  });

  it("allows multiple transactions with no idempotency key but rejects a repeated key for the same user (ADR-007)", async () => {
    const user = await db.prisma.user.create({
      data: { email: "plumbing-3@example.com", displayName: "Test User" },
    });
    const account = await db.prisma.account.create({
      data: { userId: user.id, name: "Everyday", type: "EVERYDAY" },
    });
    const baseTransaction = {
      userId: user.id,
      accountId: account.id,
      type: "EXPENSE" as const,
      amountMinorUnits: 500,
      currency: "NZD" as const,
    };

    await db.prisma.transaction.create({
      data: { ...baseTransaction, transactionDate: new Date("2026-08-01") },
    });
    await db.prisma.transaction.create({
      data: { ...baseTransaction, transactionDate: new Date("2026-08-02") },
    });
    await db.prisma.transaction.create({
      data: {
        ...baseTransaction,
        transactionDate: new Date("2026-08-03"),
        idempotencyKey: "key-1",
      },
    });

    await expect(
      db.prisma.transaction.create({
        data: {
          ...baseTransaction,
          transactionDate: new Date("2026-08-04"),
          idempotencyKey: "key-1",
        },
      }),
    ).rejects.toThrow();
  });

  it("prevents deleting an account referenced by a transaction (ADR-008 DB-level safety net)", async () => {
    const user = await db.prisma.user.create({
      data: { email: "plumbing-4@example.com", displayName: "Test User" },
    });
    const account = await db.prisma.account.create({
      data: { userId: user.id, name: "Everyday", type: "EVERYDAY" },
    });
    await db.prisma.transaction.create({
      data: {
        userId: user.id,
        accountId: account.id,
        type: "EXPENSE",
        amountMinorUnits: 500,
        currency: "NZD",
        transactionDate: new Date("2026-08-01"),
      },
    });

    await expect(db.prisma.account.delete({ where: { id: account.id } })).rejects.toThrow();
  });
});
