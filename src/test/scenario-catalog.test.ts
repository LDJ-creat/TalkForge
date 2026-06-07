import { describe, expect, it } from "vitest";

import {
  assignCustomScenarioId,
  getSeedScenarioIds,
  slugifyScenarioTitle,
} from "@/server/scenario/catalog";

describe("scenario catalog helpers", () => {
  it("slugifies scenario titles", () => {
    expect(slugifyScenarioTitle("Order Coffee at a Cafe!")).toBe("order_coffee_at_a_cafe");
    expect(slugifyScenarioTitle("   ")).toBe("scenario");
  });

  it("assigns unique custom scenario ids", () => {
    const existingIds = new Set(["custom_order_coffee_at_a_cafe", ...getSeedScenarioIds()]);

    expect(assignCustomScenarioId("Order Coffee at a Cafe!", existingIds)).toBe(
      "custom_order_coffee_at_a_cafe_2",
    );
    expect(assignCustomScenarioId("Pharmacy Visit", existingIds)).toBe("custom_pharmacy_visit");
  });
});
