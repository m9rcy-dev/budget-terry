import { execSync } from "node:child_process";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { PrismaClient } from "@prisma/client";

export interface IntegrationDb {
  prisma: PrismaClient;
  stop: () => Promise<void>;
}

/**
 * Starts a throwaway Postgres container, applies every migration against
 * it, and returns a connected PrismaClient. Each test file gets its own
 * container so tests never see another suite's data — see plan Section 31
 * (use a real PostgreSQL instance for integration tests, not mocks).
 */
export async function startIntegrationDb(): Promise<IntegrationDb> {
  const container: StartedPostgreSqlContainer = await new PostgreSqlContainer(
    "postgres:16-alpine",
  ).start();
  const databaseUrl = container.getConnectionUri();

  execSync("npx prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: "inherit",
  });

  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

  return {
    prisma,
    stop: async () => {
      await prisma.$disconnect();
      await container.stop();
    },
  };
}
