import { Injectable } from '@angular/core';
import { environment } from '@env/environment';

@Injectable({
  providedIn: 'root',
})
export class TokenStorageService {
  private readonly ACCESS_TOKEN_KEY = environment.settings.auth.accessTokenKey;
  private readonly REFRESH_TOKEN_KEY = environment.settings.auth.refreshTokenKey;
  private readonly TOKEN_EXPIRES_KEY = environment.settings.auth.tokenExpiresKey;
  private readonly LEGACY_AUTH_KEYS = ['token', 'refreshToken', 'tokenExpires', 'credentials', 'id', 'returnUrl'];
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private tokenExpires: number | null = null;

  constructor() {
    this.clearLegacyBrowserStorageTokens();
  }

  setAccessToken(token: string): void {
    this.accessToken = token;
  }

  setRefreshToken(token: string): void {
    this.refreshToken = token;
  }

  setTokenExpires(expiresAt: number): void {
    this.tokenExpires = expiresAt;
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  getRefreshToken(): string | null {
    return this.refreshToken;
  }

  getTokenExpires(): number | null {
    return this.tokenExpires;
  }

  isTokenExpired(): boolean {
    const expiresAt = this.getTokenExpires();
    if (!expiresAt) return false;

    const now = Date.now();
    return now >= expiresAt;
  }

  clearTokens(): void {
    this.accessToken = null;
    this.refreshToken = null;
    this.tokenExpires = null;
    this.clearLegacyBrowserStorageTokens();
  }

  private clearLegacyBrowserStorageTokens(): void {
    sessionStorage.removeItem(this.ACCESS_TOKEN_KEY);
    sessionStorage.removeItem(this.REFRESH_TOKEN_KEY);
    sessionStorage.removeItem(this.TOKEN_EXPIRES_KEY);

    localStorage.removeItem(this.ACCESS_TOKEN_KEY);
    localStorage.removeItem(this.REFRESH_TOKEN_KEY);
    localStorage.removeItem(this.TOKEN_EXPIRES_KEY);

    this.LEGACY_AUTH_KEYS.forEach((key) => {
      sessionStorage.removeItem(key);
      localStorage.removeItem(key);
    });
  }
}
