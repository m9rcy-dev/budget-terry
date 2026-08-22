import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from "@nestjs/common";
import {
  createGoalContributionSchema,
  createGoalSchema,
  updateGoalSchema,
  type CreateGoalContributionInput,
  type CreateGoalInput,
  type UpdateGoalInput,
} from "@budget-terry/validation";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AccessTokenPayload } from "../auth/token.service";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { GoalsService, type GoalWithProgress } from "./goals.service";

@Controller("goals")
export class GoalsController {
  constructor(private readonly goalsService: GoalsService) {}

  @Get()
  list(
    @CurrentUser() user: AccessTokenPayload,
    @Query("includeArchived") includeArchived?: string,
  ): Promise<GoalWithProgress[]> {
    return this.goalsService.findAllForUser(user.sub, includeArchived === "true");
  }

  @Get(":id")
  findOne(
    @CurrentUser() user: AccessTokenPayload,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<GoalWithProgress> {
    return this.goalsService.findOneForUser(user.sub, id);
  }

  @Post()
  create(
    @CurrentUser() user: AccessTokenPayload,
    @Body(new ZodValidationPipe(createGoalSchema)) body: CreateGoalInput,
  ): Promise<GoalWithProgress> {
    return this.goalsService.create(user.sub, body);
  }

  @Patch(":id")
  update(
    @CurrentUser() user: AccessTokenPayload,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateGoalSchema)) body: UpdateGoalInput,
  ): Promise<GoalWithProgress> {
    return this.goalsService.update(user.sub, id, body);
  }

  @Post(":id/complete")
  complete(
    @CurrentUser() user: AccessTokenPayload,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<GoalWithProgress> {
    return this.goalsService.complete(user.sub, id);
  }

  @Post(":id/archive")
  archive(
    @CurrentUser() user: AccessTokenPayload,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<GoalWithProgress> {
    return this.goalsService.archive(user.sub, id);
  }

  @Post(":id/restore")
  restore(
    @CurrentUser() user: AccessTokenPayload,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<GoalWithProgress> {
    return this.goalsService.restore(user.sub, id);
  }

  @Post(":id/contributions")
  addContribution(
    @CurrentUser() user: AccessTokenPayload,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(createGoalContributionSchema)) body: CreateGoalContributionInput,
  ): Promise<GoalWithProgress> {
    return this.goalsService.addContribution(user.sub, id, body);
  }
}
