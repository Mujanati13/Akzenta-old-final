/** Maximum client company logo upload size (3 MB). */
export const CLIENT_LOGO_MAX_FILE_SIZE_BYTES = 3 * 1024 * 1024;

export const CLIENT_LOGO_MAX_FILE_SIZE_LABEL = '3 MB';

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getLogoFileTooLargeMessage(fileSizeBytes: number): string {
  return `Das Logo darf maximal ${CLIENT_LOGO_MAX_FILE_SIZE_LABEL} groß sein. Ihre Datei ist ${formatFileSize(fileSizeBytes)}.`;
}
