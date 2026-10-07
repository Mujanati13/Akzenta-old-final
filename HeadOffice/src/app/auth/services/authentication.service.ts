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
import { DashboardStateService } from '@app/core/services/dashboard-state.service';

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
    private readonly _dashboardStateService: DashboardStateService,
  ) {}

  /**
   * Authenticates the user with the API.
   * @param context The login parameters.
   * @return The user credentials.
   */
  login(context: LoginContext): Observable<Credentials> {
    console.info('[AKZ_DEBUG][AuthService.login] login attempt', {
      endpoint: `${this.apiUrl}/auth/akzente/login`,
      email: context.username,
    });

    return this._http
      .post<LoginResponse>(
        `${this.apiUrl}/auth/akzente/login`,
        {
          email: context.username,
          password: context.password,
        },
        {
          withCredentials: true,
        },
      )
      .pipe(
        tap((response) => {
          console.info('[AKZ_DEBUG][AuthService.login] login success', {
            userId: response.user?.id,
            role: response.user?.role?.name,
            tokenExpires: response.tokenExpires,
          });
          if (response.tokenExpires) {
            this._tokenStorageService.setTokenExpires(response.tokenExpires);
          }
        }),
        // Load initial data immediately after storing tokens
        switchMap((response) => {
          // Use the initializer service to get complete user profile
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

              // Store credentials in memory only
              this._credentialsService.setCredentials(credentials);

              // Explicitly set auth state to AUTHENTICATED (add this line)
              this._authStateService.setAuthState(AuthState.AUTHENTICATED);

              return credentials;
            }),
            catchError((err) => {
              console.error('[AKZ_DEBUG][AuthService.login] initializer failed after login', err);
              // If initializer fails, we still try to create credentials from login response
              return this.createCredentialsFromLoginResponse(response);
            }),
          );
        }),
        catchError((error) => {
          console.error('[AKZ_DEBUG][AuthService.login] login failed', {
            status: error?.status,
            message: error?.message,
            error: error?.error,
            url: error?.url,
          });
          // Clear any tokens that might have been set
          this._tokenStorageService.clearTokens();
          this._credentialsService.setCredentials();

          // Make sure auth state is set to NOT_AUTHENTICATED (add this line)
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

    // Store credentials in memory only
    this._credentialsService.setCredentials(credentials);

    // Explicitly set auth state to AUTHENTICATED (add this line)
    this._authStateService.setAuthState(AuthState.AUTHENTICATED);

    return of(credentials);
  }

  /**
   * Refreshes the access token
   */
  refreshToken(): Observable<{ tokenExpires?: number }> {
    console.info('[AKZ_DEBUG][AuthService.refreshToken] attempting refresh');
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
          console.info('[AKZ_DEBUG][AuthService.refreshToken] refresh success', {
            tokenExpires: response.tokenExpires,
          });
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

    this.clearPersistedSessionState();
  }

  clearPersistedSessionState(): void {
    this._dashboardStateService.clearSessionState();

    // Clear only auth-adjacent state without wiping every cached preference/draft.
    [
      'users_list_data_v1',
      'users_list_view_state_v1',
      'clients_list_state',
      'notifications_state_v1',
      'favorites_data_v1',
      'staff_data_cache_v1',
      'project_create_state',
      'client_add_state',
      'contact_person_add_state',
      'headoffice_filiale_suchen_data_v1',
      'headoffice_filiale_suchen_view_state_v1',
      'dashboard_view_state_v2',
    ].forEach((key) => {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    });

    this.removeStorageEntriesByPrefix(localStorage, ['client_detail_state_', 'akzente-report-cache:']);
    this.removeStorageEntriesByPrefix(sessionStorage, ['client_detail_state_', 'akzente-report-cache:']);
  }

  private removeStorageEntriesByPrefix(storage: Storage, prefixes: string[]): void {
    for (let index = storage.length - 1; index >= 0; index -= 1) {
      const key = storage.key(index);
      if (!key) {
        continue;
      }

      if (prefixes.some((prefix) => key.startsWith(prefix))) {
        storage.removeItem(key);
      }
    }
  }
}
