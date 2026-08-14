import { describe, expect, it } from "vitest";
import { UI_PACKAGE_PLACEHOLDER } from "./index";

describe("@budget-terry/ui", () => {
  it("resolves as a workspace package", () => {
    expect(UI_PACKAGE_PLACEHOLDER).toBe(true);
  });
});
