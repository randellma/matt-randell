import { describe, it, expect } from "vitest";
import { mapCapturePayload } from "./CapturePayloadMapper.js";

describe("CapturePayloadMapper", () => {
  const base = {
    name: "Old blender",
    capturedAt: "2026-06-07T10:00:00Z",
    driveImageUrl: "https://drive.google.com/file/d/abc123",
  };

  it("maps a full payload (with Disposition) to the correct ordered row values", () => {
    const row = mapCapturePayload({ ...base, disposition: "Sell" });

    expect(row[0]).toBe("2026-06-07T10:00:00Z"); // Captured at
    expect(row[1]).toBeNull(); // Photo placeholder — SheetGateway embeds the CellImage
    expect(row[2]).toBe("Old blender"); // Name
    expect(row[3]).toBe("Sell"); // Disposition
    expect(row[4]).toBe(""); // Handled on (blank)
    expect(row[5]).toBe(""); // Notes (blank)
    expect(row[6]).toBe("https://drive.google.com/file/d/abc123"); // Drive image URL
  });

  it("leaves Disposition blank when omitted", () => {
    const row = mapCapturePayload(base);
    expect(row[3]).toBe("");
  });

  it("carries the timestamp through", () => {
    const row = mapCapturePayload({ ...base, capturedAt: "2026-01-15T08:30:00Z" });
    expect(row[0]).toBe("2026-01-15T08:30:00Z");
  });

  it("carries the Drive image URL through", () => {
    const url = "https://drive.google.com/file/d/xyz789";
    const row = mapCapturePayload({ ...base, driveImageUrl: url });
    expect(row[6]).toBe(url);
  });
});
