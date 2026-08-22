import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { GoalContribution, SavingsGoal } from "@prisma/client";
import type {
  CreateGoalContributionInput,
  CreateGoalInput,
  UpdateGoalInput,
} from "@budget-terry/validation";
import { AccountsService } from "../accounts/accounts.service";
import { PrismaService } from "../prisma/prisma.service";
import { computeMonthsRemaining, computeSuggestedMonthlyContribution } from "./goal-progress";

type ContributionWithTransaction = GoalContribution & { transaction: { id: string } | null };
type GoalWithContributions = SavingsGoal & { contributions: ContributionWithTransaction[] };

export interface GoalContributionForClient {
  id: string;
  goalId: string;
  amountMinorUnits: number;
  currency: GoalContribution["currency"];
  contributionDate: Date;
  notes: string | null;
  relatedTransactionId: string | null;
}

export interface GoalWithProgress {
  id: string;
  name: string;
  targetAmountMinorUnits: number;
  currency: SavingsGoal["currency"];
  targetDate: Date | null;
  accountId: string | null;
  notes: string | null;
  status: SavingsGoal["status"];
  savedMinorUnits: number;
  remainingMinorUnits: number;
  percentageComplete: number;
  suggestedMonthlyContributionMinorUnits: number | null;
  contributions: GoalContributionForClient[];
}

export interface GoalContributionForCalendar {
  contributionId: string;
  goalId: string;
  goalName: string;
  contributionDate: Date;
  amountMinorUnits: number;
  currency: GoalContribution["currency"];
}

const GOAL_CONTRIBUTIONS_INCLUDE = {
  contributions: {
    orderBy: { contributionDate: "desc" as const },
    include: { transaction: { select: { id: true } } },
  },
} as const;

function percentageCompleteFor(saved: number, target: number): number {
  if (target <= 0) {
    return saved > 0 ? 100 : 0;
  }
  return Math.round((saved / target) * 1000) / 10;
}

@Injectable()
export class GoalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accountsService: AccountsService,
  ) {}

  async create(userId: string, input: CreateGoalInput): Promise<GoalWithProgress> {
    if (input.accountId) {
      await this.accountsService.findOneForUser(userId, input.accountId);
    }

    const goal = await this.prisma.savingsGoal.create({
      data: {
        userId,
        name: input.name,
        targetAmountMinorUnits: input.targetAmountMinorUnits,
        currency: input.currency,
        targetDate: input.targetDate ? new Date(input.targetDate) : undefined,
        accountId: input.accountId,
        notes: input.notes,
      },
      include: GOAL_CONTRIBUTIONS_INCLUDE,
    });

    return this.attachProgress(goal);
  }

  async findAllForUser(userId: string, includeArchived: boolean): Promise<GoalWithProgress[]> {
    const goals = await this.prisma.savingsGoal.findMany({
      where: { userId, ...(includeArchived ? {} : { status: { not: "ARCHIVED" } }) },
      orderBy: { createdAt: "desc" },
      include: GOAL_CONTRIBUTIONS_INCLUDE,
    });
    return goals.map((goal) => this.attachProgress(goal));
  }

  /**
   * Scopes by userId in the query itself, not fetch-then-check — another
   * user's goal is indistinguishable from a nonexistent one. See the
   * critical guarantee in docs/architecture/security.md.
   */
  async findOneForUser(userId: string, id: string): Promise<GoalWithProgress> {
    const goal = await this.findOwned(userId, id);
    return this.attachProgress(goal);
  }

  async update(userId: string, id: string, input: UpdateGoalInput): Promise<GoalWithProgress> {
    await this.findOwned(userId, id);
    if (input.accountId) {
      await this.accountsService.findOneForUser(userId, input.accountId);
    }

    const goal = await this.prisma.savingsGoal.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.targetAmountMinorUnits !== undefined && {
          targetAmountMinorUnits: input.targetAmountMinorUnits,
        }),
        ...(input.targetDate !== undefined && {
          targetDate: input.targetDate ? new Date(input.targetDate) : null,
        }),
        ...(input.accountId !== undefined && { accountId: input.accountId }),
        ...(input.notes !== undefined && { notes: input.notes }),
      },
      include: GOAL_CONTRIBUTIONS_INCLUDE,
    });

    return this.attachProgress(goal);
  }

  async complete(userId: string, id: string): Promise<GoalWithProgress> {
    return this.setStatus(userId, id, "COMPLETED");
  }

  async archive(userId: string, id: string): Promise<GoalWithProgress> {
    return this.setStatus(userId, id, "ARCHIVED");
  }

  async restore(userId: string, id: string): Promise<GoalWithProgress> {
    return this.setStatus(userId, id, "ACTIVE");
  }

  /**
   * Atomically creates the GoalContribution row and its linked Transaction
   * (ADR-005) — the contribution is created first so the Transaction can
   * reference its id, the reverse order from bill payments (where the
   * BillOccurrence already exists before it's marked paid).
   */
  async addContribution(
    userId: string,
    goalId: string,
    input: CreateGoalContributionInput,
  ): Promise<GoalWithProgress> {
    const goal = await this.findOwned(userId, goalId);

    const accountId = input.accountId ?? goal.accountId;
    if (!accountId) {
      throw new BadRequestException(
        "This goal has no default account — an accountId must be provided to contribute to it.",
      );
    }
    await this.accountsService.findOneForUser(userId, accountId);

    const contributionDate = input.contributionDate
      ? new Date(input.contributionDate)
      : new Date(new Date().toISOString().slice(0, 10));

    await this.prisma.$transaction(async (tx) => {
      const contribution = await tx.goalContribution.create({
        data: {
          goalId,
          userId,
          amountMinorUnits: input.amountMinorUnits,
          currency: goal.currency,
          contributionDate,
          notes: input.notes,
        },
      });
      await tx.transaction.create({
        data: {
          userId,
          accountId,
          categoryId: null,
          type: "EXPENSE",
          amountMinorUnits: input.amountMinorUnits,
          currency: goal.currency,
          transactionDate: contributionDate,
          merchant: goal.name,
          relatedGoalContributionId: contribution.id,
        },
      });
    });

    return this.findOneForUser(userId, goalId);
  }

  /**
   * Contributions dated within [from, to], with their goal's name — used
   * by the calendar (Phase 9/10) to satisfy plan Section 6's "Optional
   * savings contributions" entry type.
   */
  async findContributionsInRange(
    userId: string,
    from: Date,
    to: Date,
  ): Promise<GoalContributionForCalendar[]> {
    const contributions = await this.prisma.goalContribution.findMany({
      where: { userId, contributionDate: { gte: from, lte: to } },
      include: { goal: { select: { name: true } } },
      orderBy: { contributionDate: "asc" },
    });

    return contributions.map((contribution) => ({
      contributionId: contribution.id,
      goalId: contribution.goalId,
      goalName: contribution.goal.name,
      contributionDate: contribution.contributionDate,
      amountMinorUnits: contribution.amountMinorUnits,
      currency: contribution.currency,
    }));
  }

  private async setStatus(
    userId: string,
    id: string,
    status: SavingsGoal["status"],
  ): Promise<GoalWithProgress> {
    await this.findOwned(userId, id);
    const goal = await this.prisma.savingsGoal.update({
      where: { id },
      data: { status },
      include: GOAL_CONTRIBUTIONS_INCLUDE,
    });
    return this.attachProgress(goal);
  }

  private async findOwned(userId: string, id: string): Promise<GoalWithContributions> {
    const goal = await this.prisma.savingsGoal.findFirst({
      where: { id, userId },
      include: GOAL_CONTRIBUTIONS_INCLUDE,
    });
    if (!goal) {
      throw new NotFoundException("Savings goal was not found.");
    }
    return goal;
  }

  /**
   * Saved/remaining/percentage/suggested-contribution are always
   * computed on read from live GoalContribution data, never stored —
   * same principle as Budget's spent/remaining/status and Bill's display
   * status elsewhere in this codebase (see the comment on
   * SavingsGoal.currentAmountMinorUnits's deliberate absence from the
   * schema, plan Section 55).
   */
  private attachProgress(goal: GoalWithContributions): GoalWithProgress {
    const savedMinorUnits = goal.contributions.reduce(
      (sum, contribution) => sum + contribution.amountMinorUnits,
      0,
    );
    const remainingMinorUnits = Math.max(0, goal.targetAmountMinorUnits - savedMinorUnits);
    const today = new Date();
    const suggestedMonthlyContributionMinorUnits = goal.targetDate
      ? computeSuggestedMonthlyContribution(
          remainingMinorUnits,
          computeMonthsRemaining(today, goal.targetDate),
        )
      : null;

    return {
      id: goal.id,
      name: goal.name,
      targetAmountMinorUnits: goal.targetAmountMinorUnits,
      currency: goal.currency,
      targetDate: goal.targetDate,
      accountId: goal.accountId,
      notes: goal.notes,
      status: goal.status,
      savedMinorUnits,
      remainingMinorUnits,
      percentageComplete: percentageCompleteFor(savedMinorUnits, goal.targetAmountMinorUnits),
      suggestedMonthlyContributionMinorUnits,
      contributions: goal.contributions.map((contribution) => ({
        id: contribution.id,
        goalId: contribution.goalId,
        amountMinorUnits: contribution.amountMinorUnits,
        currency: contribution.currency,
        contributionDate: contribution.contributionDate,
        notes: contribution.notes,
        relatedTransactionId: contribution.transaction?.id ?? null,
      })),
    };
  }
}
