import { computeDisplayStatus, generateOccurrenceDates, nextDueDate } from "./bill-recurrence";

function utcDate(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

function isoList(dates: Date[]): string[] {
  return dates.map((date) => date.toISOString().slice(0, 10));
}

describe("nextDueDate", () => {
  it("steps WEEKLY by 7 days", () => {
    expect(nextDueDate("WEEKLY", utcDate("2026-08-03")).toISOString().slice(0, 10)).toBe(
      "2026-08-10",
    );
  });

  it("steps FORTNIGHTLY by 14 days", () => {
    expect(nextDueDate("FORTNIGHTLY", utcDate("2026-08-03")).toISOString().slice(0, 10)).toBe(
      "2026-08-17",
    );
  });

  it("steps MONTHLY by 1 month, clamping day-of-month", () => {
    expect(nextDueDate("MONTHLY", utcDate("2026-01-31")).toISOString().slice(0, 10)).toBe(
      "2026-02-28",
    );
  });

  it("steps QUARTERLY by 3 months", () => {
    expect(nextDueDate("QUARTERLY", utcDate("2026-01-31")).toISOString().slice(0, 10)).toBe(
      "2026-04-30",
    );
  });

  it("steps YEARLY by 12 months, clamping a leap-day anchor", () => {
    expect(nextDueDate("YEARLY", utcDate("2024-02-29")).toISOString().slice(0, 10)).toBe(
      "2025-02-28",
    );
  });

  it("throws for ONE_OFF, which never recurs", () => {
    expect(() => nextDueDate("ONE_OFF", utcDate("2026-08-03"))).toThrow();
  });
});

describe("generateOccurrenceDates", () => {
  it("returns exactly [from] for ONE_OFF, regardless of the horizon", () => {
    const dates = generateOccurrenceDates("ONE_OFF", utcDate("2026-08-03"), utcDate("2026-08-01"));
    expect(isoList(dates)).toEqual(["2026-08-03"]);
  });

  it("always includes the starting date even when it is in the past relative to the horizon", () => {
    const dates = generateOccurrenceDates("WEEKLY", utcDate("2026-01-01"), utcDate("2026-01-01"));
    expect(isoList(dates)).toEqual(["2026-01-01"]);
  });

  it("generates WEEKLY occurrences up to and including the horizon boundary", () => {
    const dates = generateOccurrenceDates("WEEKLY", utcDate("2026-08-03"), utcDate("2026-08-24"));
    expect(isoList(dates)).toEqual(["2026-08-03", "2026-08-10", "2026-08-17", "2026-08-24"]);
  });

  it("excludes a date that falls one day beyond the horizon", () => {
    const dates = generateOccurrenceDates("WEEKLY", utcDate("2026-08-03"), utcDate("2026-08-23"));
    expect(isoList(dates)).toEqual(["2026-08-03", "2026-08-10", "2026-08-17"]);
  });

  it("generates MONTHLY occurrences, clamping across a shorter month", () => {
    const dates = generateOccurrenceDates("MONTHLY", utcDate("2026-01-31"), utcDate("2026-04-30"));
    expect(isoList(dates)).toEqual(["2026-01-31", "2026-02-28", "2026-03-28", "2026-04-28"]);
  });

  it("generates QUARTERLY occurrences", () => {
    const dates = generateOccurrenceDates(
      "QUARTERLY",
      utcDate("2026-01-15"),
      utcDate("2026-10-15"),
    );
    expect(isoList(dates)).toEqual(["2026-01-15", "2026-04-15", "2026-07-15", "2026-10-15"]);
  });

  it("generates YEARLY occurrences across a leap-day anchor", () => {
    const dates = generateOccurrenceDates("YEARLY", utcDate("2024-02-29"), utcDate("2027-01-01"));
    expect(isoList(dates)).toEqual(["2024-02-29", "2025-02-28", "2026-02-28"]);
  });
});

describe("computeDisplayStatus", () => {
  const today = utcDate("2026-08-15");

  it("passes PAID through unchanged, regardless of dueDate", () => {
    expect(computeDisplayStatus("PAID", utcDate("2026-01-01"), today)).toBe("PAID");
    expect(computeDisplayStatus("PAID", utcDate("2026-12-31"), today)).toBe("PAID");
  });

  it("passes SKIPPED through unchanged, regardless of dueDate", () => {
    expect(computeDisplayStatus("SKIPPED", utcDate("2026-01-01"), today)).toBe("SKIPPED");
  });

  it("reports OVERDUE for a PENDING occurrence due yesterday", () => {
    expect(computeDisplayStatus("PENDING", utcDate("2026-08-14"), today)).toBe("OVERDUE");
  });

  it("reports OVERDUE for a PENDING occurrence due long ago", () => {
    expect(computeDisplayStatus("PENDING", utcDate("2026-01-01"), today)).toBe("OVERDUE");
  });

  it("reports DUE_TODAY for a PENDING occurrence due today", () => {
    expect(computeDisplayStatus("PENDING", utcDate("2026-08-15"), today)).toBe("DUE_TODAY");
  });

  it("reports DUE_SOON at the edge of the due-soon window (7 days out)", () => {
    expect(computeDisplayStatus("PENDING", utcDate("2026-08-22"), today)).toBe("DUE_SOON");
  });

  it("reports DUE_SOON just inside the window (1 day out)", () => {
    expect(computeDisplayStatus("PENDING", utcDate("2026-08-16"), today)).toBe("DUE_SOON");
  });

  it("reports UPCOMING just beyond the due-soon window (8 days out)", () => {
    expect(computeDisplayStatus("PENDING", utcDate("2026-08-23"), today)).toBe("UPCOMING");
  });

  it("reports UPCOMING for a PENDING occurrence far in the future", () => {
    expect(computeDisplayStatus("PENDING", utcDate("2026-12-31"), today)).toBe("UPCOMING");
  });
});
