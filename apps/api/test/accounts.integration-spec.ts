import request from "supertest";
import { startIntegrationApp, type IntegrationApp } from "./integration-app";

describe("accounts", () => {
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

  async function registerUser(email: string): Promise<{ accessToken: string }> {
    const response = await http()
      .post("/auth/register")
      .send({ email, password: "a-very-long-password", displayName: "Test" })
      .expect(201);
    return response.body;
  }

  it("creates an account and lists it for the owner", async () => {
    const { accessToken } = await registerUser("alice-accounts@example.com");

    const created = await http()
      .post("/accounts")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "Everyday", type: "CHEQUE", currency: "NZD" })
      .expect(201);

    expect(created.body.name).toBe("Everyday");
    expect(created.body.isArchived).toBe(false);

    const list = await http()
      .get("/accounts")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(list.body).toHaveLength(1);
    expect(list.body[0].id).toBe(created.body.id);
  });

  it("updates an account's name and type", async () => {
    const { accessToken } = await registerUser("bob-accounts@example.com");
    const created = await http()
      .post("/accounts")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "Everyday", type: "CHEQUE", currency: "NZD" })
      .expect(201);

    const updated = await http()
      .patch(`/accounts/${created.body.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "Main Everyday", type: "SAVINGS" })
      .expect(200);

    expect(updated.body.name).toBe("Main Everyday");
    expect(updated.body.type).toBe("SAVINGS");
  });

  it("archives and restores an account, affecting the default list", async () => {
    const { accessToken } = await registerUser("carol-accounts@example.com");
    const created = await http()
      .post("/accounts")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "Travel", type: "SAVINGS", currency: "NZD" })
      .expect(201);

    await http()
      .post(`/accounts/${created.body.id}/archive`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(201);

    const defaultList = await http()
      .get("/accounts")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    expect(defaultList.body).toHaveLength(0);

    const withArchived = await http()
      .get("/accounts?includeArchived=true")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    expect(withArchived.body).toHaveLength(1);
    expect(withArchived.body[0].isArchived).toBe(true);

    await http()
      .post(`/accounts/${created.body.id}/restore`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(201);

    const restoredList = await http()
      .get("/accounts")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    expect(restoredList.body).toHaveLength(1);
  });

  it("deletes an unreferenced account, but blocks deleting one with transaction history", async () => {
    const { accessToken } = await registerUser("dave-accounts@example.com");

    const unreferenced = await http()
      .post("/accounts")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "Unused", type: "OTHER", currency: "NZD" })
      .expect(201);

    await http()
      .delete(`/accounts/${unreferenced.body.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(204);

    const referenced = await http()
      .post("/accounts")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "In Use", type: "CHEQUE", currency: "NZD" })
      .expect(201);

    const me = await http()
      .get("/auth/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    // Transactions API doesn't exist yet (Phase 5) — create the referencing
    // row directly to exercise the delete-protection path.
    await integrationApp.prisma.transaction.create({
      data: {
        userId: me.body.id,
        accountId: referenced.body.id,
        type: "EXPENSE",
        amountMinorUnits: 500,
        currency: "NZD",
        transactionDate: new Date("2026-08-01"),
      },
    });

    await http()
      .delete(`/accounts/${referenced.body.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(409);
  });

  it("CRITICAL: a user cannot read, edit, archive, or delete another user's account", async () => {
    const userA = await registerUser("erin-accounts@example.com");
    const userB = await registerUser("frank-accounts@example.com");

    const accountA = await http()
      .post("/accounts")
      .set("Authorization", `Bearer ${userA.accessToken}`)
      .send({ name: "A's account", type: "CHEQUE", currency: "NZD" })
      .expect(201);

    await http()
      .get(`/accounts/${accountA.body.id}`)
      .set("Authorization", `Bearer ${userB.accessToken}`)
      .expect(404);

    await http()
      .patch(`/accounts/${accountA.body.id}`)
      .set("Authorization", `Bearer ${userB.accessToken}`)
      .send({ name: "Hijacked" })
      .expect(404);

    await http()
      .post(`/accounts/${accountA.body.id}/archive`)
      .set("Authorization", `Bearer ${userB.accessToken}`)
      .expect(404);

    await http()
      .delete(`/accounts/${accountA.body.id}`)
      .set("Authorization", `Bearer ${userB.accessToken}`)
      .expect(404);
  });
});
