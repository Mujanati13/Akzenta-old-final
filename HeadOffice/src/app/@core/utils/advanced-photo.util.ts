export interface AdvancedPhotoConfig {
  labels?: string[] | null;
  isVisibleInReport?: boolean | null;
  isBeforeAfter?: boolean | null;
  beforeImageCount?: number | null;
  afterImageCount?: number | null;
}

export interface PhotoNamingContext {
  imageNamePattern?: string | null;
  clientName?: string;
  projectName?: string;
  branchName?: string;
  reportDate?: string;
}

/** Slot count shown when unlimited is configured. */
export const UNLIMITED_PHOTO_SLOT_COUNT = 20;

const NAMING_TOKEN_MAP: Record<string, keyof PhotoNamingContext | 'type' | 'index'> = {
  customer: 'clientName',
  kunde: 'clientName',
  project: 'projectName',
  projekt: 'projectName',
  branch: 'branchName',
  filiale: 'branchName',
  date: 'reportDate',
  datum: 'reportDate',
  type: 'type',
  index: 'index',
};

/** One upload slot per configured description (empty fields become Bezeichnung N). */
export function resolveAdvancedPhotoLabels(photo: AdvancedPhotoConfig | null | undefined): string[] {
  const raw = Array.isArray(photo?.labels) ? photo.labels : [];

  if (raw.length === 0) {
    return ['Bezeichnung 1'];
  }

  return raw.map((label, index) => {
    const trimmed = String(label ?? '').trim();
    return trimmed || `Bezeichnung ${index + 1}`;
  });
}

export function getAdvancedPhotoUploadSlotCount(photo: AdvancedPhotoConfig | null | undefined): number {
  return resolveAdvancedPhotoLabels(photo).length;
}

export function isAdvancedPhotoVisible(photo: AdvancedPhotoConfig | null | undefined): boolean {
  return photo?.isVisibleInReport !== false;
}

function hasConfiguredCount(value: number | null | undefined): boolean {
  return value !== null && value !== undefined;
}

function legacySlotCount(photo: AdvancedPhotoConfig | null | undefined): number {
  return Math.max(1, getAdvancedPhotoUploadSlotCount(photo));
}

export function resolvePhotoSlotCount(photo: AdvancedPhotoConfig | null | undefined, type: 'before' | 'after'): number {
  if (!photo) {
    return type === 'before' ? 0 : 1;
  }

  const configuredCount = type === 'before' ? photo.beforeImageCount : photo.afterImageCount;

  if (hasConfiguredCount(configuredCount)) {
    return Math.max(0, configuredCount as number);
  }

  if (configuredCount === null) {
    if (type === 'before' && photo.isBeforeAfter !== true) {
      return 0;
    }
    return UNLIMITED_PHOTO_SLOT_COUNT;
  }

  if (type === 'before') {
    return photo.isBeforeAfter === true ? legacySlotCount(photo) : 0;
  }

  return legacySlotCount(photo);
}

export function buildPhotoLabelFromPattern(pattern: string, type: 'before' | 'after', index: number, context: PhotoNamingContext = {}): string {
  const typeToken = type === 'before' ? 'Before' : 'After';
  const replacements: Record<string, string> = {
    customer: sanitizeNamePart(context.clientName),
    kunde: sanitizeNamePart(context.clientName),
    project: sanitizeNamePart(context.projectName),
    projekt: sanitizeNamePart(context.projectName),
    branch: sanitizeNamePart(context.branchName),
    filiale: sanitizeNamePart(context.branchName),
    date: sanitizeNamePart(context.reportDate),
    datum: sanitizeNamePart(context.reportDate),
    type: typeToken,
    index: String(index),
  };

  let result = pattern.trim();
  result = result.replace(/\{([^}]+)\}/gi, (_, token: string) => {
    const key = token.trim().toLowerCase();
    if (key in replacements) {
      return replacements[key];
    }
    const mapped = NAMING_TOKEN_MAP[key];
    if (mapped && mapped !== 'type' && mapped !== 'index' && context[mapped]) {
      return sanitizeNamePart(String(context[mapped]));
    }
    return token;
  });

  if (!/\{type\}|\{index\}/i.test(pattern) && !/_before\d*$/i.test(result) && !/_after\d*$/i.test(result)) {
    result = `${result}_${typeToken}${index}`;
  }

  return result;
}

function sanitizeNamePart(value?: string | null): string {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_-]/g, '');
}

function buildDefaultLabel(type: 'before' | 'after', index: number): string {
  return type === 'before' ? `Vorher ${index}` : `Nachher ${index}`;
}

export function resolvePhotoLabelsForType(photo: AdvancedPhotoConfig | null | undefined, type: 'before' | 'after', namingContext?: PhotoNamingContext): string[] {
  const count = resolvePhotoSlotCount(photo, type);
  if (count <= 0) {
    return [];
  }

  const pattern = namingContext?.imageNamePattern?.trim();
  if (pattern) {
    return Array.from({ length: count }, (_, index) => buildPhotoLabelFromPattern(pattern, type, index + 1, namingContext));
  }

  const labels = resolveAdvancedPhotoLabels(photo);
  if (photo?.isBeforeAfter === true) {
    return Array.from({ length: count }, (_, index) => labels[index] || buildDefaultLabel(type, index + 1));
  }

  return labels.slice(0, count);
}

/** Map form description fields to persisted labels (keeps every added slot). */
export function mapPhotoDescriptionLabels(descriptions: string[]): string[] {
  return (descriptions || []).map((label, index) => {
    const trimmed = String(label ?? '').trim();
    return trimmed || `Bezeichnung ${index + 1}`;
  });
}

export function buildPersistedPhotoLabels(descriptions: string[], isBeforeAfter: boolean, beforeCount: number | null, afterCount: number | null, imageNamePattern?: string | null): string[] {
  if (imageNamePattern?.trim()) {
    const namingContext: PhotoNamingContext = { imageNamePattern };
    const beforeLabels =
      isBeforeAfter && (beforeCount === null || (beforeCount ?? 0) > 0) ? resolvePhotoLabelsForType({ isBeforeAfter: true, beforeImageCount: beforeCount, labels: [] }, 'before', namingContext) : [];
    const afterLabels = resolvePhotoLabelsForType({ isBeforeAfter, afterImageCount: afterCount, labels: [] }, 'after', namingContext);
    const combined = [...beforeLabels, ...afterLabels];
    return combined.length > 0 ? combined : ['Foto'];
  }

  const mapped = mapPhotoDescriptionLabels(descriptions);
  return mapped.length > 0 ? mapped : ['Foto'];
}
