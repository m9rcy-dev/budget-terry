import { Controller, Get, Query } from "@nestjs/common";
import { dashboardSummaryQuerySchema, type DashboardSummaryQuery } from "@budget-terry/validation";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AccessTokenPayload } from "../auth/token.service";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { DashboardService, type DashboardSummary } from "./dashboard.service";

@Controller("dashboard")
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get("summary")
  summary(
    @CurrentUser() user: AccessTokenPayload,
    @Query(new ZodValidationPipe(dashboardSummaryQuerySchema)) query: DashboardSummaryQuery,
  ): Promise<DashboardSummary> {
    return this.dashboardService.getSummary(user.sub, query.from, query.to);
  }
}
