import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Bill, BillOccurrence } from "@prisma/client";
import type { BillDisplayStatus } from "@budget-terry/types";
import type {
  CreateBillInput,
  MarkBillOccurrencePaidInput,
  UpdateBillInput,
} from "@budget-terry/validation";
import { AccountsService } from "../accounts/accounts.service";
import { CategoriesService } from "../categories/categories.service";
import { addUtcDays } from "../common/date-utils";
import { PrismaService } from "../prisma/prisma.service";
import {
  computeDisplayStatus,
  generateOccurrenceDates,
  nextDueDate,
  OCCURRENCE_HORIZON_DAYS,
  type BillRecurrenceType,
} from "./bill-recurrence";

type OccurrenceWithTransaction = BillOccurrence & { transaction: { id: string } | null };
type BillWithOccurrences = Bill & { occurrences: OccurrenceWithTransaction[] };

export interface BillOccurrenceWithStatus {
  id: string;
  billId: string;
  dueDate: Date;
  amountMinorUnits: number;
  currency: BillOccurrence["currency"];
  paymentStatus: BillOccurrence["paymentStatus"];
  displayStatus: BillDisplayStatus;
  paidAt: Date | null;
  relatedTransactionId: string | null;
}

export interface BillWithStatus {
  id: string;
  name: string;
  amountMinorUnits: number;
  currency: Bill["currency"];
  categoryId: string | null;
  accountId: string | null;
  recurrence: Bill["recurrence"];
  autoPay: boolean;
  notes: string | null;
  isArchived: boolean;
  occurrences: BillOccurrenceWithStatus[];
}

const BILL_OCCURRENCES_INCLUDE = {
  occurrences: {
    orderBy: { dueDate: "asc" as const },
    include: { transaction: { select: { id: true } } },
  },
} as const;

@Injectable()
export class BillsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accountsService: AccountsService,
    private readonly categoriesService: CategoriesService,
  ) {}

  async create(userId: string, input: CreateBillInput): Promise<BillWithStatus> {
    if (input.categoryId) {
      await this.categoriesService.findOneForUser(userId, input.categoryId);
    }
    if (input.accountId) {
      await this.accountsService.findOneForUser(userId, input.accountId);
    }

    const firstDueDate = new Date(input.firstDueDate);
    const horizonEnd = addUtcDays(new Date(), OCCURRENCE_HORIZON_DAYS);
    const occurrenceDates = generateOccurrenceDates(input.recurrence, firstDueDate, horizonEnd);

    const bill = await this.prisma.bill.create({
      data: {
        userId,
        name: input.name,
        amountMinorUnits: input.amountMinorUnits,
        currency: input.currency,
        categoryId: input.categoryId,
        accountId: input.accountId,
        recurrence: input.recurrence,
        autoPay: input.autoPay,
        notes: input.notes,
        occurrences: {
          create: occurrenceDates.map((dueDate) => ({
            userId,
            dueDate,
            amountMinorUnits: input.amountMinorUnits,
            currency: input.currency,
          })),
        },
      },
      include: BILL_OCCURRENCES_INCLUDE,
    });

    return this.attachDisplayStatus(bill);
  }

  async findAllForUser(userId: string, includeArchived: boolean): Promise<BillWithStatus[]> {
    const where = { userId, ...(includeArchived ? {} : { isArchived: false }) };
    const bills = await this.prisma.bill.findMany({
      where,
      orderBy: { name: "asc" },
      include: BILL_OCCURRENCES_INCLUDE,
    });

    const generated = await Promise.all(bills.map((bill) => this.ensureOccurrencesGenerated(bill)));
    const finalBills = generated.some(Boolean)
      ? await this.prisma.bill.findMany({
          where,
          orderBy: { name: "asc" },
          include: BILL_OCCURRENCES_INCLUDE,
        })
      : bills;

    return finalBills.map((bill) => this.attachDisplayStatus(bill));
  }

  async findOneForUser(userId: string, id: string): Promise<BillWithStatus> {
    let bill = await this.findOwned(userId, id);
    if (await this.ensureOccurrencesGenerated(bill)) {
      bill = await this.findOwned(userId, id);
    }
    return this.attachDisplayStatus(bill);
  }

  /**
   * `amountMinorUnits` changes propagate to not-yet-paid occurrences (a
   * bill's price going up should update its future unpaid instances) but
   * never to PAID/SKIPPED occurrences — those are settled history and
   * must not retroactively change. Currency/recurrence/firstDueDate are
   * not editable here — see the comment on updateBillSchema.
   */
  async update(userId: string, id: string, input: UpdateBillInput): Promise<BillWithStatus> {
    const existing = await this.findOwned(userId, id);
    if (input.categoryId) {
      await this.categoriesService.findOneForUser(userId, input.categoryId);
    }
    if (input.accountId) {
      await this.accountsService.findOneForUser(userId, input.accountId);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.bill.update({
        where: { id },
        data: {
          ...(input.name !== undefined && { name: input.name }),
          ...(input.amountMinorUnits !== undefined && { amountMinorUnits: input.amountMinorUnits }),
          ...(input.categoryId !== undefined && { categoryId: input.categoryId }),
          ...(input.accountId !== undefined && { accountId: input.accountId }),
          ...(input.autoPay !== undefined && { autoPay: input.autoPay }),
          ...(input.notes !== undefined && { notes: input.notes }),
        },
      });

      if (
        input.amountMinorUnits !== undefined &&
        input.amountMinorUnits !== existing.amountMinorUnits
      ) {
        await tx.billOccurrence.updateMany({
          where: { billId: id, paymentStatus: "PENDING" },
          data: { amountMinorUnits: input.amountMinorUnits },
        });
      }
    });

    return this.findOneForUser(userId, id);
  }

  async archive(userId: string, id: string): Promise<BillWithStatus> {
    await this.findOwned(userId, id);
    const bill = await this.prisma.bill.update({
      where: { id },
      data: { isArchived: true },
      include: BILL_OCCURRENCES_INCLUDE,
    });
    return this.attachDisplayStatus(bill);
  }

  async restore(userId: string, id: string): Promise<BillWithStatus> {
    await this.findOwned(userId, id);
    const bill = await this.prisma.bill.update({
      where: { id },
      data: { isArchived: false },
      include: BILL_OCCURRENCES_INCLUDE,
    });
    return this.attachDisplayStatus(bill);
  }

  /**
   * Atomically marks an occurrence PAID and creates its linked
   * Transaction (ADR-005) — status update and ledger entry must never
   * happen independently. Safe to call twice: an already-PAID occurrence
   * is returned as-is rather than creating a second transaction.
   */
  async markOccurrencePaid(
    userId: string,
    billId: string,
    occurrenceId: string,
    input: MarkBillOccurrencePaidInput,
  ): Promise<BillWithStatus> {
    const bill = await this.findOwned(userId, billId);
    const occurrence = this.findOccurrence(bill, occurrenceId);

    if (occurrence.paymentStatus === "PAID") {
      return this.attachDisplayStatus(bill);
    }

    const accountId = input.accountId ?? bill.accountId;
    if (!accountId) {
      throw new BadRequestException(
        "This bill has no default account — an accountId must be provided to pay it.",
      );
    }
    await this.accountsService.findOneForUser(userId, accountId);

    const todayDateOnly = new Date(new Date().toISOString().slice(0, 10));

    await this.prisma.$transaction(async (tx) => {
      await tx.transaction.create({
        data: {
          userId,
          accountId,
          categoryId: bill.categoryId,
          type: "EXPENSE",
          amountMinorUnits: occurrence.amountMinorUnits,
          currency: occurrence.currency,
          transactionDate: todayDateOnly,
          merchant: bill.name,
          relatedBillOccurrenceId: occurrence.id,
        },
      });
      await tx.billOccurrence.update({
        where: { id: occurrence.id },
        data: { paymentStatus: "PAID", paidAt: new Date() },
      });
    });

    return this.findOneForUser(userId, billId);
  }

  /** Idempotent on repeat calls; rejects skipping an occurrence that's already been paid. */
  async markOccurrenceSkipped(
    userId: string,
    billId: string,
    occurrenceId: string,
  ): Promise<BillWithStatus> {
    const bill = await this.findOwned(userId, billId);
    const occurrence = this.findOccurrence(bill, occurrenceId);

    if (occurrence.paymentStatus === "SKIPPED") {
      return this.attachDisplayStatus(bill);
    }
    if (occurrence.paymentStatus === "PAID") {
      throw new ConflictException("This occurrence has already been paid and can't be skipped.");
    }

    await this.prisma.billOccurrence.update({
      where: { id: occurrenceId },
      data: { paymentStatus: "SKIPPED" },
    });

    return this.findOneForUser(userId, billId);
  }

  /**
   * Scopes by userId in the query itself, not fetch-then-check — another
   * user's bill is indistinguishable from a nonexistent one. See the
   * critical guarantee in docs/architecture/security.md.
   */
  private async findOwned(userId: string, id: string): Promise<BillWithOccurrences> {
    const bill = await this.prisma.bill.findFirst({
      where: { id, userId },
      include: BILL_OCCURRENCES_INCLUDE,
    });
    if (!bill) {
      throw new NotFoundException("Bill was not found.");
    }
    return bill;
  }

  private findOccurrence(
    bill: BillWithOccurrences,
    occurrenceId: string,
  ): OccurrenceWithTransaction {
    const occurrence = bill.occurrences.find((candidate) => candidate.id === occurrenceId);
    if (!occurrence) {
      throw new NotFoundException("Bill occurrence was not found.");
    }
    return occurrence;
  }

  /**
   * Tops up a recurring bill's occurrences so the horizon stays
   * populated, without a batch job: called opportunistically whenever a
   * bill is read. Archived bills and ONE_OFF bills never generate more.
   * Returns whether new rows were created.
   */
  private async ensureOccurrencesGenerated(bill: BillWithOccurrences): Promise<boolean> {
    if (bill.recurrence === "ONE_OFF" || bill.isArchived) {
      return false;
    }

    const latestDueDate = bill.occurrences.reduce<Date>(
      (max, occurrence) => (occurrence.dueDate > max ? occurrence.dueDate : max),
      bill.occurrences[0]?.dueDate ?? new Date(0),
    );
    const horizonEnd = addUtcDays(new Date(), OCCURRENCE_HORIZON_DAYS);
    if (latestDueDate.getTime() >= horizonEnd.getTime()) {
      return false;
    }

    const recurrence = bill.recurrence as BillRecurrenceType;
    const candidateNextDueDate = nextDueDate(recurrence, latestDueDate);
    if (candidateNextDueDate.getTime() > horizonEnd.getTime()) {
      return false;
    }

    const newDates = generateOccurrenceDates(recurrence, candidateNextDueDate, horizonEnd);
    await this.prisma.billOccurrence.createMany({
      data: newDates.map((dueDate) => ({
        billId: bill.id,
        userId: bill.userId,
        dueDate,
        amountMinorUnits: bill.amountMinorUnits,
        currency: bill.currency,
      })),
    });
    return true;
  }

  private attachDisplayStatus(bill: BillWithOccurrences): BillWithStatus {
    const today = new Date();
    return {
      id: bill.id,
      name: bill.name,
      amountMinorUnits: bill.amountMinorUnits,
      currency: bill.currency,
      categoryId: bill.categoryId,
      accountId: bill.accountId,
      recurrence: bill.recurrence,
      autoPay: bill.autoPay,
      notes: bill.notes,
      isArchived: bill.isArchived,
      occurrences: bill.occurrences
        .slice()
        .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
        .map((occurrence) => ({
          id: occurrence.id,
          billId: occurrence.billId,
          dueDate: occurrence.dueDate,
          amountMinorUnits: occurrence.amountMinorUnits,
          currency: occurrence.currency,
          paymentStatus: occurrence.paymentStatus,
          displayStatus: computeDisplayStatus(occurrence.paymentStatus, occurrence.dueDate, today),
          paidAt: occurrence.paidAt,
          relatedTransactionId: occurrence.transaction?.id ?? null,
        })),
    };
  }
}
