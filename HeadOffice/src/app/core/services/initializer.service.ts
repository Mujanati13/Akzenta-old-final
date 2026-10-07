import { Injectable } from '@angular/core';
import { HttpClient, HttpContext, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, catchError, of, tap } from 'rxjs';
import { environment } from '@env/environment';
import { SKIP_API_PREFIX, SKIP_AUTH_CHECK } from '@app/@core/interceptors/api-prefix.interceptor';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import * as AppDataActions from '@app/@core/store/app-data/app-data.actions';
import { ClientCompany } from '@app/core/services/client-company.service';
import { isPublicAuthRoute } from '@app/auth/utils/public-auth-routes.util';

export interface InitialDataUser {
  id: number;
  email: string;
  provider: string;
  socialId: string | null;
  firstName: string;
  lastName: string;
  role: {
    id: number;
    name: string;
    __entity: string;
  };
  status: {
    id: number;
    name: string;
    __entity: string;
  };
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface InitialData {
  user: InitialDataUser;
  clientCompanies: ClientCompany[];
}

@Injectable({
  providedIn: 'root',
})
export class InitializerService {
  private _initialData = new BehaviorSubject<InitialData | null>(null);
  public initialData$ = this._initialData.asObservable();

  private _currentUser = new BehaviorSubject<InitialDataUser | null>(null);
  public currentUser$ = this._currentUser.asObservable();

  constructor(
    private http: HttpClient,
    private router: Router,
    private store: Store,
  ) {}

  /**
   * Loads application initial data
   */
  loadInitialAppData(): Observable<InitialData | null> {
    // Use the full URL directly instead of relying on ApiPrefixInterceptor
    const url = `${environment.apiUrl}/get-initial-data`;

    // Create a proper HttpContext with both tokens
    const context = new HttpContext().set(SKIP_API_PREFIX, true).set(SKIP_AUTH_CHECK, true);

    const headers = new HttpHeaders(this.buildAuthHeaders());

    return this.http
      .get<InitialData>(url, {
        context,
        headers,
        withCredentials: true,
      })
      .pipe(
        tap((data) => {
          this._initialData.next(data);

          // Dispatch to store - this is crucial for the ClientService to work
          this.store.dispatch(AppDataActions.loadInitialDataSuccess({ data }));

          // If user data is present, update the current user subject
          if (data && data.user) {
            this._currentUser.next(data.user);
            this.store.dispatch(AppDataActions.updateUser({ user: data.user }));
          }
        }),
        catchError((error) => {
          console.error('❌ InitializerService: Failed to load initial app data', error);

          // Dispatch error to store
          this.store.dispatch(
            AppDataActions.loadInitialDataFailure({
              error: error.message || 'Failed to load initial data',
            }),
          );

          // Unauthenticated users are expected on public auth routes (e.g. password reset links).
          if ((error.status === 401 || error.status === 403) && !isPublicAuthRoute()) {
            this.router.navigate(['/login']);
          }

          return of(null); // Return null instead of failing app initialization
        }),
      );
  }

  /**
   * Get the initial data as a snapshot (for synchronous access)
   */
  getInitialData(): InitialData | null {
    return this._initialData.getValue();
  }

  /**
   * Get the current user data as a snapshot (for synchronous access)
   */
  getCurrentUser(): InitialDataUser | null {
    return this._currentUser.getValue();
  }

  private buildAuthHeaders(): { [name: string]: string } {
    const scope = environment.settings?.auth?.cookieScope;
    return scope ? { 'X-Akzente-Auth-Scope': scope } : {};
  }
}
