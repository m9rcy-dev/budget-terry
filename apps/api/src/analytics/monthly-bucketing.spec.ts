import { bucketByMonth } from "./monthly-bucketing";

function utcDate(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

describe("bucketByMonth", () => {
  it("returns an empty array for no transactions", () => {
    expect(bucketByMonth([])).toEqual([]);
  });

  it("buckets a single expense", () => {
    const result = bucketByMonth([
      { type: "EXPENSE", amountMinorUnits: 5000, transactionDate: utcDate("2026-08-12") },
    ]);
    expect(result).toEqual([{ month: "2026-08", incomeMinorUnits: 0, expensesMinorUnits: 5000 }]);
  });

  it("buckets a single income transaction", () => {
    const result = bucketByMonth([
      { type: "INCOME", amountMinorUnits: 400000, transactionDate: utcDate("2026-08-01") },
    ]);
    expect(result).toEqual([{ month: "2026-08", incomeMinorUnits: 400000, expensesMinorUnits: 0 }]);
  });

  it("sums multiple transactions within the same month", () => {
    const result = bucketByMonth([
      { type: "EXPENSE", amountMinorUnits: 1000, transactionDate: utcDate("2026-08-01") },
      { type: "EXPENSE", amountMinorUnits: 2000, transactionDate: utcDate("2026-08-15") },
      { type: "INCOME", amountMinorUnits: 5000, transactionDate: utcDate("2026-08-20") },
    ]);
    expect(result).toEqual([
      { month: "2026-08", incomeMinorUnits: 5000, expensesMinorUnits: 3000 },
    ]);
  });

  it("splits transactions into separate months, sorted ascending", () => {
    const result = bucketByMonth([
      { type: "EXPENSE", amountMinorUnits: 100, transactionDate: utcDate("2026-09-01") },
      { type: "EXPENSE", amountMinorUnits: 200, transactionDate: utcDate("2026-07-01") },
      { type: "EXPENSE", amountMinorUnits: 300, transactionDate: utcDate("2026-08-01") },
    ]);
    expect(result.map((bucket) => bucket.month)).toEqual(["2026-07", "2026-08", "2026-09"]);
  });

  it("sorts correctly across a year boundary", () => {
    const result = bucketByMonth([
      { type: "EXPENSE", amountMinorUnits: 100, transactionDate: utcDate("2026-01-15") },
      { type: "EXPENSE", amountMinorUnits: 100, transactionDate: utcDate("2025-12-15") },
    ]);
    expect(result.map((bucket) => bucket.month)).toEqual(["2025-12", "2026-01"]);
  });

  it("omits months with no transactions rather than zero-filling", () => {
    const result = bucketByMonth([
      { type: "EXPENSE", amountMinorUnits: 100, transactionDate: utcDate("2026-01-01") },
      { type: "EXPENSE", amountMinorUnits: 100, transactionDate: utcDate("2026-03-01") },
    ]);
    expect(result.map((bucket) => bucket.month)).toEqual(["2026-01", "2026-03"]);
  });
});
