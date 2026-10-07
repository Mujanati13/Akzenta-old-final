/** Routes reachable without an authenticated session (password reset, login, etc.). */
export const PUBLIC_AUTH_ROUTE_PATHS = ['/login', '/forgot-password', '/password-change', '/logout'] as const;

export function getCurrentPath(): string {
  if (typeof window !== 'undefined' && window.location?.pathname) {
    return window.location.pathname;
  }
  return '';
}

export function isPublicAuthRoute(url?: string): boolean {
  const path = (url ?? getCurrentPath()).split('?')[0].split('#')[0].replace(/\/+$/, '') || '/';

  return PUBLIC_AUTH_ROUTE_PATHS.some((route) => path === route || path.endsWith(route));
}
