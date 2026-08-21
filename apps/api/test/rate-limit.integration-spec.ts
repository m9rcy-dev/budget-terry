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
});
