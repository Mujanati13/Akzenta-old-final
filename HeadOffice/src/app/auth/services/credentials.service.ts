import { Injectable } from '@angular/core';
import { Credentials } from '@core/entities';
import { TokenStorageService } from './token-storage.service';

/**
 * Provides in-memory storage for authentication credentials.
 * No user data or tokens are stored in browser storage.
 */
@Injectable({
  providedIn: 'root',
})
export class CredentialsService {
  private _credentials: Credentials | null = null;

  constructor(private tokenStorageService: TokenStorageService) {
    // We no longer load credentials from storage
  }

  /**
   * Gets the user credentials.
   * @return The user credentials or null if the user is not authenticated.
   */
  get credentials(): Credentials | null {
    return this._credentials;
  }

  /**
   * Checks is the user is authenticated.
   * @return True if the user is authenticated.
   */
  isAuthenticated(): boolean {
    return !!this._credentials;
  }

  /**
   * Sets the user credentials in memory only.
   * @param credentials The user credentials.
   */
  setCredentials(credentials?: Credentials) {
    this._credentials = credentials || null;

    if (!credentials) {
      this.tokenStorageService.clearTokens();
    }
  }
}
