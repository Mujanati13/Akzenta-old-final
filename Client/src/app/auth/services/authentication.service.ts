import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { tap, switchMap, catchError, map } from 'rxjs/operators';

import { environment } from '@env/environment';
import { TokenStorageService } from './token-storage.service';
import { CredentialsService } from './credentials.service';
import { Credentials } from '@core/entities';
import { ROLE } from '../enums/roles.enum';
import { InitializerService } from '@app/core/services/initializer.service';
import { AuthStateService, AuthState } from './auth-state.service';

export interface LoginContext {
  username: string;
  password: string;
  remember?: boolean;
  isMobile?: boolean;
}

export interface LoginResponse {
  tokenExpires?: number;
  user: {
    id: number;
    email: string;
    provider: string;
    socialId: string;
    firstName: string;
    lastName: string;
    photo: {
      id: string;
      path: string;
    };
    role: {
      id: number;
      name: string;
    };
    status: {
      id: number;
      name: string;
    };
    createdAt: string;
    updatedAt: string;
    deletedAt: string;
  };
}

/**
 * Provides authentication workflow with API integration.
 */
@Injectable({
  providedIn: 'root',
})
export class AuthenticationService {
  private readonly apiUrl = environment.apiUrl;

  constructor(
    private readonly _http: HttpClient,
    private readonly _tokenStorageService: TokenStorageService,
    private readonly _credentialsService: CredentialsService,
    private readonly _initializerService: InitializerService,
    private readonly _authStateService: AuthStateService, // Add this dependency
  ) {}

  /**
   * Authenticates the user with the API.
   * @param context The login parameters.
   * @return The user credentials.
   */
  login(context: LoginContext): Observable<Credentials> {
    return this._http
      .post<LoginResponse>(
        `${this.apiUrl}/auth/client/login`,
        {
          email: context.username,
          password: context.password,
        },
        {
          withCredentials: true,
        },
      )
      .pipe(
        switchMap((response) => {
          return this._initializerService.loadInitialAppData().pipe(
            map((initialData) => {
              if (!initialData) {
                throw new Error('Failed to load user data');
              }

              // Map roles from API response
              const roleMapping = {
                admin: ROLE.ADMIN,
                user: ROLE.USER,
                member: ROLE.MEMBER,
                guest: ROLE.GUEST,
              };

              const user = initialData.user;
              const roleName = user.role?.name || 'guest';
              const mappedRole = roleMapping[roleName.toLowerCase()] || ROLE.GUEST;

              // Create credentials object for memory storage only
              const credentials = new Credentials({
                id: user.id,
                username: user.email,
                token: '',
                refreshToken: '',
                expiresIn: response.tokenExpires || 0,
                roles: [mappedRole],
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
              });

              this._credentialsService.setCredentials(credentials);
              this._authStateService.setAuthState(AuthState.AUTHENTICATED);

              return credentials;
            }),
            catchError((err) => {
              console.error('Failed to load initial data after login:', err);
              return this.createCredentialsFromLoginResponse(response);
            }),
          );
        }),
        catchError((error) => {
          console.error('Login error:', error);
          this._tokenStorageService.clearTokens();
          this._credentialsService.setCredentials();
          this._authStateService.setAuthState(AuthState.NOT_AUTHENTICATED);

          return throwError(() => new Error('Login failed'));
        }),
      );
  }

  /**
   * Creates credentials from login response as fallback
   */
  private createCredentialsFromLoginResponse(response: LoginResponse): Observable<Credentials> {
    const roleMapping = {
      admin: ROLE.ADMIN,
      user: ROLE.USER,
      member: ROLE.MEMBER,
      guest: ROLE.GUEST,
    };

    // Ensure case-insensitive role mapping with debug logging
    const roleName = response.user.role?.name || 'guest';
    const mappedRole = roleMapping[roleName.toLowerCase()] || ROLE.GUEST;

    const credentials = new Credentials({
      id: response.user.id,
      username: response.user.email,
      token: '',
      refreshToken: '',
      expiresIn: response.tokenExpires || 0,
      roles: [mappedRole],
      email: response.user.email,
      firstName: response.user.firstName,
      lastName: response.user.lastName,
    });

    this._credentialsService.setCredentials(credentials);
    this._authStateService.setAuthState(AuthState.AUTHENTICATED);

    return of(credentials);
  }

  /**
   * Refreshes the access token
   */
  refreshToken(): Observable<{ tokenExpires?: number }> {
    return this._http
      .post<{ tokenExpires?: number }>(
        `${this.apiUrl}/auth/refresh`,
        {},
        {
          withCredentials: true,
        },
      )
      .pipe(
        tap((response) => {
          if (response.tokenExpires) {
            this._tokenStorageService.setTokenExpires(response.tokenExpires);
          }

          const currentCreds = this._credentialsService.credentials;
          if (currentCreds && response.tokenExpires) {
            const updatedCreds = new Credentials({
              ...currentCreds,
              expiresIn: response.tokenExpires,
            });
            this._credentialsService.setCredentials(updatedCreds);
          }
        }),
      );
  }

  /**
   * Logs out the user and clears credentials.
   * @return True if the user was logged out successfully.
   */
  logout(): Observable<boolean> {
    return this._http
      .post<void>(
        `${this.apiUrl}/auth/logout`,
        {},
        {
          withCredentials: true,
        },
      )
      .pipe(
        tap(() => {
          this.clearClientStateOnLogout();
        }),
        switchMap(() => of(true)),
        catchError(() => {
          this.clearClientStateOnLogout();
          return of(true);
        }),
      );
  }

  private clearClientStateOnLogout(): void {
    this._tokenStorageService.clearTokens();
    this._credentialsService.setCredentials();
    this._authStateService.setAuthState(AuthState.NOT_AUTHENTICATED);
    sessionStorage.removeItem('returnUrl');
    localStorage.removeItem('returnUrl');
  }
}
