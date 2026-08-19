import { computeCurrentPeriod } from "./budget-period";

function utcDate(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

describe("computeCurrentPeriod", () => {
  describe("WEEKLY", () => {
    const anchor = utcDate("2026-08-03"); // a Monday

    it("returns the anchor week when the reference date is the anchor itself", () => {
      const { start, end } = computeCurrentPeriod("WEEKLY", anchor, anchor);
      expect(iso(start)).toBe("2026-08-03");
      expect(iso(end)).toBe("2026-08-09");
    });

    it("stays in the same period for a reference date mid-week", () => {
      const { start, end } = computeCurrentPeriod("WEEKLY", anchor, utcDate("2026-08-06"));
      expect(iso(start)).toBe("2026-08-03");
      expect(iso(end)).toBe("2026-08-09");
    });

    it("stays in the same period on the last day of the week", () => {
      const { start, end } = computeCurrentPeriod("WEEKLY", anchor, utcDate("2026-08-09"));
      expect(iso(start)).toBe("2026-08-03");
      expect(iso(end)).toBe("2026-08-09");
    });

    it("rolls over to the next period on the first day after the week ends", () => {
      const { start, end } = computeCurrentPeriod("WEEKLY", anchor, utcDate("2026-08-10"));
      expect(iso(start)).toBe("2026-08-10");
      expect(iso(end)).toBe("2026-08-16");
    });

    it("computes the previous period for a reference date before the anchor", () => {
      const { start, end } = computeCurrentPeriod("WEEKLY", anchor, utcDate("2026-08-02"));
      expect(iso(start)).toBe("2026-07-27");
      expect(iso(end)).toBe("2026-08-02");
    });
  });

  describe("FORTNIGHTLY", () => {
    const anchor = utcDate("2026-08-03");

    it("spans 14 days from the anchor", () => {
      const { start, end } = computeCurrentPeriod("FORTNIGHTLY", anchor, anchor);
      expect(iso(start)).toBe("2026-08-03");
      expect(iso(end)).toBe("2026-08-16");
    });

    it("rolls over after 14 days", () => {
      const { start, end } = computeCurrentPeriod("FORTNIGHTLY", anchor, utcDate("2026-08-17"));
      expect(iso(start)).toBe("2026-08-17");
      expect(iso(end)).toBe("2026-08-30");
    });

    it("computes the previous fortnight for a reference date before the anchor", () => {
      const { start, end } = computeCurrentPeriod("FORTNIGHTLY", anchor, utcDate("2026-07-25"));
      expect(iso(start)).toBe("2026-07-20");
      expect(iso(end)).toBe("2026-08-02");
    });
  });

  describe("MONTHLY", () => {
    const anchor = utcDate("2026-01-15");

    it("returns the anchor month when the reference date is the anchor itself", () => {
      const { start, end } = computeCurrentPeriod("MONTHLY", anchor, anchor);
      expect(iso(start)).toBe("2026-01-15");
      expect(iso(end)).toBe("2026-02-14");
    });

    it("stays in the same period on the last day before the next anchor", () => {
      const { start, end } = computeCurrentPeriod("MONTHLY", anchor, utcDate("2026-02-14"));
      expect(iso(start)).toBe("2026-01-15");
      expect(iso(end)).toBe("2026-02-14");
    });

    it("rolls over on the next month's anchor day", () => {
      const { start, end } = computeCurrentPeriod("MONTHLY", anchor, utcDate("2026-02-15"));
      expect(iso(start)).toBe("2026-02-15");
      expect(iso(end)).toBe("2026-03-14");
    });

    it("computes the previous period for a reference date before the anchor", () => {
      const { start, end } = computeCurrentPeriod("MONTHLY", anchor, utcDate("2026-01-01"));
      expect(iso(start)).toBe("2025-12-15");
      expect(iso(end)).toBe("2026-01-14");
    });

    it("clamps an end-of-month anchor (31st) in a shorter month (28-day February)", () => {
      const endOfMonthAnchor = utcDate("2026-01-31");

      const midFeb = computeCurrentPeriod("MONTHLY", endOfMonthAnchor, utcDate("2026-02-15"));
      expect(iso(midFeb.start)).toBe("2026-01-31");
      expect(iso(midFeb.end)).toBe("2026-02-27");

      const onClampedBoundary = computeCurrentPeriod(
        "MONTHLY",
        endOfMonthAnchor,
        utcDate("2026-02-28"),
      );
      expect(iso(onClampedBoundary.start)).toBe("2026-02-28");
      expect(iso(onClampedBoundary.end)).toBe("2026-03-30");
    });

    it("clamps an end-of-month anchor (31st) in a 29-day leap-year February", () => {
      const endOfMonthAnchor = utcDate("2024-01-31");

      const beforeClampedBoundary = computeCurrentPeriod(
        "MONTHLY",
        endOfMonthAnchor,
        utcDate("2024-02-15"),
      );
      expect(iso(beforeClampedBoundary.start)).toBe("2024-01-31");
      expect(iso(beforeClampedBoundary.end)).toBe("2024-02-28");

      const onClampedBoundary = computeCurrentPeriod(
        "MONTHLY",
        endOfMonthAnchor,
        utcDate("2024-02-29"),
      );
      expect(iso(onClampedBoundary.start)).toBe("2024-02-29");
      expect(iso(onClampedBoundary.end)).toBe("2024-03-30");
    });

    it("walks a full calendar year with no drift for a first-of-month anchor", () => {
      const firstOfMonthAnchor = utcDate("2026-01-01");
      const expectedMonths = [
        ["2026-01-01", "2026-01-31"],
        ["2026-02-01", "2026-02-28"],
        ["2026-03-01", "2026-03-31"],
        ["2026-04-01", "2026-04-30"],
        ["2026-05-01", "2026-05-31"],
        ["2026-06-01", "2026-06-30"],
        ["2026-07-01", "2026-07-31"],
        ["2026-08-01", "2026-08-31"],
        ["2026-09-01", "2026-09-30"],
        ["2026-10-01", "2026-10-31"],
        ["2026-11-01", "2026-11-30"],
        ["2026-12-01", "2026-12-31"],
      ];

      for (const [monthStart, monthEnd] of expectedMonths) {
        const midMonth = new Date(monthStart!);
        midMonth.setUTCDate(15);
        const { start, end } = computeCurrentPeriod("MONTHLY", firstOfMonthAnchor, midMonth);
        expect(iso(start)).toBe(monthStart);
        expect(iso(end)).toBe(monthEnd);
      }
    });
  });
});
