import request from "supertest";
import { startIntegrationApp, type IntegrationApp } from "./integration-app";

/**
 * Verifies configureApp() (src/configure-app.ts) actually applies helmet
 * and CORS to a real request/response cycle — plan Section 39's "security
 * headers" item. See that file's own comment for why this matters: without
 * it, this middleware was only ever exercised by main.ts, invisible to
 * every integration test (the same blind spot that let the CORS-never-
 * enabled bug through 10 phases — PROJECT_STATUS.md, Post-Phase-10).
 */
describe("security headers", () => {
  let integrationApp: IntegrationApp;

  beforeAll(async () => {
    integrationApp = await startIntegrationApp();
  });

  afterAll(async () => {
    await integrationApp.stop();
  });

  it("applies helmet's security headers to every response", async () => {
    const response = await request(integrationApp.app.getHttpServer()).get("/health").expect(200);

    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["x-frame-options"]).toBe("SAMEORIGIN");
    expect(response.headers["cross-origin-resource-policy"]).toBe("cross-origin");
  });

  it("sends CORS headers for the configured web origin", async () => {
    const response = await request(integrationApp.app.getHttpServer())
      .get("/health")
      .set("Origin", "http://localhost:3000")
      .expect(200);

    expect(response.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
  });

  it("assigns a correlation id and echoes back a client-supplied one", async () => {
    const generated = await request(integrationApp.app.getHttpServer()).get("/health").expect(200);
    expect(generated.headers["x-correlation-id"]).toEqual(expect.any(String));

    const echoed = await request(integrationApp.app.getHttpServer())
      .get("/health")
      .set("X-Correlation-Id", "test-correlation-id")
      .expect(200);
    expect(echoed.headers["x-correlation-id"]).toBe("test-correlation-id");
  });
});
