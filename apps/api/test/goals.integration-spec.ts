import request from "supertest";
import { startIntegrationApp, type IntegrationApp } from "./integration-app";

describe("goals", () => {
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
  ): Promise<{ accessToken: string; accountId: string }> {
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

    return { accessToken, accountId: account.body.id };
  }

  it("computes progress matching the plan's own worked example (40.6%)", async () => {
    const { accessToken, accountId } = await registerUserWithAccount("alice-goal@example.com");

    const goal = await http()
      .post("/goals")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "Japan Holiday", targetAmountMinorUnits: 800000, accountId })
      .expect(201);

    const updated = await http()
      .post(`/goals/${goal.body.id}/contributions`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ amountMinorUnits: 325000 })
      .expect(201);

    expect(updated.body.savedMinorUnits).toBe(325000);
    expect(updated.body.remainingMinorUnits).toBe(475000);
    expect(updated.body.percentageComplete).toBe(40.6);
  });

  it("a contribution creates a linked transaction visible in the ledger", async () => {
    const { accessToken, accountId } = await registerUserWithAccount("bob-goal@example.com");

    const goal = await http()
      .post("/goals")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "Emergency Fund", targetAmountMinorUnits: 500000, accountId })
      .expect(201);

    const updated = await http()
      .post(`/goals/${goal.body.id}/contributions`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ amountMinorUnits: 20000 })
      .expect(201);
    const transactionId = updated.body.contributions[0].relatedTransactionId;
    expect(transactionId).toBeTruthy();

    const transaction = await http()
      .get(`/transactions/${transactionId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    expect(transaction.body).toMatchObject({
      accountId,
      type: "EXPENSE",
      amountMinorUnits: 20000,
    });
  });

  it("rejects contributing to a goal with no default account and no accountId provided", async () => {
    const { accessToken } = await registerUserWithAccount("carol-goal@example.com");

    const goal = await http()
      .post("/goals")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "New Computer", targetAmountMinorUnits: 300000 })
      .expect(201);

    await http()
      .post(`/goals/${goal.body.id}/contributions`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ amountMinorUnits: 5000 })
      .expect(400);
  });

  it("supports the complete/archive/restore lifecycle, hiding archived goals by default", async () => {
    const { accessToken } = await registerUserWithAccount("dave-goal@example.com");

    const goal = await http()
      .post("/goals")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "Christmas", targetAmountMinorUnits: 100000 })
      .expect(201);

    const completed = await http()
      .post(`/goals/${goal.body.id}/complete`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(201);
    expect(completed.body.status).toBe("COMPLETED");

    const archived = await http()
      .post(`/goals/${goal.body.id}/archive`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(201);
    expect(archived.body.status).toBe("ARCHIVED");

    const defaultList = await http()
      .get("/goals")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    expect(defaultList.body).toHaveLength(0);

    const withArchived = await http()
      .get("/goals?includeArchived=true")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    expect(withArchived.body).toHaveLength(1);

    const restored = await http()
      .post(`/goals/${goal.body.id}/restore`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(201);
    expect(restored.body.status).toBe("ACTIVE");
  });

  it("CRITICAL: a user cannot read, edit, contribute to, or archive another user's goal", async () => {
    const userA = await registerUserWithAccount("erin-goal@example.com");
    const userB = await registerUserWithAccount("frank-goal@example.com");

    const goalA = await http()
      .post("/goals")
      .set("Authorization", `Bearer ${userA.accessToken}`)
      .send({ name: "House Deposit", targetAmountMinorUnits: 5000000, accountId: userA.accountId })
      .expect(201);

    await http()
      .get(`/goals/${goalA.body.id}`)
      .set("Authorization", `Bearer ${userB.accessToken}`)
      .expect(404);

    await http()
      .patch(`/goals/${goalA.body.id}`)
      .set("Authorization", `Bearer ${userB.accessToken}`)
      .send({ name: "Hijacked" })
      .expect(404);

    await http()
      .post(`/goals/${goalA.body.id}/contributions`)
      .set("Authorization", `Bearer ${userB.accessToken}`)
      .send({ amountMinorUnits: 1000, accountId: userB.accountId })
      .expect(404);

    await http()
      .post(`/goals/${goalA.body.id}/archive`)
      .set("Authorization", `Bearer ${userB.accessToken}`)
      .expect(404);

    const listForB = await http()
      .get("/goals")
      .set("Authorization", `Bearer ${userB.accessToken}`)
      .expect(200);
    expect(listForB.body).toHaveLength(0);
  });
});
