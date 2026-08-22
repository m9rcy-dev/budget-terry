import { describe, expect, it } from "vitest";
import { colors, radius, spacing } from "./index";

describe("@budget-terry/ui tokens", () => {
  it("resolves as a workspace package with the Warm Ledger palette", () => {
    expect(colors.background).toBe("#F7F7F4");
    expect(colors.accentPrimary).toBe("#285943");
  });

  it("exposes a radius scale within the plan's 8-12px range", () => {
    expect(radius.sm).toBeGreaterThanOrEqual(8);
    expect(radius.lg).toBeLessThanOrEqual(12);
  });

  it("exposes a 4px-base spacing scale", () => {
    expect(spacing.xs).toBe(4);
    expect(spacing.md % 4).toBe(0);
  });
});
