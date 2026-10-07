/** Maximum profile image upload size (30 MB). */
export const PROFILE_IMAGE_MAX_FILE_SIZE_BYTES = 30 * 1024 * 1024;

export const PROFILE_IMAGE_MAX_FILE_SIZE_LABEL = '30 MB';

/** Maximum profile document upload size (30 MB). */
export const PROFILE_DOCUMENT_MAX_FILE_SIZE_BYTES = 30 * 1024 * 1024;

export const PROFILE_DOCUMENT_MAX_FILE_SIZE_LABEL = '30 MB';

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getProfileFileTooLargeMessage(fileSizeBytes: number, maxLabel: string): string {
  return `Die Datei darf maximal ${maxLabel} groß sein. Ihre Datei ist ${formatFileSize(fileSizeBytes)}.`;
}
