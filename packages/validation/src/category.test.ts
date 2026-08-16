import { describe, expect, it } from "vitest";
import { createCategorySchema, updateCategorySchema } from "./category";

describe("createCategorySchema", () => {
  it("accepts a non-empty name", () => {
    expect(createCategorySchema.safeParse({ name: "Groceries" }).success).toBe(true);
  });

  it("rejects an empty name", () => {
    expect(createCategorySchema.safeParse({ name: "" }).success).toBe(false);
  });
});

describe("updateCategorySchema", () => {
  it("requires a name — renaming is the only supported update", () => {
    expect(updateCategorySchema.safeParse({}).success).toBe(false);
    expect(updateCategorySchema.safeParse({ name: "Restaurants" }).success).toBe(true);
  });
});
