import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from "@nestjs/common";
import {
  createBudgetSchema,
  updateBudgetSchema,
  type CreateBudgetInput,
  type UpdateBudgetInput,
} from "@budget-terry/validation";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AccessTokenPayload } from "../auth/token.service";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { BudgetsService, type BudgetWithStatus } from "./budgets.service";

@Controller("budgets")
export class BudgetsController {
  constructor(private readonly budgetsService: BudgetsService) {}

  @Get()
  list(@CurrentUser() user: AccessTokenPayload): Promise<BudgetWithStatus[]> {
    return this.budgetsService.findAllForUser(user.sub);
  }

  @Get(":id")
  findOne(
    @CurrentUser() user: AccessTokenPayload,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<BudgetWithStatus> {
    return this.budgetsService.findOneForUser(user.sub, id);
  }

  @Post()
  create(
    @CurrentUser() user: AccessTokenPayload,
    @Body(new ZodValidationPipe(createBudgetSchema)) body: CreateBudgetInput,
  ): Promise<BudgetWithStatus> {
    return this.budgetsService.create(user.sub, body);
  }

  @Patch(":id")
  update(
    @CurrentUser() user: AccessTokenPayload,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateBudgetSchema)) body: UpdateBudgetInput,
  ): Promise<BudgetWithStatus> {
    return this.budgetsService.update(user.sub, id, body);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() user: AccessTokenPayload,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.budgetsService.remove(user.sub, id);
  }
}
