import request from "supertest";
import { startIntegrationApp, type IntegrationApp } from "./integration-app";

describe("budgets", () => {
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

  async function registerUserWithAccount(email: string): Promise<{
    accessToken: string;
    accountId: string;
    categoryId: string;
    secondCategoryId: string;
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

    const categories = await http()
      .get("/categories")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    const groceries = categories.body.find(
      (category: { name: string }) => category.name === "Groceries",
    );
    const fuel = categories.body.find((category: { name: string }) => category.name === "Fuel");

    return {
      accessToken,
      accountId: account.body.id,
      categoryId: groceries.id,
      secondCategoryId: fuel.id,
    };
  }

  it("computes spending, remaining, and status for an overall budget", async () => {
    const { accessToken, accountId } = await registerUserWithAccount("alice-budget@example.com");
    const today = todayIso();

    const budget = await http()
      .post("/budgets")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ period: "MONTHLY", anchorDate: today, totalAmountMinorUnits: 100000 })
      .expect(201);

    await http()
      .post("/transactions")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ accountId, type: "EXPENSE", amountMinorUnits: 30000, transactionDate: today })
      .expect(201);
    await http()
      .post("/transactions")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ accountId, type: "EXPENSE", amountMinorUnits: 20000, transactionDate: today })
      .expect(201);
    // Income must never count as spending against a budget.
    await http()
      .post("/transactions")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ accountId, type: "INCOME", amountMinorUnits: 400000, transactionDate: today })
      .expect(201);

    const fetched = await http()
      .get(`/budgets/${budget.body.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(fetched.body.spentMinorUnits).toBe(50000);
    expect(fetched.body.remainingMinorUnits).toBe(50000);
    expect(fetched.body.percentageUsed).toBe(50);
    expect(fetched.body.status).toBe("HEALTHY");
    expect(fetched.body.categories).toEqual([]);
  });

  it("computes spending per category for a per-category budget, ignoring other categories", async () => {
    const { accessToken, accountId, categoryId, secondCategoryId } =
      await registerUserWithAccount("bob-budget@example.com");
    const today = todayIso();

    const budget = await http()
      .post("/budgets")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        period: "MONTHLY",
        anchorDate: today,
        categoryAllocations: [{ categoryId, amountMinorUnits: 20000 }],
      })
      .expect(201);

    await http()
      .post("/transactions")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        accountId,
        categoryId,
        type: "EXPENSE",
        amountMinorUnits: 18000,
        transactionDate: today,
      })
      .expect(201);
    // A different category's spending must not bleed into this allocation.
    await http()
      .post("/transactions")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        accountId,
        categoryId: secondCategoryId,
        type: "EXPENSE",
        amountMinorUnits: 99999,
        transactionDate: today,
      })
      .expect(201);

    const fetched = await http()
      .get(`/budgets/${budget.body.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(fetched.body.totalAmountMinorUnits).toBeNull();
    expect(fetched.body.status).toBeNull();
    expect(fetched.body.categories).toHaveLength(1);
    expect(fetched.body.categories[0]).toMatchObject({
      categoryId,
      categoryName: "Groceries",
      amountMinorUnits: 20000,
      spentMinorUnits: 18000,
      remainingMinorUnits: 2000,
      percentageUsed: 90,
      status: "APPROACHING",
    });
  });

  it("rejects a budget with both totalAmountMinorUnits and categoryAllocations", async () => {
    const { accessToken, categoryId } = await registerUserWithAccount("carol-budget@example.com");

    await http()
      .post("/budgets")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        period: "MONTHLY",
        anchorDate: todayIso(),
        totalAmountMinorUnits: 100000,
        categoryAllocations: [{ categoryId, amountMinorUnits: 20000 }],
      })
      .expect(400);
  });

  it("rejects a budget with neither totalAmountMinorUnits nor categoryAllocations", async () => {
    const { accessToken } = await registerUserWithAccount("dave-budget@example.com");

    await http()
      .post("/budgets")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ period: "MONTHLY", anchorDate: todayIso() })
      .expect(400);
  });

  it("rejects allocating a category that belongs to another user", async () => {
    const userA = await registerUserWithAccount("erin-budget@example.com");
    const userB = await registerUserWithAccount("frank-budget@example.com");

    await http()
      .post("/budgets")
      .set("Authorization", `Bearer ${userB.accessToken}`)
      .send({
        period: "MONTHLY",
        anchorDate: todayIso(),
        categoryAllocations: [{ categoryId: userA.categoryId, amountMinorUnits: 20000 }],
      })
      .expect(404);
  });

  it("edits a budget, replacing its category allocations", async () => {
    const { accessToken, categoryId, secondCategoryId } = await registerUserWithAccount(
      "grace-budget@example.com",
    );
    const today = todayIso();

    const budget = await http()
      .post("/budgets")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        period: "MONTHLY",
        anchorDate: today,
        categoryAllocations: [{ categoryId, amountMinorUnits: 20000 }],
      })
      .expect(201);

    const updated = await http()
      .patch(`/budgets/${budget.body.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        period: "MONTHLY",
        anchorDate: today,
        categoryAllocations: [{ categoryId: secondCategoryId, amountMinorUnits: 30000 }],
      })
      .expect(200);

    expect(updated.body.categories).toHaveLength(1);
    expect(updated.body.categories[0].categoryId).toBe(secondCategoryId);
    expect(updated.body.categories[0].amountMinorUnits).toBe(30000);
  });

  it("deletes a budget", async () => {
    const { accessToken } = await registerUserWithAccount("henry-budget@example.com");
    const budget = await http()
      .post("/budgets")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ period: "WEEKLY", anchorDate: todayIso(), totalAmountMinorUnits: 50000 })
      .expect(201);

    await http()
      .delete(`/budgets/${budget.body.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(204);
    await http()
      .get(`/budgets/${budget.body.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(404);
  });

  it("CRITICAL: a user cannot read, edit, or delete another user's budget", async () => {
    const userA = await registerUserWithAccount("iris-budget@example.com");
    const userB = await registerUserWithAccount("jack-budget@example.com");

    const budgetA = await http()
      .post("/budgets")
      .set("Authorization", `Bearer ${userA.accessToken}`)
      .send({ period: "MONTHLY", anchorDate: todayIso(), totalAmountMinorUnits: 100000 })
      .expect(201);

    await http()
      .get(`/budgets/${budgetA.body.id}`)
      .set("Authorization", `Bearer ${userB.accessToken}`)
      .expect(404);

    await http()
      .patch(`/budgets/${budgetA.body.id}`)
      .set("Authorization", `Bearer ${userB.accessToken}`)
      .send({ period: "MONTHLY", anchorDate: todayIso(), totalAmountMinorUnits: 1 })
      .expect(404);

    await http()
      .delete(`/budgets/${budgetA.body.id}`)
      .set("Authorization", `Bearer ${userB.accessToken}`)
      .expect(404);

    const listForB = await http()
      .get("/budgets")
      .set("Authorization", `Bearer ${userB.accessToken}`)
      .expect(200);
    expect(listForB.body).toHaveLength(0);
  });
});
