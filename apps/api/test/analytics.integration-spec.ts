import request from "supertest";
import { startIntegrationApp, type IntegrationApp } from "./integration-app";

describe("analytics", () => {
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

  function todayIso(): string {
    return new Date().toISOString().slice(0, 10);
  }

  function daysAgo(days: number): string {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - days);
    return date.toISOString().slice(0, 10);
  }

  async function registerUserWithAccount(email: string): Promise<{
    accessToken: string;
    accountId: string;
    categoryId: string;
    secondAccountId: string;
  }> {
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
    const secondAccount = await http()
      .post("/accounts")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "Savings", type: "SAVINGS", currency: "NZD" })
      .expect(201);

    const categories = await http()
      .get("/categories")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    const groceries = categories.body.find(
      (category: { name: string }) => category.name === "Groceries",
    );

    return {
      accessToken,
      accountId: account.body.id,
      secondAccountId: secondAccount.body.id,
      categoryId: groceries.id,
    };
  }

  it("composes a full summary from real transactions, a budget, a bill, and a goal contribution", async () => {
    const { accessToken, accountId, categoryId } = await registerUserWithAccount(
      "alice-analytics@example.com",
    );
    const today = todayIso();

    await http()
      .post("/transactions")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        accountId,
        categoryId,
        type: "EXPENSE",
        amountMinorUnits: 5000,
        transactionDate: today,
      })
      .expect(201);
    await http()
      .post("/transactions")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ accountId, type: "INCOME", amountMinorUnits: 400000, transactionDate: today })
      .expect(201);
    await http()
      .post("/budgets")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ period: "MONTHLY", anchorDate: today, totalAmountMinorUnits: 100000 })
      .expect(201);
    await http()
      .post("/bills")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        name: "Internet",
        amountMinorUnits: 8500,
        recurrence: "MONTHLY",
        firstDueDate: today,
      })
      .expect(201);
    const goal = await http()
      .post("/goals")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "Japan Holiday", targetAmountMinorUnits: 800000, accountId })
      .expect(201);
    await http()
      .post(`/goals/${goal.body.id}/contributions`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ amountMinorUnits: 25000 })
      .expect(201);

    const summary = await http()
      .get(`/analytics/summary?from=${daysAgo(1)}&to=${today}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(summary.body.spendingByCategory).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ categoryId, totalMinorUnits: 5000 }),
        expect.objectContaining({ categoryId: "uncategorized", totalMinorUnits: 25000 }),
      ]),
    );
    expect(summary.body.incomeVsExpenses[0]).toMatchObject({
      incomeMinorUnits: 400000,
      expensesMinorUnits: 30000,
      netMinorUnits: 370000,
    });
    expect(summary.body.budgetVsActual).toHaveLength(1);
    expect(summary.body.budgetVsActual[0]).toMatchObject({
      spentMinorUnits: 30000,
      status: "HEALTHY",
    });
    expect(summary.body.recurringExpenseSummary).toEqual([
      expect.objectContaining({ name: "Internet", monthlyEquivalentMinorUnits: 8500 }),
    ]);
    expect(summary.body.savingsContributions).toMatchObject({ totalMinorUnits: 25000 });
    expect(summary.body.goalProgress).toMatchObject({
      totalSavedMinorUnits: 25000,
      totalTargetMinorUnits: 800000,
    });
    expect(summary.body.highestExpenseCategories[0]).toMatchObject({
      categoryId: "uncategorized",
      totalMinorUnits: 25000,
    });
  });

  it("narrows spending sections to the given accountId", async () => {
    const { accessToken, accountId, secondAccountId, categoryId } = await registerUserWithAccount(
      "bob-analytics@example.com",
    );
    const today = todayIso();

    await http()
      .post("/transactions")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        accountId,
        categoryId,
        type: "EXPENSE",
        amountMinorUnits: 5000,
        transactionDate: today,
      })
      .expect(201);
    await http()
      .post("/transactions")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        accountId: secondAccountId,
        categoryId,
        type: "EXPENSE",
        amountMinorUnits: 9000,
        transactionDate: today,
      })
      .expect(201);

    const filtered = await http()
      .get(`/analytics/summary?from=${daysAgo(1)}&to=${today}&accountId=${accountId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(filtered.body.spendingByCategory).toEqual([
      expect.objectContaining({ categoryId, totalMinorUnits: 5000 }),
    ]);
  });

  it("CRITICAL: a user's analytics summary never includes another user's data", async () => {
    const userA = await registerUserWithAccount("erin-analytics@example.com");
    const userB = await registerUserWithAccount("frank-analytics@example.com");
    const today = todayIso();

    await http()
      .post("/transactions")
      .set("Authorization", `Bearer ${userA.accessToken}`)
      .send({
        accountId: userA.accountId,
        categoryId: userA.categoryId,
        type: "EXPENSE",
        amountMinorUnits: 99999,
        transactionDate: today,
      })
      .expect(201);
    await http()
      .post("/budgets")
      .set("Authorization", `Bearer ${userA.accessToken}`)
      .send({ period: "MONTHLY", anchorDate: today, totalAmountMinorUnits: 100000 })
      .expect(201);

    const summaryForB = await http()
      .get(`/analytics/summary?from=${daysAgo(1)}&to=${today}`)
      .set("Authorization", `Bearer ${userB.accessToken}`)
      .expect(200);

    expect(summaryForB.body.spendingByCategory).toEqual([]);
    expect(summaryForB.body.budgetVsActual).toEqual([]);
  });

  it("rejects a request missing the required from/to query parameters", async () => {
    const { accessToken } = await registerUserWithAccount("dave-analytics@example.com");

    await http()
      .get("/analytics/summary")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(400);
  });
});
