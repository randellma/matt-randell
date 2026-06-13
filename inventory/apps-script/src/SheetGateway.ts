/**
 * Appends a Capture row to the Inventory Sheet and embeds an inline CellImage thumbnail.
 *
 * Verified manually against live Google APIs — not unit tested (no pure logic).
 *
 * The Sheet ID is read from Script Properties at runtime:
 *   PropertiesService.getScriptProperties().getProperty("SHEET_ID")
 *
 * CellImage is used (not =IMAGE()) because:
 *   - Google has been breaking =IMAGE() with Drive URLs
 *   - =IMAGE() requires the photo to be publicly fetchable
 *   - CellImage embeds reliably while Drive originals stay private (ADR-0001)
 */

import type { RowValues } from "./CapturePayloadMapper.js";
import type { InventoryRow } from "./PendingDraftSelector.js";
import type { DraftValues } from "./ListingDraftMapper.js";

/**
 * Appends the row to the Sheet, replacing the null Photo slot with a CellImage.
 *
 * @param sheetId   - The Spreadsheet ID (from Script Properties)
 * @param row       - Row values from CapturePayloadMapper (photo slot is null)
 * @param photoBlob - The in-memory blob from the upload (avoids a redundant Drive fetch)
 */
export function appendCaptureRow(
  sheetId: string,
  row: RowValues,
  photoBlob: GoogleAppsScript.Base.Blob
): void {
  const sheets = SpreadsheetApp.openById(sheetId).getSheets();
  const sheet = sheets[0];
  if (!sheet) throw new Error("Inventory sheet not found at index 0");

  // Append non-image values first so we know the row number
  const values: (string | null)[] = [...row];
  values[1] = null; // placeholder; we'll write CellImage separately
  sheet.appendRow(values);
  SpreadsheetApp.flush(); // commit the append before reading the row index

  // Write CellImage into the Photo column (col B = 2) of the new last row
  const lastRow = sheet.getLastRow();
  // CellImage can't fetch private Drive URLs anonymously, so we embed as a base64 data URI.
  // Fallback MIME is a safety net in case the caller changes the blob type later.
  const mimeType = photoBlob.getContentType() ?? "image/jpeg";
  const b64 = Utilities.base64Encode(photoBlob.getBytes());
  const dataUri = `data:${mimeType};base64,${b64}`;
  const cellImage = SpreadsheetApp.newCellImage().setSourceUrl(dataUri).build();
  sheet.getRange(lastRow, 2).setValue(cellImage);
  sheet.setRowHeight(lastRow, 300);
}

/**
 * Reads all data rows from the Sheet as structured InventoryRow objects.
 *
 * Column layout:
 *   [0] Captured at  [1] Photo  [2] Name  [3] Disposition
 *   [4] Handled on   [5] Notes  [6] Drive image URL  [7] Listing draft (if present)
 *
 * Skips row 1 (header). Returns [] when there are no data rows.
 */
export function readInventoryRows(sheetId: string): InventoryRow[] {
  const sheet = SpreadsheetApp.openById(sheetId).getSheets()[0];
  if (!sheet) throw new Error("Inventory sheet not found at index 0");

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const lastCol = sheet.getLastColumn();
  if (lastCol < 1) return [];

  const values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues() as unknown[][];

  return values.map(row => ({
    capturedAt: String(row[0] ?? ""),
    name: String(row[2] ?? ""),
    disposition: String(row[3] ?? ""),
    handledOn: String(row[4] ?? ""),
    notes: String(row[5] ?? ""),
    driveImageUrl: String(row[6] ?? ""),
    hasDraft: row[7] !== undefined && row[7] !== null && String(row[7]).trim() !== "",
  }));
}

/**
 * Writes a Listing draft (price range, rationale, post template) into the row whose
 * Drive image URL (col G) matches itemRef.
 *
 * Writes to columns H, I, J (1-indexed: 8, 9, 10). Does not touch cols A–G.
 * Throws if no matching row is found.
 */
export function writeDraftCells(sheetId: string, itemRef: string, values: DraftValues): void {
  const sheet = SpreadsheetApp.openById(sheetId).getSheets()[0];
  if (!sheet) throw new Error("Inventory sheet not found at index 0");

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) throw new Error("No items found in sheet");

  const driveUrls = sheet.getRange(2, 7, lastRow - 1, 1).getValues() as string[][];
  const rowIndex = driveUrls.findIndex(r => r[0] === itemRef);
  if (rowIndex === -1) throw new Error(`No item found with itemRef: ${itemRef}`);

  const sheetRow = rowIndex + 2; // +1 for 1-index, +1 for header
  sheet.getRange(sheetRow, 8, 1, 3).setValues([[values[0], values[1], values[2]]]);
}

export function setDisposition(sheetId: string, capturedAt: string, disposition: string): void {
  const sheet = SpreadsheetApp.openById(sheetId).getSheets()[0];
  if (!sheet) throw new Error("Inventory sheet not found at index 0");
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) throw new Error(`No item found with capturedAt: ${capturedAt}`);
  const keys = sheet.getRange(2, 1, lastRow - 1, 1).getValues() as string[][];
  const rowIndex = keys.findIndex(r => r[0] === capturedAt);
  if (rowIndex === -1) throw new Error(`No item found with capturedAt: ${capturedAt}`);
  sheet.getRange(rowIndex + 2, 4).setValue(disposition);
}

export function markHandled(sheetId: string, capturedAt: string): void {
  const sheet = SpreadsheetApp.openById(sheetId).getSheets()[0];
  if (!sheet) throw new Error("Inventory sheet not found at index 0");
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) throw new Error(`No item found with capturedAt: ${capturedAt}`);
  const keys = sheet.getRange(2, 1, lastRow - 1, 1).getValues() as string[][];
  const rowIndex = keys.findIndex(r => r[0] === capturedAt);
  if (rowIndex === -1) throw new Error(`No item found with capturedAt: ${capturedAt}`);
  sheet.getRange(rowIndex + 2, 5).setValue(new Date().toISOString());
}

export function deleteItem(sheetId: string, capturedAt: string): void {
  const sheet = SpreadsheetApp.openById(sheetId).getSheets()[0];
  if (!sheet) throw new Error("Inventory sheet not found at index 0");
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) throw new Error(`No item found with capturedAt: ${capturedAt}`);
  const rows = sheet.getRange(2, 1, lastRow - 1, 7).getValues() as string[][];
  const rowIndex = rows.findIndex(r => r[0] === capturedAt);
  if (rowIndex === -1) throw new Error(`No item found with capturedAt: ${capturedAt}`);
  const driveImageUrl = rows[rowIndex][6];
  if (driveImageUrl) {
    try {
      const match = driveImageUrl.match(/\/d\/([^/]+)/);
      if (match) DriveApp.getFileById(match[1]).setTrashed(true);
    } catch {
      // Drive file already gone or inaccessible — continue to delete the row
    }
  }
  sheet.deleteRow(rowIndex + 2);
}

/**
 * Writes a Disposition dropdown validation to column D if not already present.
 * Call this once during setup, not on every Capture.
 */
export function ensureDispositionDropdown(sheetId: string): void {
  const sheets = SpreadsheetApp.openById(sheetId).getSheets();
  const sheet = sheets[0];
  if (!sheet) throw new Error("Inventory sheet not found at index 0");
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(["Sell", "Give away", "Donate"], true)
    .build();
  // Apply to D2:D (all data rows in the Disposition column)
  sheet.getRange("D2:D").setDataValidation(rule);
}
