import { describe, it, expect } from "vitest";
import { selectPendingDrafts } from "./PendingDraftSelector.js";

describe("PendingDraftSelector", () => {
  const sellItem = { capturedAt: "2026-06-01T10:00:00Z", name: "Blender", disposition: "Sell", handledOn: "", notes: "", driveImageUrl: "url1", hasDraft: false };

  it("returns Sell Items with no draft", () => {
    const result = selectPendingDrafts([sellItem]);
    expect(result).toEqual([{ name: "Blender", driveImageUrl: "url1" }]);
  });

  it("excludes Give away, Donate, and Junk Items", () => {
    const others = [
      { capturedAt: "", name: "Chair", disposition: "Give away", handledOn: "", notes: "", driveImageUrl: "url2", hasDraft: false },
      { capturedAt: "", name: "Lamp", disposition: "Donate", handledOn: "", notes: "", driveImageUrl: "url3", hasDraft: false },
      { capturedAt: "", name: "Bin", disposition: "Junk", handledOn: "", notes: "", driveImageUrl: "url4", hasDraft: false },
    ];
    expect(selectPendingDrafts(others)).toEqual([]);
  });

  it("excludes undecided Items (empty Disposition)", () => {
    const undecided = [{ capturedAt: "", name: "Book", disposition: "", handledOn: "", notes: "", driveImageUrl: "url5", hasDraft: false }];
    expect(selectPendingDrafts(undecided)).toEqual([]);
  });

  it("excludes Sell Items that are already Handled", () => {
    const handled = [{ capturedAt: "", name: "TV", disposition: "Sell", handledOn: "2026-05-01", notes: "", driveImageUrl: "url6", hasDraft: false }];
    expect(selectPendingDrafts(handled)).toEqual([]);
  });

  it("excludes Sell Items that already have a draft", () => {
    const drafted = [{ capturedAt: "", name: "Camera", disposition: "Sell", handledOn: "", notes: "", driveImageUrl: "url7", hasDraft: true }];
    expect(selectPendingDrafts(drafted)).toEqual([]);
  });

  it("returns only the pending Items from a mixed list", () => {
    const items = [
      { capturedAt: "", name: "Blender", disposition: "Sell", handledOn: "", notes: "", driveImageUrl: "url1", hasDraft: false },
      { capturedAt: "", name: "Chair", disposition: "Give away", handledOn: "", notes: "", driveImageUrl: "url2", hasDraft: false },
      { capturedAt: "", name: "TV", disposition: "Sell", handledOn: "2026-05-01", notes: "", driveImageUrl: "url3", hasDraft: false },
      { capturedAt: "", name: "Camera", disposition: "Sell", handledOn: "", notes: "", driveImageUrl: "url4", hasDraft: true },
      { capturedAt: "", name: "Book", disposition: "", handledOn: "", notes: "", driveImageUrl: "url5", hasDraft: false },
    ];
    expect(selectPendingDrafts(items)).toEqual([{ name: "Blender", driveImageUrl: "url1" }]);
  });
});
