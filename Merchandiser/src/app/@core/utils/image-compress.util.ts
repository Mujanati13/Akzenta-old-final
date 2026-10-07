const MAX_DIMENSION = 1600;
const INITIAL_JPEG_QUALITY = 0.78;
const MIN_JPEG_QUALITY = 0.52;
const SKIP_BELOW_BYTES = 120_000;
/** Target size after compression — keeps uploads fast on mobile networks. */
const TARGET_MAX_BYTES = 1_200_000;

function canvasToJpegFile(canvas: HTMLCanvasElement, baseName: string, quality: number): Promise<File | null> {
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          resolve(null);
          return;
        }
        resolve(new File([blob], `${baseName}.jpg`, { type: 'image/jpeg', lastModified: Date.now() }));
      },
      'image/jpeg',
      quality,
    );
  });
}

/**
 * Resize large photos in the browser so report saves upload faster and stay within limits.
 */
export async function compressImageForUpload(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif' || file.type === 'image/svg+xml') {
    return file;
  }

  if (file.size <= SKIP_BELOW_BYTES) {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close();
      return file;
    }

    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const baseName = file.name.replace(/\.[^/.]+$/, '') || 'photo';
    let quality = INITIAL_JPEG_QUALITY;
    let best: File | null = null;

    while (quality >= MIN_JPEG_QUALITY) {
      const candidate = await canvasToJpegFile(canvas, baseName, quality);
      if (!candidate) {
        break;
      }

      if (!best || candidate.size < best.size) {
        best = candidate;
      }

      if (candidate.size <= TARGET_MAX_BYTES) {
        return candidate.size < file.size ? candidate : file;
      }

      quality -= 0.08;
    }

    if (best && best.size < file.size) {
      return best;
    }

    return file;
  } catch {
    return file;
  }
}
