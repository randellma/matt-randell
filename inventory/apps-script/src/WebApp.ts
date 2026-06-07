/**
 * Apps Script web app entry point.
 *
 * Routes:
 *   POST /  → Capture endpoint
 *
 * Deploy via Apps Script editor → Deploy → New deployment → Web app.
 * Set "Execute as: Me" and "Who has access: Anyone" (auth is the shared secret).
 *
 * Script Properties required (set via Project Settings → Script Properties):
 *   SECRET          — shared secret guarding the endpoint
 *   SHEET_ID        — Spreadsheet ID of the Inventory Sheet
 *   DRIVE_FOLDER_ID — Drive folder ID for private photo originals
 */

import { authenticate } from "./RequestAuthenticator.js";
import { mapCapturePayload } from "./CapturePayloadMapper.js";
import { savePhoto } from "./DrivePhotoStore.js";
import { appendCaptureRow } from "./SheetGateway.js";
import type { Disposition } from "./CapturePayloadMapper.js";

const VALID_DISPOSITIONS: ReadonlySet<string> = new Set(["Sell", "Give away", "Donate", "Junk"]);

// Note: Apps Script always returns HTTP 200; `status` is body-only, not the HTTP status code.
// Clients must inspect the JSON body's `status` or `error` fields to detect failures.
function json(data: unknown, status = 200): GoogleAppsScript.Content.TextOutput {
  return ContentService.createTextOutput(JSON.stringify({ status, ...Object(data) }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e: GoogleAppsScript.Events.DoPost): GoogleAppsScript.Content.TextOutput {
  const props = PropertiesService.getScriptProperties();
  const secret = props.getProperty("SECRET") ?? "";
  const sheetId = props.getProperty("SHEET_ID") ?? "";
  const folderId = props.getProperty("DRIVE_FOLDER_ID") ?? "";

  // Parse body — the iOS Shortcut sends JSON
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(e.postData.contents) as Record<string, unknown>;
  } catch {
    return json({ error: "invalid JSON" }, 400);
  }

  // Authenticate
  if (!authenticate(body, secret)) {
    return json({ error: "unauthorized" }, 401);
  }

  // Guard misconfigured deployment (empty IDs throw uncaught exceptions in Drive/Sheets)
  if (!sheetId || !folderId) {
    return json({ error: "server misconfigured" }, 500);
  }

  // Validate required fields
  const name = body["name"];
  const capturedAt = body["capturedAt"];
  const photoBase64 = body["photo"];

  if (
    typeof name !== "string" ||
    typeof capturedAt !== "string" ||
    typeof photoBase64 !== "string"
  ) {
    return json({ error: "missing required fields: name, capturedAt, photo" }, 400);
  }

  // Validate optional disposition before casting
  // Empty string is treated as "no disposition" (same as omitting the field)
  const rawDisposition = body["disposition"];
  if (rawDisposition !== undefined && rawDisposition !== "" && (typeof rawDisposition !== "string" || !VALID_DISPOSITIONS.has(rawDisposition))) {
    return json({ error: "invalid disposition" }, 400);
  }
  const disposition = (rawDisposition === "" ? undefined : rawDisposition) as Disposition | undefined;

  // Decode photo — Capture is JPEG-only; name carries through to the Drive filename
  let photoBytes: number[];
  try {
    photoBytes = Utilities.base64Decode(photoBase64);
  } catch {
    return json({ error: "invalid photo encoding" }, 400);
  }
  const photoBlob = Utilities.newBlob(photoBytes, "image/jpeg", `${name}.jpg`);
  const { url: driveImageUrl } = savePhoto(photoBlob, folderId);

  // Build row values and append to Sheet
  const row = mapCapturePayload({ name, capturedAt, driveImageUrl, disposition });
  appendCaptureRow(sheetId, row, photoBlob);

  return json({ ok: true });
}

function doGet(): GoogleAppsScript.Content.TextOutput {
  return json({ ok: true, service: "inventory" });
}

// Expose as Apps Script globals (prevents rollup tree-shaking)
(globalThis as unknown as Record<string, unknown>)["doPost"] = doPost;
(globalThis as unknown as Record<string, unknown>)["doGet"] = doGet;
