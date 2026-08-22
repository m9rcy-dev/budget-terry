import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { Account } from "@prisma/client";
import type { CreateAccountInput, UpdateAccountInput } from "@budget-terry/validation";
import { isForeignKeyViolation } from "../common/prisma-errors";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AccountsService {
  constructor(private readonly prisma: PrismaService) {}

  create(userId: string, input: CreateAccountInput): Promise<Account> {
    return this.prisma.account.create({
      data: { userId, name: input.name, type: input.type, currency: input.currency },
    });
  }

  findAllForUser(userId: string, includeArchived: boolean): Promise<Account[]> {
    return this.prisma.account.findMany({
      where: { userId, ...(includeArchived ? {} : { isArchived: false }) },
      orderBy: { name: "asc" },
    });
  }

  /**
   * Scopes by userId in the query itself, not fetch-then-check — another
   * user's account is indistinguishable from a nonexistent one. See the
   * critical guarantee in docs/architecture/security.md.
   */
  async findOneForUser(userId: string, id: string): Promise<Account> {
    const account = await this.prisma.account.findFirst({ where: { id, userId } });
    if (!account) {
      throw new NotFoundException("Account was not found.");
    }
    return account;
  }

  async update(userId: string, id: string, input: UpdateAccountInput): Promise<Account> {
    await this.findOneForUser(userId, id);
    return this.prisma.account.update({ where: { id }, data: input });
  }

  async archive(userId: string, id: string): Promise<Account> {
    await this.findOneForUser(userId, id);
    return this.prisma.account.update({ where: { id }, data: { isArchived: true } });
  }

  async restore(userId: string, id: string): Promise<Account> {
    await this.findOneForUser(userId, id);
    return this.prisma.account.update({ where: { id }, data: { isArchived: false } });
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.findOneForUser(userId, id);

    try {
      await this.prisma.account.delete({ where: { id } });
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        throw new ConflictException(
          "This account has transaction history and can't be deleted — archive it instead.",
        );
      }
      throw error;
    }
  }
}
