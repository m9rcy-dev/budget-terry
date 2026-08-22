import request from "supertest";
import { startIntegrationApp, type IntegrationApp } from "./integration-app";

describe("login-code flow", () => {
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

  async function registerUser(email: string): Promise<void> {
    await http()
      .post("/auth/register")
      .send({ email, password: "a-very-long-password", displayName: "Code User" })
      .expect(201);
  }

  it("requests a code, verifies it, and receives real tokens", async () => {
    await registerUser("alice@example.com");

    await http().post("/auth/login-code/request").send({ email: "alice@example.com" }).expect(204);
    const code = integrationApp.mail.latestCode();

    const response = await http()
      .post("/auth/login-code/verify")
      .send({ email: "alice@example.com", code })
      .expect(200);

    expect(response.body.user.email).toBe("alice@example.com");
    expect(response.body.accessToken).toBeDefined();
    expect(response.body.refreshToken).toBeDefined();
  });

  it("does nothing and sends no email for an unknown address", async () => {
    const before = integrationApp.mail.sent.length;

    await http().post("/auth/login-code/request").send({ email: "nobody@example.com" }).expect(204);

    expect(integrationApp.mail.sent.length).toBe(before);
  });

  it("rejects a wrong code with a generic message", async () => {
    await registerUser("bob@example.com");
    await http().post("/auth/login-code/request").send({ email: "bob@example.com" }).expect(204);

    await http()
      .post("/auth/login-code/verify")
      .send({ email: "bob@example.com", code: "000000" })
      .expect(401);
  });

  it("CRITICAL: a user's login code cannot authenticate a different user's email", async () => {
    await registerUser("carol@example.com");
    await registerUser("dave@example.com");

    await http().post("/auth/login-code/request").send({ email: "carol@example.com" }).expect(204);
    const carolsCode = integrationApp.mail.latestCode();

    await http()
      .post("/auth/login-code/verify")
      .send({ email: "dave@example.com", code: carolsCode })
      .expect(401);
  });

  it("locks the code out after 5 wrong attempts — even the correct code stops working", async () => {
    await registerUser("erin@example.com");
    await http().post("/auth/login-code/request").send({ email: "erin@example.com" }).expect(204);
    const code = integrationApp.mail.latestCode();

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await http()
        .post("/auth/login-code/verify")
        .send({ email: "erin@example.com", code: "000000" })
        .expect(401);
    }

    await http()
      .post("/auth/login-code/verify")
      .send({ email: "erin@example.com", code })
      .expect(401);
  });

  it("invalidates a previous code once a new one is requested", async () => {
    await registerUser("frank@example.com");

    await http().post("/auth/login-code/request").send({ email: "frank@example.com" }).expect(204);
    const firstCode = integrationApp.mail.latestCode();

    await http().post("/auth/login-code/request").send({ email: "frank@example.com" }).expect(204);
    const secondCode = integrationApp.mail.latestCode();

    expect(secondCode).not.toBe(firstCode);

    await http()
      .post("/auth/login-code/verify")
      .send({ email: "frank@example.com", code: firstCode })
      .expect(401);

    await http()
      .post("/auth/login-code/verify")
      .send({ email: "frank@example.com", code: secondCode })
      .expect(200);
  });

  it("a code can only be used once", async () => {
    await registerUser("grace@example.com");
    await http().post("/auth/login-code/request").send({ email: "grace@example.com" }).expect(204);
    const code = integrationApp.mail.latestCode();

    await http()
      .post("/auth/login-code/verify")
      .send({ email: "grace@example.com", code })
      .expect(200);

    await http()
      .post("/auth/login-code/verify")
      .send({ email: "grace@example.com", code })
      .expect(401);
  });
});
