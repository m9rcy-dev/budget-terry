import request from "supertest";
import { startIntegrationApp, type IntegrationApp } from "./integration-app";

describe("dashboard", () => {
  let integrationApp: IntegrationApp;

  beforeAll(async () => {
    integrationApp = await startIntegrationApp();
  });

  afterAll(async () => {
    await integrationApp.stop();
  });

  function http() {
    return request(integrationApp.app.getHttpServer());
  }

  async function registerUserWithAccount(
    email: string,
  ): Promise<{ accessToken: string; accountId: string; categoryId: string }> {
    const registerResponse = await http()
      .post("/auth/register")
      .send({ email, password: "a-very-long-password", displayName: "Test" })
      .expect(201);
    const accessToken = registerResponse.body.accessToken as string;

    const account = await http()
      .post("/accounts")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "Everyday", type: "EVERYDAY", currency: "NZD" })
      .expect(201);

    const categories = await http()
      .get("/categories")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    const groceries = categories.body.find(
      (category: { name: string }) => category.name === "Groceries",
    );

    return { accessToken, accountId: account.body.id, categoryId: groceries.id };
  }

  it("computes income, expenses, net, category totals, and recent transactions for a given range", async () => {
    const { accessToken, accountId, categoryId } =
      await registerUserWithAccount("alice-dash@example.com");

    await http()
      .post("/transactions")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ accountId, type: "INCOME", amountMinorUnits: 400000, transactionDate: "2026-01-05" })
      .expect(201);
    await http()
      .post("/transactions")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        accountId,
        categoryId,
        type: "EXPENSE",
        amountMinorUnits: 15000,
        transactionDate: "2026-01-10",
      })
      .expect(201);
    await http()
      .post("/transactions")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ accountId, type: "EXPENSE", amountMinorUnits: 5000, transactionDate: "2026-01-12" })
      .expect(201);
    // Outside the queried range — must not affect the totals.
    await http()
      .post("/transactions")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ accountId, type: "EXPENSE", amountMinorUnits: 999999, transactionDate: "2025-12-01" })
      .expect(201);

    const summary = await http()
      .get("/dashboard/summary?from=2026-01-01&to=2026-01-31")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(summary.body.period).toEqual({ from: "2026-01-01", to: "2026-01-31" });
    expect(summary.body.incomeMinorUnits).toBe(400000);
    expect(summary.body.expensesMinorUnits).toBe(20000);
    expect(summary.body.netMinorUnits).toBe(380000);
    // "Recent" is deliberately the most recent overall, not scoped to the
    // queried range — so all 4 created transactions appear here, including
    // the one dated outside from/to.
    expect(summary.body.recentTransactions).toHaveLength(4);

    const groceriesTotal = summary.body.categoryTotals.find(
      (entry: { categoryId: string }) => entry.categoryId === categoryId,
    );
    expect(groceriesTotal.totalMinorUnits).toBe(15000);
  });

  it("defaults to the current calendar month when from/to are omitted", async () => {
    const { accessToken, accountId } = await registerUserWithAccount("bob-dash@example.com");

    const today = new Date().toISOString().slice(0, 10);
    await http()
      .post("/transactions")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ accountId, type: "INCOME", amountMinorUnits: 100000, transactionDate: today })
      .expect(201);

    const summary = await http()
      .get("/dashboard/summary")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(summary.body.incomeMinorUnits).toBe(100000);
    expect(summary.body.period.to).toBe(today);
  });

  it("CRITICAL: a user's dashboard never reflects another user's transactions", async () => {
    const userA = await registerUserWithAccount("carol-dash@example.com");
    const userB = await registerUserWithAccount("dave-dash@example.com");

    await http()
      .post("/transactions")
      .set("Authorization", `Bearer ${userA.accessToken}`)
      .send({
        accountId: userA.accountId,
        type: "INCOME",
        amountMinorUnits: 999999,
        transactionDate: "2026-01-05",
      })
      .expect(201);

    const summaryForB = await http()
      .get("/dashboard/summary?from=2026-01-01&to=2026-01-31")
      .set("Authorization", `Bearer ${userB.accessToken}`)
      .expect(200);

    expect(summaryForB.body.incomeMinorUnits).toBe(0);
    expect(summaryForB.body.recentTransactions).toHaveLength(0);
  });

  it("rejects an unauthenticated request", async () => {
    await http().get("/dashboard/summary").expect(401);
  });
});
