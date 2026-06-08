/**
 * Fetches a Drive thumbnail and returns it as a base64 string.
 *
 * Verified manually against live Google APIs — not unit tested (no pure logic).
 * Keeps Drive originals private; the thumbnail is served only through the
 * authenticated all-items endpoint (ADR-0001, ADR-0004).
 */

/**
 * @param driveUrl - The Drive view URL stored in the sheet (col G)
 * @returns Base64-encoded thumbnail bytes, or empty string if fetch fails
 */
export function fetchDriveThumbnail(driveUrl: string): string {
  const match = driveUrl.match(/\/d\/([^/]+)/);
  if (!match || !match[1]) return "";
  const fileId = match[1];
  const thumbnail = DriveApp.getFileById(fileId).getThumbnail();
  return Utilities.base64Encode(thumbnail.getBytes());
}
