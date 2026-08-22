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
  Query,
} from "@nestjs/common";
import type { Account } from "@prisma/client";
import {
  createAccountSchema,
  updateAccountSchema,
  type CreateAccountInput,
  type UpdateAccountInput,
} from "@budget-terry/validation";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AccessTokenPayload } from "../auth/token.service";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { AccountsService } from "./accounts.service";

@Controller("accounts")
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Get()
  list(
    @CurrentUser() user: AccessTokenPayload,
    @Query("includeArchived") includeArchived?: string,
  ): Promise<Account[]> {
    return this.accountsService.findAllForUser(user.sub, includeArchived === "true");
  }

  @Get(":id")
  findOne(
    @CurrentUser() user: AccessTokenPayload,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<Account> {
    return this.accountsService.findOneForUser(user.sub, id);
  }

  @Post()
  create(
    @CurrentUser() user: AccessTokenPayload,
    @Body(new ZodValidationPipe(createAccountSchema)) body: CreateAccountInput,
  ): Promise<Account> {
    return this.accountsService.create(user.sub, body);
  }

  @Patch(":id")
  update(
    @CurrentUser() user: AccessTokenPayload,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateAccountSchema)) body: UpdateAccountInput,
  ): Promise<Account> {
    return this.accountsService.update(user.sub, id, body);
  }

  @Post(":id/archive")
  archive(
    @CurrentUser() user: AccessTokenPayload,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<Account> {
    return this.accountsService.archive(user.sub, id);
  }

  @Post(":id/restore")
  restore(
    @CurrentUser() user: AccessTokenPayload,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<Account> {
    return this.accountsService.restore(user.sub, id);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() user: AccessTokenPayload,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.accountsService.remove(user.sub, id);
  }
}
