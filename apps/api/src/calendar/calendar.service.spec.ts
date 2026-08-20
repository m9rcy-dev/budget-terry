import type { BillsService } from "../bills/bills.service";
import type { TransactionsService } from "../transactions/transactions.service";
import { CalendarService } from "./calendar.service";

function buildCalendarService() {
  const billsService = { findOccurrencesDueInRange: jest.fn() };
  const transactionsService = { findIncomeInRange: jest.fn() };

  const service = new CalendarService(
    billsService as unknown as BillsService,
    transactionsService as unknown as TransactionsService,
  );

  return { service, billsService, transactionsService };
}

describe("CalendarService", () => {
  it("returns an empty array when neither bills nor income fall in the range", async () => {
    const { service, billsService, transactionsService } = buildCalendarService();
    billsService.findOccurrencesDueInRange.mockResolvedValue([]);
    transactionsService.findIncomeInRange.mockResolvedValue([]);

    const result = await service.getEntries("user-1", { from: "2026-08-01", to: "2026-08-31" });

    expect(result).toEqual([]);
  });

  it("maps a bill occurrence to a BILL entry", async () => {
    const { service, billsService, transactionsService } = buildCalendarService();
    billsService.findOccurrencesDueInRange.mockResolvedValue([
      {
        occurrenceId: "occ-1",
        billId: "bill-1",
        billName: "Electricity",
        dueDate: new Date("2026-08-12T00:00:00.000Z"),
        amountMinorUnits: 18400,
        currency: "NZD",
        displayStatus: "UPCOMING",
      },
    ]);
    transactionsService.findIncomeInRange.mockResolvedValue([]);

    const result = await service.getEntries("user-1", { from: "2026-08-01", to: "2026-08-31" });

    expect(result).toEqual([
      {
        type: "BILL",
        date: "2026-08-12",
        billId: "bill-1",
        occurrenceId: "occ-1",
        name: "Electricity",
        amountMinorUnits: 18400,
        currency: "NZD",
        displayStatus: "UPCOMING",
      },
    ]);
  });

  it("maps an income transaction to an INCOME entry", async () => {
    const { service, billsService, transactionsService } = buildCalendarService();
    billsService.findOccurrencesDueInRange.mockResolvedValue([]);
    transactionsService.findIncomeInRange.mockResolvedValue([
      {
        id: "txn-1",
        userId: "user-1",
        accountId: "acct-1",
        categoryId: null,
        type: "INCOME",
        amountMinorUnits: 410000,
        currency: "NZD",
        transactionDate: new Date("2026-08-15T00:00:00.000Z"),
        merchant: "Salary",
        description: null,
        relatedBillOccurrenceId: null,
        relatedGoalContributionId: null,
        idempotencyKey: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const result = await service.getEntries("user-1", { from: "2026-08-01", to: "2026-08-31" });

    expect(result).toEqual([
      {
        type: "INCOME",
        date: "2026-08-15",
        transactionId: "txn-1",
        amountMinorUnits: 410000,
        currency: "NZD",
        merchant: "Salary",
        description: null,
      },
    ]);
  });

  it("merges bill and income entries sorted by date, regardless of source order", async () => {
    const { service, billsService, transactionsService } = buildCalendarService();
    billsService.findOccurrencesDueInRange.mockResolvedValue([
      {
        occurrenceId: "occ-1",
        billId: "bill-1",
        billName: "Internet",
        dueDate: new Date("2026-08-24T00:00:00.000Z"),
        amountMinorUnits: 8500,
        currency: "NZD",
        displayStatus: "UPCOMING",
      },
    ]);
    transactionsService.findIncomeInRange.mockResolvedValue([
      {
        id: "txn-1",
        userId: "user-1",
        accountId: "acct-1",
        categoryId: null,
        type: "INCOME",
        amountMinorUnits: 410000,
        currency: "NZD",
        transactionDate: new Date("2026-08-01T00:00:00.000Z"),
        merchant: "Salary",
        description: null,
        relatedBillOccurrenceId: null,
        relatedGoalContributionId: null,
        idempotencyKey: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const result = await service.getEntries("user-1", { from: "2026-08-01", to: "2026-08-31" });

    expect(result.map((entry) => entry.date)).toEqual(["2026-08-01", "2026-08-24"]);
    expect(result[0]!.type).toBe("INCOME");
    expect(result[1]!.type).toBe("BILL");
  });

  it("converts the query's ISO date strings to Date objects when calling collaborators", async () => {
    const { service, billsService, transactionsService } = buildCalendarService();
    billsService.findOccurrencesDueInRange.mockResolvedValue([]);
    transactionsService.findIncomeInRange.mockResolvedValue([]);

    await service.getEntries("user-1", { from: "2026-08-01", to: "2026-08-31" });

    const [, billsFrom, billsTo] = billsService.findOccurrencesDueInRange.mock.calls[0];
    expect(billsFrom).toBeInstanceOf(Date);
    expect(billsTo).toBeInstanceOf(Date);
    expect(billsFrom.toISOString().slice(0, 10)).toBe("2026-08-01");
    expect(billsTo.toISOString().slice(0, 10)).toBe("2026-08-31");
    expect(transactionsService.findIncomeInRange).toHaveBeenCalledWith(
      "user-1",
      billsFrom,
      billsTo,
    );
  });
});
