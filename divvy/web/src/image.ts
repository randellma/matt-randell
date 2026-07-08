/**
 * Re-encode a photo as a reasonably-sized JPEG before upload. Keeps uploads
 * fast on cell connections and guarantees a media type the OCR model accepts
 * (iPhones hand us HEIC otherwise). Falls back to the original file if the
 * browser can't decode it.
 */
/**
 * Center-crop a photo to a small square JPEG for an avatar. In the app,
 * avatars render at 44px and below, but a group's avatar is also drawn at
 * ~300px on the link-preview card (og/card.js), so 512px keeps that sharp
 * while still keeping uploads small. Falls back to the original file if the
 * browser can't decode it.
 */
export async function prepareAvatarImage(file: File, edge = 512): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const crop = Math.min(bitmap.width, bitmap.height);
    const sx = Math.round((bitmap.width - crop) / 2);
    const sy = Math.round((bitmap.height - crop) / 2);
    const size = Math.min(edge, crop);

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    canvas.getContext('2d')!.drawImage(bitmap, sx, sy, crop, crop, 0, 0, size, size);
    bitmap.close();

    const blob = await new Promise<Blob | null>(resolve =>
      canvas.toBlob(resolve, 'image/jpeg', 0.85),
    );
    if (blob) return blob;
  } catch {
    // fall through to original
  }
  return file;
}

export async function prepareReceiptImage(file: File, maxEdge = 1800): Promise<Blob> {
  // PDFs (emailed receipts) can't be rasterized here and the OCR model reads
  // them natively — upload as-is.
  if (file.type === 'application/pdf') return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();

    const blob = await new Promise<Blob | null>(resolve =>
      canvas.toBlob(resolve, 'image/jpeg', 0.85),
    );
    if (blob) return blob;
  } catch {
    // fall through to original
  }
  return file;
}
