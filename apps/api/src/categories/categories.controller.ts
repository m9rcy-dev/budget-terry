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
import type { Category } from "@prisma/client";
import {
  createCategorySchema,
  updateCategorySchema,
  type CreateCategoryInput,
  type UpdateCategoryInput,
} from "@budget-terry/validation";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AccessTokenPayload } from "../auth/token.service";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { CategoriesService } from "./categories.service";

@Controller("categories")
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  list(
    @CurrentUser() user: AccessTokenPayload,
    @Query("includeArchived") includeArchived?: string,
  ): Promise<Category[]> {
    return this.categoriesService.findAllForUser(user.sub, includeArchived === "true");
  }

  @Get(":id")
  findOne(
    @CurrentUser() user: AccessTokenPayload,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<Category> {
    return this.categoriesService.findOneForUser(user.sub, id);
  }

  @Post()
  create(
    @CurrentUser() user: AccessTokenPayload,
    @Body(new ZodValidationPipe(createCategorySchema)) body: CreateCategoryInput,
  ): Promise<Category> {
    return this.categoriesService.create(user.sub, body);
  }

  @Patch(":id")
  update(
    @CurrentUser() user: AccessTokenPayload,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateCategorySchema)) body: UpdateCategoryInput,
  ): Promise<Category> {
    return this.categoriesService.update(user.sub, id, body);
  }

  @Post(":id/archive")
  archive(
    @CurrentUser() user: AccessTokenPayload,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<Category> {
    return this.categoriesService.archive(user.sub, id);
  }

  @Post(":id/restore")
  restore(
    @CurrentUser() user: AccessTokenPayload,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<Category> {
    return this.categoriesService.restore(user.sub, id);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() user: AccessTokenPayload,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.categoriesService.remove(user.sub, id);
  }
}
