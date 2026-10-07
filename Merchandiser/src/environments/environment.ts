import { env } from './.env';

export const environment = {
  production: false,
  version: env['npm_package_version'] + '-dev',
  defaultLanguage: 'de-DE',
  supportedLanguages: ['de-DE', 'en-US'],
  apiUrl: 'http://localhost:3000/api/v1',
  // apiUrl: 'https://api.akzente.group/api/v1',
  settings: {
    auth: {
      cookieScope: 'merchandiser',
      // keys to store tokens at local storage
      accessTokenKey: 'DoPS3ZrQjM',
      refreshTokenKey: 'nmlP8PW2nb',
      tokenExpiresKey: 'tE5pK9yN1m',
    },
  },
  mapboxToken: env['MAPBOX_PUBLIC_TOKEN'] || '',
};
