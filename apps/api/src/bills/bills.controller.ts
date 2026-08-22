import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from "@nestjs/common";
import {
  createBillSchema,
  markBillOccurrencePaidSchema,
  updateBillSchema,
  type CreateBillInput,
  type MarkBillOccurrencePaidInput,
  type UpdateBillInput,
} from "@budget-terry/validation";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AccessTokenPayload } from "../auth/token.service";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { BillsService, type BillWithStatus } from "./bills.service";

@Controller("bills")
export class BillsController {
  constructor(private readonly billsService: BillsService) {}

  @Get()
  list(
    @CurrentUser() user: AccessTokenPayload,
    @Query("includeArchived") includeArchived?: string,
  ): Promise<BillWithStatus[]> {
    return this.billsService.findAllForUser(user.sub, includeArchived === "true");
  }

  @Get(":id")
  findOne(
    @CurrentUser() user: AccessTokenPayload,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<BillWithStatus> {
    return this.billsService.findOneForUser(user.sub, id);
  }

  @Post()
  create(
    @CurrentUser() user: AccessTokenPayload,
    @Body(new ZodValidationPipe(createBillSchema)) body: CreateBillInput,
  ): Promise<BillWithStatus> {
    return this.billsService.create(user.sub, body);
  }

  @Patch(":id")
  update(
    @CurrentUser() user: AccessTokenPayload,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateBillSchema)) body: UpdateBillInput,
  ): Promise<BillWithStatus> {
    return this.billsService.update(user.sub, id, body);
  }

  @Post(":id/archive")
  archive(
    @CurrentUser() user: AccessTokenPayload,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<BillWithStatus> {
    return this.billsService.archive(user.sub, id);
  }

  @Post(":id/restore")
  restore(
    @CurrentUser() user: AccessTokenPayload,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<BillWithStatus> {
    return this.billsService.restore(user.sub, id);
  }

  @Post(":id/occurrences/:occurrenceId/pay")
  payOccurrence(
    @CurrentUser() user: AccessTokenPayload,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("occurrenceId", ParseUUIDPipe) occurrenceId: string,
    @Body(new ZodValidationPipe(markBillOccurrencePaidSchema)) body: MarkBillOccurrencePaidInput,
  ): Promise<BillWithStatus> {
    return this.billsService.markOccurrencePaid(user.sub, id, occurrenceId, body);
  }

  @Post(":id/occurrences/:occurrenceId/skip")
  skipOccurrence(
    @CurrentUser() user: AccessTokenPayload,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("occurrenceId", ParseUUIDPipe) occurrenceId: string,
  ): Promise<BillWithStatus> {
    return this.billsService.markOccurrenceSkipped(user.sub, id, occurrenceId);
  }
}
