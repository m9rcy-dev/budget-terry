import request from "supertest";
import { startIntegrationApp, type IntegrationApp } from "./integration-app";

describe("categories", () => {
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

  it("creates a custom category alongside the 15 seeded defaults", async () => {
    const { accessToken } = await registerUser("alice-categories@example.com");

    const before = await http()
      .get("/categories")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    expect(before.body).toHaveLength(15);

    const created = await http()
      .post("/categories")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "Side Hustle" })
      .expect(201);

    expect(created.body.name).toBe("Side Hustle");

    const after = await http()
      .get("/categories")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    expect(after.body).toHaveLength(16);
  });

  it("rejects creating a category whose name already exists for the user", async () => {
    const { accessToken } = await registerUser("bob-categories@example.com");

    await http()
      .post("/categories")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "Groceries" })
      .expect(409);
  });

  it("renames a category, including one with transaction history", async () => {
    const { accessToken } = await registerUser("carol-categories@example.com");
    const categories = await http()
      .get("/categories")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    const groceries = categories.body.find(
      (category: { name: string }) => category.name === "Groceries",
    );

    const renamed = await http()
      .patch(`/categories/${groceries.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "Supermarket" })
      .expect(200);

    expect(renamed.body.name).toBe("Supermarket");
  });

  it("archives and restores a category, affecting the default list", async () => {
    const { accessToken } = await registerUser("dave-categories@example.com");
    const created = await http()
      .post("/categories")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "Side Hustle" })
      .expect(201);

    await http()
      .post(`/categories/${created.body.id}/archive`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(201);

    const defaultList = await http()
      .get("/categories")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    expect(defaultList.body).toHaveLength(15);

    const withArchived = await http()
      .get("/categories?includeArchived=true")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    expect(withArchived.body).toHaveLength(16);

    await http()
      .post(`/categories/${created.body.id}/restore`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(201);

    const restoredList = await http()
      .get("/categories")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    expect(restoredList.body).toHaveLength(16);
  });

  it("deletes an unreferenced category, but blocks deleting one with transaction history", async () => {
    const { accessToken } = await registerUser("erin-categories@example.com");
    const categories = await http()
      .get("/categories")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    const groceries = categories.body.find(
      (category: { name: string }) => category.name === "Groceries",
    );

    const unreferenced = await http()
      .post("/categories")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "Unused" })
      .expect(201);

    await http()
      .delete(`/categories/${unreferenced.body.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(204);

    const me = await http()
      .get("/auth/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    const account = await http()
      .post("/accounts")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "Everyday", type: "CHEQUE", currency: "NZD" })
      .expect(201);

    await integrationApp.prisma.transaction.create({
      data: {
        userId: me.body.id,
        accountId: account.body.id,
        categoryId: groceries.id,
        type: "EXPENSE",
        amountMinorUnits: 500,
        currency: "NZD",
        transactionDate: new Date("2026-08-01"),
      },
    });

    await http()
      .delete(`/categories/${groceries.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(409);
  });

  it("CRITICAL: a user cannot read, edit, archive, or delete another user's category", async () => {
    const userA = await registerUser("frank-categories@example.com");
    const userB = await registerUser("grace-categories@example.com");

    const categoryA = await http()
      .post("/categories")
      .set("Authorization", `Bearer ${userA.accessToken}`)
      .send({ name: "A's category" })
      .expect(201);

    await http()
      .get(`/categories/${categoryA.body.id}`)
      .set("Authorization", `Bearer ${userB.accessToken}`)
      .expect(404);

    await http()
      .patch(`/categories/${categoryA.body.id}`)
      .set("Authorization", `Bearer ${userB.accessToken}`)
      .send({ name: "Hijacked" })
      .expect(404);

    await http()
      .post(`/categories/${categoryA.body.id}/archive`)
      .set("Authorization", `Bearer ${userB.accessToken}`)
      .expect(404);

    await http()
      .delete(`/categories/${categoryA.body.id}`)
      .set("Authorization", `Bearer ${userB.accessToken}`)
      .expect(404);
  });
});
