/**
 * Maps a Capture payload to the ordered set of row values appended to the Sheet.
 *
 * Column order matches the Sheet schema:
 *   [0] Captured at   — ISO timestamp
 *   [1] Photo         — null here; SheetGateway replaces it with a CellImage
 *   [2] Name
 *   [3] Disposition   — "Sell" | "Give away" | "Donate" | "Junk" | ""
 *   [4] Handled on    — blank at Capture time
 *   [5] Notes         — blank at Capture time
 *   [6] Drive image URL — kept so the listing routine can fetch the photo
 */

export type Disposition = "Sell" | "Give away" | "Donate" | "Junk" | "Store";

export interface CapturePayload {
  name: string;
  capturedAt: string;
  driveImageUrl: string;
  disposition?: Disposition;
}

/** Null marks the Photo slot — SheetGateway will embed the CellImage there. */
export type RowValues = [
  capturedAt: string,
  photo: null,
  name: string,
  disposition: string,
  handledOn: string,
  notes: string,
  driveImageUrl: string
];

export function mapCapturePayload(payload: CapturePayload): RowValues {
  return [
    payload.capturedAt,
    null,
    payload.name,
    payload.disposition ?? "",
    "",
    "",
    payload.driveImageUrl,
  ];
}
