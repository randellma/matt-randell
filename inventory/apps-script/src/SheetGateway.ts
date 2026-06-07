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
