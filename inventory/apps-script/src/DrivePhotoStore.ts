/**
 * Saves photo bytes to the private Drive folder and returns the file metadata.
 *
 * Verified manually against live Google APIs — not unit tested (no pure logic).
 *
 * The Drive folder ID is read from Script Properties at runtime:
 *   PropertiesService.getScriptProperties().getProperty("DRIVE_FOLDER_ID")
 */

export interface PhotoResult {
  fileId: string;
  url: string;
}

/**
 * @param photoBlob  - The photo as a GoogleAppsScript.Base.Blob
 * @param folderId   - Drive folder ID (from Script Properties)
 * @returns          - File ID and the Drive view URL
 */
export function savePhoto(
  photoBlob: GoogleAppsScript.Base.Blob,
  folderId: string
): PhotoResult {
  const folder = DriveApp.getFolderById(folderId);
  const file = folder.createFile(photoBlob);
  // Keep private: do NOT call file.setSharing(DriveApp.Access.ANYONE, ...)
  return {
    fileId: file.getId(),
    url: file.getUrl(),
  };
}
