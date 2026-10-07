import type { CookieOptions, Request } from 'express';
import type { ConfigService } from '@nestjs/config';
import type { AllConfigType } from '../config/config.type';
import { normalizeOrigin } from '../config/cors.util';

export const AUTH_ACCESS_COOKIE = 'akz_access_token';
export const AUTH_REFRESH_COOKIE = 'akz_refresh_token';
const AUTH_ACCESS_COOKIE_AKZENTE = 'akz_access_token_akzente';
const AUTH_REFRESH_COOKIE_AKZENTE = 'akz_refresh_token_akzente';
const AUTH_ACCESS_COOKIE_CLIENT = 'akz_access_token_client';
const AUTH_REFRESH_COOKIE_CLIENT = 'akz_refresh_token_client';
const AUTH_ACCESS_COOKIE_MERCHANDISER = 'akz_access_token_merchandiser';
const AUTH_REFRESH_COOKIE_MERCHANDISER = 'akz_refresh_token_merchandiser';

type AuthCookieType = 'access' | 'refresh';
export type AuthCookieScope =
  | 'default'
  | 'akzente'
  | 'client'
  | 'merchandiser';

const AUTH_COOKIE_SCOPES: readonly AuthCookieScope[] = [
  'default',
  'akzente',
  'client',
  'merchandiser',
] as const;

/** Used when inferring scope from cookies only (prefer app-specific scopes). */
const AUTH_COOKIE_SCOPES_DETECT_ORDER: readonly AuthCookieScope[] = [
  'merchandiser',
  'client',
  'akzente',
  'default',
] as const;

export const AUTH_SCOPE_HEADER = 'x-akzente-auth-scope';

export function getAuthCookieName(
  cookieType: AuthCookieType,
  scope: AuthCookieScope = 'default',
): string {
  if (cookieType === 'access') {
    if (scope === 'akzente') return AUTH_ACCESS_COOKIE_AKZENTE;
    if (scope === 'client') return AUTH_ACCESS_COOKIE_CLIENT;
    if (scope === 'merchandiser') return AUTH_ACCESS_COOKIE_MERCHANDISER;
    return AUTH_ACCESS_COOKIE;
  }

  if (scope === 'akzente') return AUTH_REFRESH_COOKIE_AKZENTE;
  if (scope === 'client') return AUTH_REFRESH_COOKIE_CLIENT;
  if (scope === 'merchandiser') return AUTH_REFRESH_COOKIE_MERCHANDISER;
  return AUTH_REFRESH_COOKIE;
}

export function getAuthCookieNames(
  cookieType: AuthCookieType,
  preferredScope?: AuthCookieScope,
): string[] {
  // When a scope is known (Origin, X-Akzente-Auth-Scope, etc.), never fall back to
  // another app's cookies — that caused HeadOffice sessions to appear in Merchandiser.
  if (preferredScope !== undefined) {
    return [getAuthCookieName(cookieType, preferredScope)];
  }

  return AUTH_COOKIE_SCOPES.map((scope) => getAuthCookieName(cookieType, scope));
}

export function extractTokenFromCookie(
  request: Request,
  cookieName: string,
): string | null {
  const cookieHeader = request?.headers?.cookie;
  if (!cookieHeader) {
    return null;
  }

  const cookies = cookieHeader.split(';');
  for (const cookie of cookies) {
    const [name, ...valueParts] = cookie.trim().split('=');
    if (name === cookieName) {
      return decodeURIComponent(valueParts.join('='));
    }
  }

  return null;
}

export function extractTokenFromCookieNames(
  request: Request,
  cookieNames: string[],
): string | null {
  for (const cookieName of cookieNames) {
    const token = extractTokenFromCookie(request, cookieName);
    if (token) {
      return token;
    }
  }

  return null;
}

function getConfiguredOrigin(
  configService: ConfigService<AllConfigType>,
  key:
    | 'app.frontendDomain'
    | 'app.clientFrontendDomain'
    | 'app.merchandiserFrontendDomain',
): string | null {
  const configured = configService.get(key, { infer: true });
  if (!configured) {
    return null;
  }

  return normalizeOrigin(configured);
}

function extractOriginFromReferer(
  referer?: string | string[],
): string | undefined {
  const raw = Array.isArray(referer) ? referer[0] : referer;
  if (!raw) {
    return undefined;
  }

  try {
    return new URL(raw).origin;
  } catch {
    return undefined;
  }
}

export function parseAuthScopeHeader(request: Request): AuthCookieScope | undefined {
  const raw =
    request.headers[AUTH_SCOPE_HEADER] ??
    request.headers['X-Akzente-Auth-Scope'];
  if (typeof raw !== 'string') {
    return undefined;
  }

  const normalized = raw.trim().toLowerCase();
  if (
    normalized === 'default' ||
    normalized === 'akzente' ||
    normalized === 'client' ||
    normalized === 'merchandiser'
  ) {
    return normalized;
  }

  return undefined;
}

export function resolveAuthCookieScope(
  configService: ConfigService<AllConfigType>,
  requestOrigin?: string,
): AuthCookieScope | undefined {
  if (!requestOrigin) {
    return undefined;
  }

  const normalizedRequestOrigin = normalizeOrigin(requestOrigin);
  if (!normalizedRequestOrigin) {
    return undefined;
  }

  const akzenteOrigin = getConfiguredOrigin(configService, 'app.frontendDomain');
  if (akzenteOrigin && normalizedRequestOrigin === akzenteOrigin) {
    return 'akzente';
  }

  const clientOrigin = getConfiguredOrigin(
    configService,
    'app.clientFrontendDomain',
  );
  if (clientOrigin && normalizedRequestOrigin === clientOrigin) {
    return 'client';
  }

  const merchandiserOrigin = getConfiguredOrigin(
    configService,
    'app.merchandiserFrontendDomain',
  );
  if (merchandiserOrigin && normalizedRequestOrigin === merchandiserOrigin) {
    return 'merchandiser';
  }

  return undefined;
}

export function getRequestOrigin(request: Request): string | undefined {
  const raw =
    request.headers.origin ?? extractOriginFromReferer(request.headers.referer);
  if (!raw) {
    return undefined;
  }

  return normalizeOrigin(raw) ?? undefined;
}

function userTypeIdToAuthScope(userTypeId?: number): AuthCookieScope | undefined {
  switch (userTypeId) {
    case 1:
      return 'akzente';
    case 2:
      return 'client';
    case 3:
      return 'merchandiser';
    default:
      return undefined;
  }
}

export function getFrontendDomainForAuthScope(
  configService: ConfigService<AllConfigType>,
  scope: AuthCookieScope,
): string {
  const defaultFrontend = configService.getOrThrow('app.frontendDomain', {
    infer: true,
  });

  switch (scope) {
    case 'merchandiser': {
      const md = configService.get('app.merchandiserFrontendDomain', {
        infer: true,
      });
      if (!md || md === defaultFrontend) {
        console.warn(
          `[Auth] MERCHANDISER_FRONTEND_DOMAIN is not set or equals FRONTEND_DOMAIN. Confirmation/password-reset emails for VM users will point to "${defaultFrontend}" instead of a dedicated VM portal. Set MERCHANDISER_FRONTEND_DOMAIN in your .env to fix this.`,
        );
      }
      return md || defaultFrontend;
    }
    case 'client': {
      const cd = configService.get('app.clientFrontendDomain', { infer: true });
      if (!cd || cd === defaultFrontend) {
        console.warn(
          `[Auth] CLIENT_FRONTEND_DOMAIN is not set or equals FRONTEND_DOMAIN. Set CLIENT_FRONTEND_DOMAIN in your .env to fix this.`,
        );
      }
      return cd || defaultFrontend;
    }
    case 'akzente':
    case 'default':
    default:
      return defaultFrontend;
  }
}

/** Picks the frontend base URL for password-reset emails (no trailing slash). */
export function resolvePasswordResetFrontendDomain(
  configService: ConfigService<AllConfigType>,
  options: {
    userTypeId?: number;
    requestOrigin?: string;
    authScope?: AuthCookieScope;
  },
): string {
  const scopeFromUserType = userTypeIdToAuthScope(options.userTypeId);
  const scopeFromHeader =
    options.authScope && options.authScope !== 'default'
      ? options.authScope
      : undefined;
  const scopeFromOrigin = options.requestOrigin
    ? resolveAuthCookieScope(configService, options.requestOrigin)
    : undefined;

  const preferredScope =
    scopeFromHeader && scopeFromUserType && scopeFromHeader === scopeFromUserType
      ? scopeFromHeader
      : scopeFromOrigin && scopeFromUserType && scopeFromOrigin === scopeFromUserType
        ? scopeFromOrigin
        : scopeFromUserType ?? scopeFromHeader ?? scopeFromOrigin;

  if (preferredScope) {
    return getFrontendDomainForAuthScope(configService, preferredScope);
  }

  return configService.getOrThrow('app.frontendDomain', { infer: true });
}

export function detectAuthCookieScopeFromRequest(request: Request): AuthCookieScope {
  for (const scope of AUTH_COOKIE_SCOPES_DETECT_ORDER) {
    const refreshCookieName = getAuthCookieName('refresh', scope);
    if (extractTokenFromCookie(request, refreshCookieName)) {
      return scope;
    }
  }

  for (const scope of AUTH_COOKIE_SCOPES_DETECT_ORDER) {
    const accessCookieName = getAuthCookieName('access', scope);
    if (extractTokenFromCookie(request, accessCookieName)) {
      return scope;
    }
  }

  return 'default';
}

export function resolveAuthCookieScopeForRequest(
  configService: ConfigService<AllConfigType>,
  request: Request,
): AuthCookieScope {
  const requestOrigin =
    request.headers.origin ?? extractOriginFromReferer(request.headers.referer);

  const scopeFromHeader = parseAuthScopeHeader(request);
  if (scopeFromHeader) {
    return scopeFromHeader;
  }

  const scopeFromOrigin = resolveAuthCookieScope(configService, requestOrigin);
  if (scopeFromOrigin) {
    return scopeFromOrigin;
  }

  return detectAuthCookieScopeFromRequest(request);
}

function isLocalDevOrigin(origin?: string): boolean {
  if (!origin) {
    return false;
  }

  try {
    const { protocol, hostname } = new URL(origin);
    return (
      (protocol === 'http:' || protocol === 'https:') &&
      (hostname === 'localhost' || hostname === '127.0.0.1')
    );
  } catch {
    return false;
  }
}

function getApiOrigin(
  configService: ConfigService<AllConfigType>,
): string | null {
  const backendDomain = configService.get('app.backendDomain', { infer: true });
  if (!backendDomain) {
    return null;
  }

  try {
    return new URL(backendDomain).origin;
  } catch {
    return null;
  }
}

function isCrossOriginRequest(
  requestOrigin: string | undefined,
  apiOrigin: string | null,
): boolean {
  if (!requestOrigin || !apiOrigin) {
    return false;
  }

  try {
    return new URL(requestOrigin).origin !== apiOrigin;
  } catch {
    return false;
  }
}

function shouldUseSecureCookies(
  configService: ConfigService<AllConfigType>,
): boolean {
  // Explicit opt-in for an IP-only HTTP deployment. HTTPS keeps the secure default.
  if (process.env.AUTH_COOKIE_SECURE === 'false') {
    return false;
  }
  const nodeEnv = configService.get('app.nodeEnv', { infer: true });
  if (nodeEnv === 'production') {
    return true;
  }

  const backendDomain = configService.get('app.backendDomain', { infer: true });
  if (!backendDomain) {
    return false;
  }

  try {
    return new URL(backendDomain).protocol === 'https:';
  } catch {
    return false;
  }
}

function resolveAuthCookieSameSite(
  secure: boolean,
  requestOrigin: string | undefined,
  apiOrigin: string | null,
): CookieOptions['sameSite'] {
  if (!secure) {
    return 'lax';
  }

  // Credentialed cross-origin XHR (e.g. localhost -> api.example.com) requires SameSite=None.
  if (isLocalDevOrigin(requestOrigin) || isCrossOriginRequest(requestOrigin, apiOrigin)) {
    return 'none';
  }

  return 'lax';
}

export function buildAuthCookieOptions(
  configService: ConfigService<AllConfigType>,
  token: string,
  cookieType: AuthCookieType,
  requestOrigin?: string,
): CookieOptions {
  const expiresAt = getJwtExpiryMs(token);
  const secure = shouldUseSecureCookies(configService);
  const apiOrigin = getApiOrigin(configService);

  return {
    httpOnly: true,
    sameSite: resolveAuthCookieSameSite(secure, requestOrigin, apiOrigin),
    secure,
    path: getAuthCookiePath(configService, cookieType),
    ...(expiresAt && expiresAt > Date.now()
      ? { maxAge: expiresAt - Date.now() }
      : {}),
  };
}

export function buildClearAuthCookieOptions(
  configService: ConfigService<AllConfigType>,
  cookieType: AuthCookieType,
  requestOrigin?: string,
): CookieOptions {
  const secure = shouldUseSecureCookies(configService);
  const apiOrigin = getApiOrigin(configService);

  return {
    httpOnly: true,
    sameSite: resolveAuthCookieSameSite(secure, requestOrigin, apiOrigin),
    secure,
    path: getAuthCookiePath(configService, cookieType),
  };
}

function getAuthCookiePath(
  configService: ConfigService<AllConfigType>,
  cookieType: AuthCookieType,
): string {
  const apiPrefix = normalizeCookiePath(
    configService.getOrThrow('app.apiPrefix', { infer: true }),
  );

  if (cookieType === 'refresh') {
    return `${apiPrefix}/v1/auth`;
  }

  return apiPrefix;
}

function normalizeCookiePath(prefix: string): string {
  const sanitizedPrefix = prefix.trim().replace(/^\/+|\/+$/g, '');
  return sanitizedPrefix === '' ? '/' : `/${sanitizedPrefix}`;
}

function getJwtExpiryMs(token: string): number | null {
  const [, payloadPart] = token.split('.');
  if (!payloadPart) {
    return null;
  }

  try {
    const normalized = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      '=',
    );
    const payload = JSON.parse(
      Buffer.from(padded, 'base64').toString('utf-8'),
    ) as { exp?: number };

    return payload.exp ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}
