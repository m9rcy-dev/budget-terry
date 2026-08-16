import { Injectable } from "@nestjs/common";
import type { Category } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  findAllForUser(userId: string): Promise<Category[]> {
    return this.prisma.category.findMany({
      where: { userId, isArchived: false },
      orderBy: { name: "asc" },
    });
  }
}
