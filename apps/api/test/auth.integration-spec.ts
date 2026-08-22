import request from "supertest";
import { startIntegrationApp, type IntegrationApp } from "./integration-app";

describe("auth flow", () => {
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

  it("registers a new user, returns tokens, and seeds default categories", async () => {
    const response = await http()
      .post("/auth/register")
      .send({ email: "alice@example.com", password: "a-very-long-password", displayName: "Alice" })
      .expect(201);

    expect(response.body.user.email).toBe("alice@example.com");
    expect(response.body.accessToken).toBeDefined();
    expect(response.body.refreshToken).toBeDefined();

    const me = await http()
      .get("/auth/me")
      .set("Authorization", `Bearer ${response.body.accessToken}`)
      .expect(200);
    expect(me.body.email).toBe("alice@example.com");

    const categories = await http()
      .get("/categories")
      .set("Authorization", `Bearer ${response.body.accessToken}`)
      .expect(200);
    expect(categories.body).toHaveLength(15);
  });

  it("rejects registering the same email twice", async () => {
    await http()
      .post("/auth/register")
      .send({ email: "bob@example.com", password: "a-very-long-password", displayName: "Bob" })
      .expect(201);

    await http()
      .post("/auth/register")
      .send({ email: "bob@example.com", password: "another-long-password", displayName: "Bob2" })
      .expect(409);
  });

  it("logs in with correct credentials and rejects a wrong password", async () => {
    await http()
      .post("/auth/register")
      .send({ email: "carol@example.com", password: "a-very-long-password", displayName: "Carol" })
      .expect(201);

    await http()
      .post("/auth/login")
      .send({ email: "carol@example.com", password: "a-very-long-password" })
      .expect(200);

    await http()
      .post("/auth/login")
      .send({ email: "carol@example.com", password: "wrong-password" })
      .expect(401);
  });

  it("rejects protected routes with no token, and with an invalid token", async () => {
    await http().get("/categories").expect(401);
    await http().get("/categories").set("Authorization", "Bearer not-a-real-token").expect(401);
  });

  it("refreshes an access token and rotates the refresh token so the old one stops working", async () => {
    const registerResponse = await http()
      .post("/auth/register")
      .send({ email: "dave@example.com", password: "a-very-long-password", displayName: "Dave" })
      .expect(201);

    const refreshResponse = await http()
      .post("/auth/refresh")
      .send({ refreshToken: registerResponse.body.refreshToken })
      .expect(200);

    expect(refreshResponse.body.accessToken).toBeDefined();
    expect(refreshResponse.body.refreshToken).not.toBe(registerResponse.body.refreshToken);

    await http()
      .post("/auth/refresh")
      .send({ refreshToken: registerResponse.body.refreshToken })
      .expect(401);
  });

  it("logs out and invalidates the refresh token", async () => {
    const registerResponse = await http()
      .post("/auth/register")
      .send({ email: "erin@example.com", password: "a-very-long-password", displayName: "Erin" })
      .expect(201);

    await http()
      .post("/auth/logout")
      .send({ refreshToken: registerResponse.body.refreshToken })
      .expect(204);

    await http()
      .post("/auth/refresh")
      .send({ refreshToken: registerResponse.body.refreshToken })
      .expect(401);
  });

  it("CRITICAL: a user cannot access another user's categories", async () => {
    const userA = await http()
      .post("/auth/register")
      .send({ email: "frank@example.com", password: "a-very-long-password", displayName: "Frank" })
      .expect(201);
    const userB = await http()
      .post("/auth/register")
      .send({ email: "grace@example.com", password: "a-very-long-password", displayName: "Grace" })
      .expect(201);

    const categoriesForA = await http()
      .get("/categories")
      .set("Authorization", `Bearer ${userA.body.accessToken}`)
      .expect(200);
    const categoriesForB = await http()
      .get("/categories")
      .set("Authorization", `Bearer ${userB.body.accessToken}`)
      .expect(200);

    const aIds = new Set<string>(
      categoriesForA.body.map((category: { id: string }) => category.id),
    );
    const bIds: string[] = categoriesForB.body.map((category: { id: string }) => category.id);

    for (const id of bIds) {
      expect(aIds.has(id)).toBe(false);
    }
  });
});
