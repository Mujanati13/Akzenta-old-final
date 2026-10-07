import { Session } from '../session/domain/session';

/**
 * Resolves the timestamp used for inactivity-based session expiry.
 */
export function resolveSessionActivityAt(
  session: Pick<Session, 'lastActivityAt' | 'updatedAt' | 'createdAt'>,
): unknown {
  return session.lastActivityAt ?? session.updatedAt ?? session.createdAt;
}

/**
 * Parses session activity timestamps from DB/domain values into epoch milliseconds (UTC).
 */
export function parseSessionCreatedAtMs(sessionCreatedAt: unknown): number | null {
  if (sessionCreatedAt instanceof Date) {
    const time = sessionCreatedAt.getTime();
    return Number.isFinite(time) ? time : null;
  }

  const raw = String(sessionCreatedAt ?? '').trim();
  if (!raw) {
    return null;
  }

  const isoParsed = new Date(raw).getTime();
  if (Number.isFinite(isoParsed) && /[zZ]|[+-]\d{2}:?\d{2}$/.test(raw)) {
    return isoParsed;
  }

  if (Number.isFinite(isoParsed) && raw.includes('T')) {
    return isoParsed;
  }

  // timestamp without time zone from PostgreSQL — treat as UTC
  const normalizedRaw = raw.includes('T') ? raw : raw.replace(' ', 'T');
  const utcParsed = new Date(`${normalizedRaw}Z`).getTime();
  if (Number.isFinite(utcParsed)) {
    return utcParsed;
  }

  if (Number.isFinite(isoParsed)) {
    return isoParsed;
  }

  return null;
}

export function getSessionAgeMs(
  sessionCreatedAt: unknown,
  nowMs: number = Date.now(),
): number {
  const createdAtMs = parseSessionCreatedAtMs(sessionCreatedAt);
  if (createdAtMs == null) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.max(0, nowMs - createdAtMs);
}

export function isSessionExpired(
  sessionCreatedAt: unknown,
  maxSessionAgeMs: number,
  nowMs: number = Date.now(),
): boolean {
  return getSessionAgeMs(sessionCreatedAt, nowMs) >= maxSessionAgeMs;
}

export function getRemainingSessionMs(
  sessionCreatedAt: unknown,
  maxSessionAgeMs: number,
  nowMs: number = Date.now(),
): number {
  return Math.max(0, maxSessionAgeMs - getSessionAgeMs(sessionCreatedAt, nowMs));
}
