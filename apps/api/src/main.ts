import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { configureApp } from "./configure-app";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  // PORT is injected by Render (and most PaaS hosts) in production; API_PORT
  // is this project's own local-dev config (see env.ts). Prefer PORT when set
  // so the deployed service binds where the platform expects, without
  // touching the Zod-validated Env schema that local dev/tests rely on.
  const port = process.env.PORT
    ? Number(process.env.PORT)
    : process.env.API_PORT
      ? Number(process.env.API_PORT)
      : 3001;
  await app.listen(port);
}

void bootstrap();
