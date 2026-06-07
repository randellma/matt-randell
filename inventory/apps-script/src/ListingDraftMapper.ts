/**
 * Maps an agent-produced Listing draft to the cell values for the draft columns.
 *
 * Column order for the three draft columns (written by SheetGateway.writeDraftCells):
 *   [0] → col H  Price range
 *   [1] → col I  Rationale
 *   [2] → col J  Post template
 */

export interface DraftPayload {
  priceRange: string;
  rationale: string;
  postTemplate: string;
}

export type DraftValues = [priceRange: string, rationale: string, postTemplate: string];

export function mapListingDraft(payload: DraftPayload): DraftValues {
  return [payload.priceRange, payload.rationale, payload.postTemplate];
}
