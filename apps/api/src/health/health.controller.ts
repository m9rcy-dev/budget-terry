import { Controller, Get } from "@nestjs/common";
import { Public } from "../auth/public.decorator";
import { PrismaService } from "../prisma/prisma.service";

export interface HealthStatus {
  status: "ok";
}

@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  // Pings the database, not just the process — a pure liveness check would
  // report "ok" even with a broken DATABASE_URL, which Render's health check
  // uses for both deploy-readiness gating and ongoing restart decisions.
  @Public()
  @Get()
  async check(): Promise<HealthStatus> {
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: "ok" };
  }
}
