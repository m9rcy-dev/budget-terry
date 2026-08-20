import { monthlyEquivalent } from "./recurring-expense";

describe("monthlyEquivalent", () => {
  it("converts WEEKLY to a monthly-equivalent amount", () => {
    expect(monthlyEquivalent(10000, "WEEKLY")).toBe(43333);
  });

  it("converts FORTNIGHTLY to a monthly-equivalent amount", () => {
    expect(monthlyEquivalent(10000, "FORTNIGHTLY")).toBe(21667);
  });

  it("returns MONTHLY unchanged", () => {
    expect(monthlyEquivalent(10000, "MONTHLY")).toBe(10000);
  });

  it("converts QUARTERLY to a monthly-equivalent amount", () => {
    expect(monthlyEquivalent(30000, "QUARTERLY")).toBe(10000);
  });

  it("converts YEARLY to a monthly-equivalent amount", () => {
    expect(monthlyEquivalent(120000, "YEARLY")).toBe(10000);
  });

  it("throws for ONE_OFF, which has no recurring cadence", () => {
    expect(() => monthlyEquivalent(10000, "ONE_OFF")).toThrow();
  });
});
