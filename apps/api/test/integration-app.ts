import { execSync } from "node:child_process";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

export interface IntegrationApp {
  app: INestApplication;
  prisma: PrismaService;
  stop: () => Promise<void>;
}

/**
 * Boots the full Nest application (guards, pipes, every module) against a
 * throwaway Postgres container, so HTTP-level auth tests exercise exactly
 * what a real request would go through — not just the service layer.
 */
export async function startIntegrationApp(): Promise<IntegrationApp> {
  const container: StartedPostgreSqlContainer = await new PostgreSqlContainer(
    "postgres:16-alpine",
  ).start();
  const databaseUrl = container.getConnectionUri();
  process.env.DATABASE_URL = databaseUrl;

  execSync("npx prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: "inherit",
  });

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  await app.init();

  const prisma = app.get(PrismaService);

  return {
    app,
    prisma,
    stop: async () => {
      await app.close();
      await container.stop();
    },
  };
}
