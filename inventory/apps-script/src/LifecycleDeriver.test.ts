import { describe, it, expect } from "vitest";
import { deriveLifecycle } from "./LifecycleDeriver.js";

describe("LifecycleDeriver", () => {
  it("returns Captured when Disposition is empty", () => {
    expect(deriveLifecycle({ disposition: "", handledOn: "" })).toBe("Captured");
  });

  it("returns Reviewed when Disposition is set and Handled-on is empty", () => {
    expect(deriveLifecycle({ disposition: "Sell", handledOn: "" })).toBe("Reviewed");
  });

  it("returns Handled when Handled-on is present", () => {
    expect(deriveLifecycle({ disposition: "Sell", handledOn: "2026-06-01" })).toBe("Handled");
  });
});
