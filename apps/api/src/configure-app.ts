import type { INestApplication } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import helmet from "helmet";
import { createRequestLoggerMiddleware } from "./common/request-logger.middleware";
import type { Env } from "./config/env";

/**
 * Cross-cutting HTTP middleware (structured request logging, CORS,
 * security headers) shared between the real bootstrap (main.ts) and the
 * integration test harness (test/integration-app.ts). Previously CORS only
 * lived in main.ts, which meant integration tests never exercised it —
 * exactly the blind spot that let the CORS-never-enabled bug (see
 * PROJECT_STATUS.md, Post-Phase-10) through 10 phases of "verified with
 * curl" testing. Keeping it in one place means a regression here now fails
 * a `pnpm test:integration` run, not just a real browser.
 */
export function configureApp(app: INestApplication): void {
  const configService = app.get(ConfigService<Env, true>);
  app.use(createRequestLoggerMiddleware(configService.get("LOG_LEVEL", { infer: true })));
  app.use(
    helmet({
      // This is a pure JSON API with no HTML views/Swagger UI to protect —
      // a default CSP (meant to restrict script/style/frame sources on
      // rendered pages) has nothing to apply to here and only risks
      // interfering with future additions. Every other helmet default
      // (X-Content-Type-Options, X-Frame-Options, HSTS, Referrer-Policy,
      // etc.) still applies. See plan Section 39: "security headers".
      contentSecurityPolicy: false,
      // Cross-origin by design (ADR-009: web on :3000, API on :3001) — the
      // default same-origin resource policy would fight the CORS config
      // directly below rather than complement it.
      crossOriginResourcePolicy: { policy: "cross-origin" },
    }),
  );
  // Web and API are on different origins by design (ADR-009). Without this,
  // the browser blocks every request from apps/web before it reaches the
  // server — curl and integration tests never enforced CORS themselves,
  // which is why the original gap went unnoticed until a real browser hit
  // it (see PROJECT_STATUS.md, Post-Phase-10).
  app.enableCors({ origin: process.env.WEB_ORIGIN ?? "http://localhost:3000" });
}
