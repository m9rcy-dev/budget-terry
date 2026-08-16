import { Controller, Get } from "@nestjs/common";
import type { Category } from "@prisma/client";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AccessTokenPayload } from "../auth/token.service";
import { CategoriesService } from "./categories.service";

@Controller("categories")
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  list(@CurrentUser() user: AccessTokenPayload): Promise<Category[]> {
    return this.categoriesService.findAllForUser(user.sub);
  }
}
