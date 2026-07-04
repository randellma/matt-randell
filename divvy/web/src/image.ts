/**
 * Re-encode a photo as a reasonably-sized JPEG before upload. Keeps uploads
 * fast on cell connections and guarantees a media type the OCR model accepts
 * (iPhones hand us HEIC otherwise). Falls back to the original file if the
 * browser can't decode it.
 */
export async function prepareReceiptImage(file: File, maxEdge = 1800): Promise<Blob> {
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
