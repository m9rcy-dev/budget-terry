import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import type { Transaction } from "@prisma/client";
import {
  categoryTotalsQuerySchema,
  createTransactionSchema,
  listTransactionsQuerySchema,
  updateTransactionSchema,
  type CategoryTotalsQuery,
  type CreateTransactionInput,
  type ListTransactionsQuery,
  type UpdateTransactionInput,
} from "@budget-terry/validation";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AccessTokenPayload } from "../auth/token.service";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import {
  TransactionsService,
  type CategoryTotal,
  type PaginatedTransactions,
} from "./transactions.service";

@Controller("transactions")
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post()
  create(
    @CurrentUser() user: AccessTokenPayload,
    @Body(new ZodValidationPipe(createTransactionSchema)) body: CreateTransactionInput,
    @Headers("idempotency-key") idempotencyKey?: string,
  ): Promise<Transaction> {
    return this.transactionsService.create(user.sub, body, idempotencyKey);
  }

  @Get()
  list(
    @CurrentUser() user: AccessTokenPayload,
    @Query(new ZodValidationPipe(listTransactionsQuerySchema)) query: ListTransactionsQuery,
  ): Promise<PaginatedTransactions> {
    return this.transactionsService.findAllForUser(user.sub, query);
  }

  // Must be registered before ":id" — otherwise "category-totals" would
  // be matched (and rejected by ParseUUIDPipe) as an :id.
  @Get("category-totals")
  categoryTotals(
    @CurrentUser() user: AccessTokenPayload,
    @Query(new ZodValidationPipe(categoryTotalsQuerySchema)) query: CategoryTotalsQuery,
  ): Promise<CategoryTotal[]> {
    return this.transactionsService.getCategoryTotals(user.sub, query.from, query.to);
  }

  @Get(":id")
  findOne(
    @CurrentUser() user: AccessTokenPayload,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<Transaction> {
    return this.transactionsService.findOneForUser(user.sub, id);
  }

  @Patch(":id")
  update(
    @CurrentUser() user: AccessTokenPayload,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateTransactionSchema)) body: UpdateTransactionInput,
  ): Promise<Transaction> {
    return this.transactionsService.update(user.sub, id, body);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() user: AccessTokenPayload,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.transactionsService.remove(user.sub, id);
  }
}
