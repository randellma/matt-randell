import { describe, it, expect } from "vitest";
import { mapListingDraft } from "./ListingDraftMapper.js";

describe("ListingDraftMapper", () => {
  const base = {
    priceRange: "$20–30",
    rationale: "Similar used blenders sell for $20–$35 on Marketplace",
    postTemplate: "Oster blender, works perfectly. $25 OBO. Pick up only.",
  };

  it("maps all three draft fields to the correct ordered positions", () => {
    const values = mapListingDraft(base);

    expect(values[0]).toBe("$20–30");                                                    // col [7] — price range
    expect(values[1]).toBe("Similar used blenders sell for $20–$35 on Marketplace");     // col [8] — rationale
    expect(values[2]).toBe("Oster blender, works perfectly. $25 OBO. Pick up only.");    // col [9] — post template
  });

  it("passes priceRange through unchanged", () => {
    const values = mapListingDraft({ ...base, priceRange: "$5–10" });
    expect(values[0]).toBe("$5–10");
  });

  it("passes rationale through unchanged", () => {
    const values = mapListingDraft({ ...base, rationale: "Low demand, price to move" });
    expect(values[1]).toBe("Low demand, price to move");
  });

  it("passes postTemplate through unchanged", () => {
    const template = "Old blender, chipped lid. Free to good home. DM to arrange pickup.";
    const values = mapListingDraft({ ...base, postTemplate: template });
    expect(values[2]).toBe(template);
  });
});
