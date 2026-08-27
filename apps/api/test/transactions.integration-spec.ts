import request from "supertest";
import { startIntegrationApp, type IntegrationApp } from "./integration-app";

describe("transactions", () => {
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
      .send({ name: "Everyday", type: "CHEQUE", currency: "NZD" })
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

  it("creates an expense and an income transaction, both appear in the list", async () => {
    const { accessToken, accountId, categoryId } =
      await registerUserWithAccount("alice-txn@example.com");

    await http()
      .post("/transactions")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        accountId,
        categoryId,
        type: "EXPENSE",
        amountMinorUnits: 1500,
        transactionDate: "2026-08-10",
        merchant: "Countdown",
      })
      .expect(201);

    await http()
      .post("/transactions")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ accountId, type: "INCOME", amountMinorUnits: 400000, transactionDate: "2026-08-01" })
      .expect(201);

    const list = await http()
      .get("/transactions")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(list.body.total).toBe(2);
    expect(list.body.items).toHaveLength(2);
  });

  it("rejects creating a transaction against another user's account", async () => {
    const userA = await registerUserWithAccount("bob-txn@example.com");
    const userB = await registerUserWithAccount("carol-txn@example.com");

    await http()
      .post("/transactions")
      .set("Authorization", `Bearer ${userB.accessToken}`)
      .send({
        accountId: userA.accountId,
        type: "EXPENSE",
        amountMinorUnits: 500,
        transactionDate: "2026-08-10",
      })
      .expect(404);
  });

  it("replays a repeated Idempotency-Key instead of creating a duplicate", async () => {
    const { accessToken, accountId } = await registerUserWithAccount("dave-txn@example.com");
    const body = {
      accountId,
      type: "EXPENSE",
      amountMinorUnits: 700,
      transactionDate: "2026-08-05",
    };

    const first = await http()
      .post("/transactions")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Idempotency-Key", "retry-key-1")
      .send(body)
      .expect(201);

    const second = await http()
      .post("/transactions")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Idempotency-Key", "retry-key-1")
      .send(body)
      .expect(201);

    expect(second.body.id).toBe(first.body.id);

    const list = await http()
      .get("/transactions")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    expect(list.body.total).toBe(1);
  });

  it("filters by type, account, date range, and search text", async () => {
    const { accessToken, accountId, categoryId } =
      await registerUserWithAccount("erin-txn@example.com");

    await http()
      .post("/transactions")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        accountId,
        categoryId,
        type: "EXPENSE",
        amountMinorUnits: 1200,
        transactionDate: "2026-08-05",
        merchant: "Coffee Supreme",
      })
      .expect(201);
    await http()
      .post("/transactions")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        accountId,
        type: "EXPENSE",
        amountMinorUnits: 3000,
        transactionDate: "2026-07-01",
        merchant: "BP Fuel",
      })
      .expect(201);
    await http()
      .post("/transactions")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ accountId, type: "INCOME", amountMinorUnits: 400000, transactionDate: "2026-08-01" })
      .expect(201);

    const expensesOnly = await http()
      .get("/transactions?type=EXPENSE")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    expect(expensesOnly.body.total).toBe(2);

    const augustOnly = await http()
      .get("/transactions?from=2026-08-01&to=2026-08-31")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    expect(augustOnly.body.total).toBe(2);

    const searchCoffee = await http()
      .get("/transactions?search=coffee")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    expect(searchCoffee.body.total).toBe(1);
    expect(searchCoffee.body.items[0].merchant).toBe("Coffee Supreme");
  });

  it("paginates results", async () => {
    const { accessToken, accountId } = await registerUserWithAccount("frank-txn@example.com");

    for (let i = 0; i < 5; i += 1) {
      await http()
        .post("/transactions")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          accountId,
          type: "EXPENSE",
          amountMinorUnits: 100 + i,
          transactionDate: "2026-08-01",
        })
        .expect(201);
    }

    const firstPage = await http()
      .get("/transactions?page=1&pageSize=2")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    expect(firstPage.body.items).toHaveLength(2);
    expect(firstPage.body.total).toBe(5);

    const secondPage = await http()
      .get("/transactions?page=2&pageSize=2")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    expect(secondPage.body.items).toHaveLength(2);
    expect(secondPage.body.items[0].id).not.toBe(firstPage.body.items[0].id);
  });

  it("computes category totals for expenses in a date range, with an Uncategorized bucket", async () => {
    const { accessToken, accountId, categoryId } =
      await registerUserWithAccount("grace-txn@example.com");

    await http()
      .post("/transactions")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        accountId,
        categoryId,
        type: "EXPENSE",
        amountMinorUnits: 1000,
        transactionDate: "2026-08-05",
      })
      .expect(201);
    await http()
      .post("/transactions")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        accountId,
        categoryId,
        type: "EXPENSE",
        amountMinorUnits: 500,
        transactionDate: "2026-08-10",
      })
      .expect(201);
    await http()
      .post("/transactions")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ accountId, type: "EXPENSE", amountMinorUnits: 250, transactionDate: "2026-08-12" })
      .expect(201);
    // Income should never appear in category totals.
    await http()
      .post("/transactions")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ accountId, type: "INCOME", amountMinorUnits: 400000, transactionDate: "2026-08-01" })
      .expect(201);

    const totals = await http()
      .get("/transactions/category-totals?from=2026-08-01&to=2026-08-31")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    const groceriesTotal = totals.body.find(
      (entry: { categoryId: string }) => entry.categoryId === categoryId,
    );
    const uncategorizedTotal = totals.body.find(
      (entry: { categoryId: string }) => entry.categoryId === "uncategorized",
    );

    expect(groceriesTotal.totalMinorUnits).toBe(1500);
    expect(uncategorizedTotal.totalMinorUnits).toBe(250);
  });

  it("edits and deletes a transaction", async () => {
    const { accessToken, accountId } = await registerUserWithAccount("henry-txn@example.com");
    const created = await http()
      .post("/transactions")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ accountId, type: "EXPENSE", amountMinorUnits: 500, transactionDate: "2026-08-05" })
      .expect(201);

    const updated = await http()
      .patch(`/transactions/${created.body.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ amountMinorUnits: 999, merchant: "Corrected" })
      .expect(200);
    expect(updated.body.amountMinorUnits).toBe(999);
    expect(updated.body.merchant).toBe("Corrected");

    await http()
      .delete(`/transactions/${created.body.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(204);

    await http()
      .get(`/transactions/${created.body.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(404);
  });

  it("CRITICAL: a user cannot read, edit, or delete another user's transaction", async () => {
    const userA = await registerUserWithAccount("iris-txn@example.com");
    const userB = await registerUserWithAccount("jack-txn@example.com");

    const transactionA = await http()
      .post("/transactions")
      .set("Authorization", `Bearer ${userA.accessToken}`)
      .send({
        accountId: userA.accountId,
        type: "EXPENSE",
        amountMinorUnits: 500,
        transactionDate: "2026-08-05",
      })
      .expect(201);

    await http()
      .get(`/transactions/${transactionA.body.id}`)
      .set("Authorization", `Bearer ${userB.accessToken}`)
      .expect(404);

    await http()
      .patch(`/transactions/${transactionA.body.id}`)
      .set("Authorization", `Bearer ${userB.accessToken}`)
      .send({ amountMinorUnits: 1 })
      .expect(404);

    await http()
      .delete(`/transactions/${transactionA.body.id}`)
      .set("Authorization", `Bearer ${userB.accessToken}`)
      .expect(404);

    // Also cannot see user A's transactions mixed into their own list.
    const listForB = await http()
      .get("/transactions")
      .set("Authorization", `Bearer ${userB.accessToken}`)
      .expect(200);
    expect(listForB.body.items).toHaveLength(0);
  });
});
