import { Controller, Get, Query } from "@nestjs/common";
import { analyticsQuerySchema, type AnalyticsQuery } from "@budget-terry/validation";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AccessTokenPayload } from "../auth/token.service";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { AnalyticsService, type AnalyticsSummaryResult } from "./analytics.service";

@Controller("analytics")
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get("summary")
  summary(
    @CurrentUser() user: AccessTokenPayload,
    @Query(new ZodValidationPipe(analyticsQuerySchema)) query: AnalyticsQuery,
  ): Promise<AnalyticsSummaryResult> {
    return this.analyticsService.getSummary(user.sub, query);
  }
}
