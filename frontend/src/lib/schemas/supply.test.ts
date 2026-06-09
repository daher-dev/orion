import { describe, expect, it } from "vitest";
import {
  supplyAdjustFormSchema,
  supplyFormSchema,
  supplyLevelReadSchema,
  type SupplyLevelRead,
} from "@/lib/schemas/supply";

describe("supplyFormSchema", () => {
  it("accepts a minimal valid supply and normalizes comma decimals", () => {
    const result = supplyFormSchema.safeParse({
      name: "  Linha branca  ",
      unit: "m",
      unit_cost: "3,50",
      min_stock: "",
      notes: "",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Linha branca");
      // comma -> dot transform mirrors the backend Decimal-string contract.
      expect(result.data.unit_cost).toBe("3.50");
    }
  });

  it("rejects an empty name", () => {
    const result = supplyFormSchema.safeParse({ name: "", unit: "m", unit_cost: "1" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message === "validation.nameRequired")).toBe(true);
    }
  });

  it("rejects a non-numeric unit cost", () => {
    const result = supplyFormSchema.safeParse({ name: "X", unit: "m", unit_cost: "abc" });
    expect(result.success).toBe(false);
  });

  it("accepts an optional min_stock and a numeric one", () => {
    expect(supplyFormSchema.safeParse({ name: "X", unit: "m", unit_cost: "1" }).success).toBe(true);
    expect(
      supplyFormSchema.safeParse({ name: "X", unit: "m", unit_cost: "1", min_stock: "100" }).success,
    ).toBe(true);
  });
});

describe("supplyAdjustFormSchema", () => {
  it("requires a positive quantity", () => {
    const ok = supplyAdjustFormSchema.safeParse({
      kind: "entry",
      supply_id: "abc",
      quantity: "5",
    });
    expect(ok.success).toBe(true);

    const zero = supplyAdjustFormSchema.safeParse({ kind: "exit", supply_id: "abc", quantity: "0" });
    expect(zero.success).toBe(false);
  });

  it("requires a supply id", () => {
    const result = supplyAdjustFormSchema.safeParse({ kind: "entry", supply_id: "", quantity: "5" });
    expect(result.success).toBe(false);
  });
});

describe("supplyLevelReadSchema (low-stock math)", () => {
  const base = {
    supply_id: "s1",
    name: "Cola",
    unit: "L",
    unit_cost: "12.00",
    on_hand: "8.000",
    entries_total: "10.000",
    exits_total: "2.000",
    last_movement_at: null,
  };

  function isLow(level: SupplyLevelRead): boolean {
    if (level.min_stock === null || level.min_stock === undefined || level.min_stock === "") return false;
    return Number(level.on_hand) <= Number(level.min_stock);
  }

  it("parses a level row with a nullable threshold", () => {
    const result = supplyLevelReadSchema.safeParse({ ...base, min_stock: null });
    expect(result.success).toBe(true);
  });

  it("flags low when on-hand is at or below the threshold", () => {
    const low = supplyLevelReadSchema.parse({ ...base, on_hand: "5.000", min_stock: "10.000" });
    const ok = supplyLevelReadSchema.parse({ ...base, on_hand: "20.000", min_stock: "10.000" });
    const none = supplyLevelReadSchema.parse({ ...base, on_hand: "0.000", min_stock: null });
    expect(isLow(low)).toBe(true);
    expect(isLow(ok)).toBe(false);
    // No threshold -> never low, even at zero on-hand.
    expect(isLow(none)).toBe(false);
  });
});
