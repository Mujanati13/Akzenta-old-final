import { env } from './.env';

export const environment = {
  production: true,
  version: env['npm_package_version'],
  defaultLanguage: 'de-DE',
  supportedLanguages: ['de-DE', 'en-US'],
  apiUrl: '/api/v1', // Same-origin API through the production reverse proxy
  settings: {
    auth: {
      cookieScope: 'client',
      // keys to store tokens at local storage
      accessTokenKey: 'DoPS3ZrQjM',
      refreshTokenKey: 'nmlP8PW2nb',
      tokenExpiresKey: 'tE5pK9yN1m',
    },
  },
  mapboxToken: env['MAPBOX_PUBLIC_TOKEN'] || '',
};
