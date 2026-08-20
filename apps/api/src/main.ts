import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  // Web and API are on different origins by design (ADR-009). Without this,
  // the browser blocks every request from apps/web before it reaches the
  // server — curl and the integration tests never hit this because neither
  // enforces CORS, which is why the gap went unnoticed until now.
  app.enableCors({ origin: process.env.WEB_ORIGIN ?? "http://localhost:3000" });
  const port = process.env.API_PORT ? Number(process.env.API_PORT) : 3001;
  await app.listen(port);
}

void bootstrap();
