import request from "supertest";
import { startIntegrationApp, type IntegrationApp } from "./integration-app";

/**
 * Its own file/app instance (plan Section 39 — rate limiting for sensitive
 * endpoints) deliberately, not folded into auth.integration-spec.ts: the
 * throttle counter is per-route-per-IP for the lifetime of one Nest app
 * instance, so a rapid-fire burst test here would otherwise eat into the
 * same 20/min budget that file's other tests rely on.
 */
describe("rate limiting", () => {
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

  it("throttles repeated /auth/login attempts from the same client", async () => {
    const credentials = { email: "nobody@example.com", password: "irrelevant-password" };

    // The endpoint's limit is 20/min (auth.controller.ts) — the first 20
    // requests are each individually rejected as bad credentials (401,
    // proving the guard let them through), the 21st is throttled (429).
    for (let attempt = 0; attempt < 20; attempt += 1) {
      await http().post("/auth/login").send(credentials).expect(401);
    }

    await http().post("/auth/login").send(credentials).expect(429);
  });

  it("throttles repeated /auth/login-code/request attempts from the same client", async () => {
    // 10/min (auth.controller.ts) — always 204 regardless of whether the
    // email exists, so no user needs to be registered for this.
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await http()
        .post("/auth/login-code/request")
        .send({ email: "nobody@example.com" })
        .expect(204);
    }

    await http().post("/auth/login-code/request").send({ email: "nobody@example.com" }).expect(429);
  });

  it("throttles repeated /auth/login-code/verify attempts from the same client", async () => {
    // 20/min (auth.controller.ts) — always 401 against an unknown email,
    // so this exercises the IP-level cap independently of the per-code
    // attempt lockout (which is scoped to a real user's real code).
    const attempt = { email: "nobody@example.com", code: "000000" };

    for (let i = 0; i < 20; i += 1) {
      await http().post("/auth/login-code/verify").send(attempt).expect(401);
    }

    await http().post("/auth/login-code/verify").send(attempt).expect(429);
  });
});
