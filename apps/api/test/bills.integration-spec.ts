import request from "supertest";
import { startIntegrationApp, type IntegrationApp } from "./integration-app";

describe("bills", () => {
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
    const electricity = categories.body.find(
      (category: { name: string }) => category.name === "Electricity",
    );

    return { accessToken, accountId: account.body.id, categoryId: electricity.id };
  }

  it("creates a one-off bill with exactly one occurrence", async () => {
    const { accessToken } = await registerUserWithAccount("alice-bill@example.com");
    const today = todayIso();

    const bill = await http()
      .post("/bills")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        name: "Car rego",
        amountMinorUnits: 12000,
        recurrence: "ONE_OFF",
        firstDueDate: today,
      })
      .expect(201);

    expect(bill.body.occurrences).toHaveLength(1);
    expect(bill.body.occurrences[0].dueDate.slice(0, 10)).toBe(today);
    expect(bill.body.occurrences[0].displayStatus).toBe("DUE_TODAY");
  });

  it("generates multiple occurrences for a recurring bill within the horizon", async () => {
    const { accessToken } = await registerUserWithAccount("bob-bill@example.com");
    const today = todayIso();

    const bill = await http()
      .post("/bills")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        name: "Electricity",
        amountMinorUnits: 18400,
        recurrence: "MONTHLY",
        firstDueDate: today,
      })
      .expect(201);

    // 90-day horizon guarantees at least the first three monthly occurrences.
    expect(bill.body.occurrences.length).toBeGreaterThanOrEqual(3);
    expect(bill.body.occurrences[0].dueDate.slice(0, 10)).toBe(today);
  });

  it("marking an occurrence paid creates a linked transaction visible in the ledger", async () => {
    const { accessToken, accountId, categoryId } =
      await registerUserWithAccount("carol-bill@example.com");
    const today = todayIso();

    const bill = await http()
      .post("/bills")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        name: "Electricity",
        amountMinorUnits: 18400,
        recurrence: "MONTHLY",
        firstDueDate: today,
        accountId,
        categoryId,
      })
      .expect(201);
    const occurrenceId = bill.body.occurrences[0].id;

    const paid = await http()
      .post(`/bills/${bill.body.id}/occurrences/${occurrenceId}/pay`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({})
      .expect(201);

    expect(paid.body.occurrences[0].displayStatus).toBe("PAID");
    const transactionId = paid.body.occurrences[0].relatedTransactionId;
    expect(transactionId).toBeTruthy();

    const transaction = await http()
      .get(`/transactions/${transactionId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    expect(transaction.body).toMatchObject({
      accountId,
      categoryId,
      type: "EXPENSE",
      amountMinorUnits: 18400,
    });
  });

  it("marking an occurrence paid twice does not create a second transaction", async () => {
    const { accessToken, accountId } = await registerUserWithAccount("dave-bill@example.com");
    const today = todayIso();

    const bill = await http()
      .post("/bills")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        name: "Internet",
        amountMinorUnits: 8500,
        recurrence: "ONE_OFF",
        firstDueDate: today,
        accountId,
      })
      .expect(201);
    const occurrenceId = bill.body.occurrences[0].id;

    const first = await http()
      .post(`/bills/${bill.body.id}/occurrences/${occurrenceId}/pay`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({})
      .expect(201);
    const second = await http()
      .post(`/bills/${bill.body.id}/occurrences/${occurrenceId}/pay`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({})
      .expect(201);

    expect(second.body.occurrences[0].relatedTransactionId).toBe(
      first.body.occurrences[0].relatedTransactionId,
    );

    const transactions = await http()
      .get("/transactions")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    expect(transactions.body.total).toBe(1);
  });

  it("rejects paying a bill that has no default account and no accountId in the request", async () => {
    const { accessToken } = await registerUserWithAccount("erin-bill@example.com");
    const today = todayIso();

    const bill = await http()
      .post("/bills")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "Netflix", amountMinorUnits: 2500, recurrence: "MONTHLY", firstDueDate: today })
      .expect(201);
    const occurrenceId = bill.body.occurrences[0].id;

    await http()
      .post(`/bills/${bill.body.id}/occurrences/${occurrenceId}/pay`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({})
      .expect(400);
  });

  it("marks an occurrence skipped, and rejects skipping one that's already been paid", async () => {
    const { accessToken, accountId } = await registerUserWithAccount("frank-bill@example.com");
    const today = todayIso();

    const bill = await http()
      .post("/bills")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        name: "Internet",
        amountMinorUnits: 8500,
        recurrence: "MONTHLY",
        firstDueDate: today,
        accountId,
      })
      .expect(201);
    const [firstOccurrence, secondOccurrence] = bill.body.occurrences;

    const skipped = await http()
      .post(`/bills/${bill.body.id}/occurrences/${secondOccurrence.id}/skip`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send()
      .expect(201);
    expect(skipped.body.occurrences[1].displayStatus).toBe("SKIPPED");

    await http()
      .post(`/bills/${bill.body.id}/occurrences/${firstOccurrence.id}/pay`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({})
      .expect(201);
    await http()
      .post(`/bills/${bill.body.id}/occurrences/${firstOccurrence.id}/skip`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send()
      .expect(409);
  });

  it("archiving a bill stops future occurrence generation but keeps existing history", async () => {
    const { accessToken } = await registerUserWithAccount("grace-bill@example.com");
    const today = todayIso();

    const bill = await http()
      .post("/bills")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        name: "Insurance",
        amountMinorUnits: 5000,
        recurrence: "MONTHLY",
        firstDueDate: today,
      })
      .expect(201);
    const occurrenceCountBeforeArchive = bill.body.occurrences.length;

    const archived = await http()
      .post(`/bills/${bill.body.id}/archive`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(201);
    expect(archived.body.isArchived).toBe(true);
    expect(archived.body.occurrences).toHaveLength(occurrenceCountBeforeArchive);

    const listDefault = await http()
      .get("/bills")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    expect(listDefault.body).toHaveLength(0);

    const listWithArchived = await http()
      .get("/bills?includeArchived=true")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    expect(listWithArchived.body).toHaveLength(1);

    const restored = await http()
      .post(`/bills/${bill.body.id}/restore`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(201);
    expect(restored.body.isArchived).toBe(false);
  });

  it("editing amountMinorUnits updates PENDING occurrences but not PAID history", async () => {
    const { accessToken, accountId } = await registerUserWithAccount("henry-bill@example.com");
    const today = todayIso();

    const bill = await http()
      .post("/bills")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        name: "Electricity",
        amountMinorUnits: 18400,
        recurrence: "MONTHLY",
        firstDueDate: today,
        accountId,
      })
      .expect(201);
    const [firstOccurrence] = bill.body.occurrences;

    await http()
      .post(`/bills/${bill.body.id}/occurrences/${firstOccurrence.id}/pay`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({})
      .expect(201);

    const updated = await http()
      .patch(`/bills/${bill.body.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ amountMinorUnits: 20000 })
      .expect(200);

    expect(updated.body.occurrences[0].amountMinorUnits).toBe(18400); // paid — unchanged
    expect(updated.body.occurrences[1].amountMinorUnits).toBe(20000); // pending — updated
  });

  it("CRITICAL: a user cannot read, edit, pay, skip, or archive another user's bill", async () => {
    const userA = await registerUserWithAccount("iris-bill@example.com");
    const userB = await registerUserWithAccount("jack-bill@example.com");
    const today = todayIso();

    const billA = await http()
      .post("/bills")
      .set("Authorization", `Bearer ${userA.accessToken}`)
      .send({
        name: "Rates",
        amountMinorUnits: 30000,
        recurrence: "QUARTERLY",
        firstDueDate: today,
      })
      .expect(201);
    const occurrenceId = billA.body.occurrences[0].id;

    await http()
      .get(`/bills/${billA.body.id}`)
      .set("Authorization", `Bearer ${userB.accessToken}`)
      .expect(404);

    await http()
      .patch(`/bills/${billA.body.id}`)
      .set("Authorization", `Bearer ${userB.accessToken}`)
      .send({ name: "Hijacked" })
      .expect(404);

    await http()
      .post(`/bills/${billA.body.id}/occurrences/${occurrenceId}/pay`)
      .set("Authorization", `Bearer ${userB.accessToken}`)
      .send({ accountId: userB.accountId })
      .expect(404);

    await http()
      .post(`/bills/${billA.body.id}/occurrences/${occurrenceId}/skip`)
      .set("Authorization", `Bearer ${userB.accessToken}`)
      .send()
      .expect(404);

    await http()
      .post(`/bills/${billA.body.id}/archive`)
      .set("Authorization", `Bearer ${userB.accessToken}`)
      .expect(404);

    const listForB = await http()
      .get("/bills")
      .set("Authorization", `Bearer ${userB.accessToken}`)
      .expect(200);
    expect(listForB.body).toHaveLength(0);
  });
});
