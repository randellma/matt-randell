import { describe, it, expect } from "vitest";
import { selectPendingDrafts } from "./PendingDraftSelector.js";

describe("PendingDraftSelector", () => {
  const sellItem = { name: "Blender", disposition: "Sell", handledOn: "", driveImageUrl: "url1", hasDraft: false };

  it("returns Sell Items with no draft", () => {
    const result = selectPendingDrafts([sellItem]);
    expect(result).toEqual([{ name: "Blender", driveImageUrl: "url1" }]);
  });

  it("excludes Give away, Donate, and Junk Items", () => {
    const others = [
      { name: "Chair", disposition: "Give away", handledOn: "", driveImageUrl: "url2", hasDraft: false },
      { name: "Lamp", disposition: "Donate", handledOn: "", driveImageUrl: "url3", hasDraft: false },
      { name: "Bin", disposition: "Junk", handledOn: "", driveImageUrl: "url4", hasDraft: false },
    ];
    expect(selectPendingDrafts(others)).toEqual([]);
  });

  it("excludes undecided Items (empty Disposition)", () => {
    const undecided = [{ name: "Book", disposition: "", handledOn: "", driveImageUrl: "url5", hasDraft: false }];
    expect(selectPendingDrafts(undecided)).toEqual([]);
  });

  it("excludes Sell Items that are already Handled", () => {
    const handled = [{ name: "TV", disposition: "Sell", handledOn: "2026-05-01", driveImageUrl: "url6", hasDraft: false }];
    expect(selectPendingDrafts(handled)).toEqual([]);
  });

  it("excludes Sell Items that already have a draft", () => {
    const drafted = [{ name: "Camera", disposition: "Sell", handledOn: "", driveImageUrl: "url7", hasDraft: true }];
    expect(selectPendingDrafts(drafted)).toEqual([]);
  });

  it("returns only the pending Items from a mixed list", () => {
    const items = [
      { name: "Blender", disposition: "Sell", handledOn: "", driveImageUrl: "url1", hasDraft: false },
      { name: "Chair", disposition: "Give away", handledOn: "", driveImageUrl: "url2", hasDraft: false },
      { name: "TV", disposition: "Sell", handledOn: "2026-05-01", driveImageUrl: "url3", hasDraft: false },
      { name: "Camera", disposition: "Sell", handledOn: "", driveImageUrl: "url4", hasDraft: true },
      { name: "Book", disposition: "", handledOn: "", driveImageUrl: "url5", hasDraft: false },
    ];
    expect(selectPendingDrafts(items)).toEqual([{ name: "Blender", driveImageUrl: "url1" }]);
  });
});
