import { describe, it, expect } from "vitest";
import { selectAllItems } from "./AllItemsMapper.js";

const row = (overrides: Partial<Parameters<typeof selectAllItems>[0][0]> = {}) => ({
  capturedAt: "2026-06-01T10:00:00Z",
  name: "Blender",
  disposition: "Sell",
  handledOn: "",
  notes: "",
  driveImageUrl: "https://drive.google.com/file/d/abc123/view",
  hasDraft: false,
  ...overrides,
});

describe("AllItemsMapper", () => {
  it("returns empty array for empty input", () => {
    expect(selectAllItems([])).toEqual([]);
  });

  it("derives lifecycle as Captured when disposition is empty", () => {
    const result = selectAllItems([row({ disposition: "" })]);
    expect(result[0]?.lifecycle).toBe("Captured");
  });

  it("derives lifecycle as Handled when handledOn is set", () => {
    const result = selectAllItems([row({ handledOn: "2026-05-15" })]);
    expect(result[0]?.lifecycle).toBe("Handled");
    expect(result[0]?.handledOn).toBe("2026-05-15");
  });

  it("includes items of every Disposition", () => {
    const items = [
      row({ name: "Chair", disposition: "Give away" }),
      row({ name: "Lamp", disposition: "Donate" }),
      row({ name: "Bin", disposition: "Junk" }),
      row({ name: "Blender", disposition: "Sell" }),
    ];
    const result = selectAllItems(items);
    expect(result.map(i => i.disposition)).toEqual(["Give away", "Donate", "Junk", "Sell"]);
  });

  it("returns all items regardless of lifecycle — no filtering", () => {
    const items = [
      row({ name: "Captured", disposition: "" }),
      row({ name: "Reviewed", disposition: "Sell" }),
      row({ name: "Handled", disposition: "Donate", handledOn: "2026-05-01" }),
    ];
    const result = selectAllItems(items);
    expect(result).toHaveLength(3);
    expect(result.map(i => i.lifecycle)).toEqual(["Captured", "Reviewed", "Handled"]);
  });

  it("maps all fields of a Reviewed item", () => {
    const result = selectAllItems([row({ notes: "Good condition" })]);
    expect(result).toEqual([{
      name: "Blender",
      lifecycle: "Reviewed",
      disposition: "Sell",
      notes: "Good condition",
      capturedAt: "2026-06-01T10:00:00Z",
      handledOn: "",
      driveImageUrl: "https://drive.google.com/file/d/abc123/view",
    }]);
  });
});
