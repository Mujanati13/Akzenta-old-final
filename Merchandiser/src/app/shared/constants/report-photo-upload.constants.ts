/** Client-side limit before upload (matches backend guidance). */
export const REPORT_PHOTO_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

export const REPORT_PHOTO_MAX_FILE_SIZE_LABEL = '10 MB';

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Gallery / edit view order: section → before/after → slot order. */
export function sortUploadedAdvancedPhotos(photos: any[]): any[] {
  return [...(photos || [])].sort((a, b) => {
    const sectionA = Number(a?.advancedPhoto?.id) || 0;
    const sectionB = Number(b?.advancedPhoto?.id) || 0;
    if (sectionA !== sectionB) {
      return sectionA - sectionB;
    }

    const sideA = a?.beforeAfterType === 'before' ? 0 : 1;
    const sideB = b?.beforeAfterType === 'before' ? 0 : 1;
    if (sideA !== sideB) {
      return sideA - sideB;
    }

    return (Number(a?.order) || 0) - (Number(b?.order) || 0);
  });
}
