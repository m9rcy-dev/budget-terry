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

  it("starts a new user with onboarding incomplete, and PATCH /auth/onboarding marks it done", async () => {
    const register = await http()
      .post("/auth/register")
      .send({
        email: "onboarding@example.com",
        password: "a-very-long-password",
        displayName: "Ono",
      })
      .expect(201);
    const token = register.body.accessToken as string;

    const before = await http().get("/auth/me").set("Authorization", `Bearer ${token}`).expect(200);
    expect(before.body.onboardingCompletedAt).toBeNull();

    const completed = await http()
      .patch("/auth/onboarding")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(completed.body.onboardingCompletedAt).toEqual(expect.any(String));

    const after = await http().get("/auth/me").set("Authorization", `Bearer ${token}`).expect(200);
    expect(after.body.onboardingCompletedAt).toBe(completed.body.onboardingCompletedAt);
  });

  describe("trusted-device login", () => {
    function latestLoginCode(): string {
      const message = [...integrationApp.mail.sent]
        .reverse()
        .find((entry) => entry.subject.includes("login code"));
      if (!message) {
        throw new Error("No login-code email was sent");
      }
      const match = /\d{6}/.exec(message.text);
      if (!match) {
        throw new Error(`No 6-digit code found in: ${message.text}`);
      }
      return match[0];
    }

    it("does not issue a device trust token when rememberDevice is omitted", async () => {
      const email = "no-remember@example.com";
      await http()
        .post("/auth/register")
        .send({ email, password: "a-very-long-password", displayName: "NoRemember" })
        .expect(201);
      await http().post("/auth/login-code/request").send({ email }).expect(204);
      const code = latestLoginCode();

      const verify = await http().post("/auth/login-code/verify").send({ email, code }).expect(200);

      expect(verify.body.deviceTrustToken).toBeUndefined();
    });

    it("remembering a device lets it skip the login-code step, and the token rotates on use", async () => {
      const email = "remember-me@example.com";
      await http()
        .post("/auth/register")
        .send({ email, password: "a-very-long-password", displayName: "RememberMe" })
        .expect(201);
      await http().post("/auth/login-code/request").send({ email }).expect(204);
      const code = latestLoginCode();

      const verify = await http()
        .post("/auth/login-code/verify")
        .send({ email, code, rememberDevice: true })
        .expect(200);
      const firstTrustToken = verify.body.deviceTrustToken as string;
      expect(firstTrustToken).toEqual(expect.any(String));

      // The trusted device signs back in with zero login-code round trip.
      const deviceLogin = await http()
        .post("/auth/device-login")
        .send({ deviceTrustToken: firstTrustToken })
        .expect(200);
      expect(deviceLogin.body.user.email).toBe(email);
      const rotatedTrustToken = deviceLogin.body.deviceTrustToken as string;
      expect(rotatedTrustToken).toEqual(expect.any(String));
      expect(rotatedTrustToken).not.toBe(firstTrustToken);

      // The old (rotated-out) token no longer works.
      await http()
        .post("/auth/device-login")
        .send({ deviceTrustToken: firstTrustToken })
        .expect(401);

      // A logged-out device can still use its trust token — it survives
      // logout, unlike the refresh token.
      await http()
        .post("/auth/logout")
        .send({ refreshToken: deviceLogin.body.refreshToken })
        .expect(204);
      await http()
        .post("/auth/device-login")
        .send({ deviceTrustToken: rotatedTrustToken })
        .expect(200);
    });

    it("rejects an unknown device trust token", async () => {
      await http()
        .post("/auth/device-login")
        .send({ deviceTrustToken: "not-a-real-token" })
        .expect(401);
    });
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
