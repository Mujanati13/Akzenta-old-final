import type { ConfigService } from '@nestjs/config';
import type { AllConfigType } from './config.type';

export function normalizeOrigin(origin: string): string | null {
  try {
    return new URL(origin).origin;
  } catch {
    return null;
  }
}

export function isLocalDevOrigin(origin: string): boolean {
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

function parseCsvOrigins(value?: string): string[] {
  if (!value?.trim()) {
    return [];
  }

  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function deriveTrustedHostSuffix(backendDomain?: string): string | undefined {
  if (!backendDomain) {
    return undefined;
  }

  try {
    const { hostname } = new URL(backendDomain);
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return undefined;
    }

    const parts = hostname.split('.');
    if (parts.length < 2) {
      return undefined;
    }

    return `.${parts.slice(-2).join('.')}`;
  } catch {
    return undefined;
  }
}

function matchesTrustedHostSuffix(
  origin: string,
  suffix: string | undefined,
): boolean {
  if (!suffix?.startsWith('.')) {
    return false;
  }

  try {
    const { hostname } = new URL(origin);
    const bareSuffix = suffix.slice(1);
    return hostname === bareSuffix || hostname.endsWith(suffix);
  } catch {
    return false;
  }
}

export function getTrustedFrontendOrigins(
  configService: ConfigService<AllConfigType>,
): string[] {
  const explicitDomains = [
    configService.get('app.frontendDomain', { infer: true }),
    configService.get('app.merchandiserFrontendDomain', { infer: true }),
    configService.get('app.clientFrontendDomain', { infer: true }),
    ...parseCsvOrigins(
      configService.get('app.corsAllowedOrigins', { infer: true }),
    ),
  ];

  return explicitDomains
    .map((domain) => (domain ? normalizeOrigin(domain) : null))
    .filter((origin): origin is string => !!origin);
}

export function getTrustedHostSuffix(
  configService: ConfigService<AllConfigType>,
): string | undefined {
  const configured = configService.get('app.corsTrustedHostSuffix', {
    infer: true,
  });
  if (configured?.trim()) {
    return configured.trim().startsWith('.')
      ? configured.trim()
      : `.${configured.trim()}`;
  }

  return deriveTrustedHostSuffix(
    configService.get('app.backendDomain', { infer: true }),
  );
}

export function isTrustedFrontendOrigin(
  origin: string,
  configService: ConfigService<AllConfigType>,
): boolean {
  const normalizedOrigin = normalizeOrigin(origin);
  if (!normalizedOrigin) {
    return false;
  }

  const production = configService.get('app.nodeEnv', { infer: true }) === 'production';
  if (!production && isLocalDevOrigin(normalizedOrigin)) {
    return true;
  }

  if (getTrustedFrontendOrigins(configService).includes(normalizedOrigin)) {
    return true;
  }

  return !production && matchesTrustedHostSuffix(
    normalizedOrigin,
    getTrustedHostSuffix(configService),
  );
}
