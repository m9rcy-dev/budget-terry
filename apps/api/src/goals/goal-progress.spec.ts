import { computeMonthsRemaining, computeSuggestedMonthlyContribution } from "./goal-progress";

function utcDate(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

describe("computeMonthsRemaining", () => {
  it("counts whole months between today and a same-day-of-month target", () => {
    expect(computeMonthsRemaining(utcDate("2026-08-20"), utcDate("2027-02-20"))).toBe(6);
  });

  it("counts a partial final month as needing this month's contribution", () => {
    // Aug 20 -> Sep 5 is under a month away, but still needs an August contribution.
    expect(computeMonthsRemaining(utcDate("2026-08-20"), utcDate("2026-09-05"))).toBe(1);
  });

  it("does not count a full extra month when the target's day-of-month is later", () => {
    expect(computeMonthsRemaining(utcDate("2026-08-05"), utcDate("2026-09-20"))).toBe(1);
  });

  it("clamps to a minimum of 1 for a target date this month", () => {
    expect(computeMonthsRemaining(utcDate("2026-08-05"), utcDate("2026-08-20"))).toBe(1);
  });

  it("clamps to a minimum of 1 for a target date already in the past", () => {
    expect(computeMonthsRemaining(utcDate("2026-08-20"), utcDate("2026-01-01"))).toBe(1);
  });

  it("handles a full year correctly", () => {
    expect(computeMonthsRemaining(utcDate("2026-01-15"), utcDate("2027-01-15"))).toBe(12);
  });

  it("handles a leap-day target date", () => {
    expect(computeMonthsRemaining(utcDate("2024-01-29"), utcDate("2024-02-29"))).toBe(1);
  });
});

describe("computeSuggestedMonthlyContribution", () => {
  it("divides the remaining amount evenly across the months remaining", () => {
    expect(computeSuggestedMonthlyContribution(600000, 6)).toBe(100000);
  });

  it("rounds up so the suggestion never under-shoots the target", () => {
    expect(computeSuggestedMonthlyContribution(100, 3)).toBe(34);
  });

  it("returns 0 when the goal is already fully funded", () => {
    expect(computeSuggestedMonthlyContribution(0, 6)).toBe(0);
  });

  it("returns 0 for a negative remaining amount (overshoot)", () => {
    expect(computeSuggestedMonthlyContribution(-5000, 6)).toBe(0);
  });

  it("returns the full remaining amount when only 1 month remains", () => {
    expect(computeSuggestedMonthlyContribution(475000, 1)).toBe(475000);
  });
});
