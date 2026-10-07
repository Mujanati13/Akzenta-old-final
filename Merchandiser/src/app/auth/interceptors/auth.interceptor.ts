import { Injectable } from '@angular/core';
import { HttpRequest, HttpHandler, HttpEvent, HttpInterceptor, HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { catchError, filter, take, switchMap, finalize } from 'rxjs/operators';
import { TokenStorageService } from '../services/token-storage.service';
import { AuthenticationService } from '../services/authentication.service';
import { CredentialsService } from '../services/credentials.service';
import { AuthStateService, AuthState } from '../services/auth-state.service';
import { environment } from '@env/environment';
import { SKIP_AUTH_CHECK } from '../../@core/interceptors/api-prefix.interceptor';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  private isRefreshing = false;
  private refreshTokenSubject: BehaviorSubject<boolean | null> = new BehaviorSubject<boolean | null>(null);

  constructor(
    private tokenService: TokenStorageService,
    private authService: AuthenticationService,
    private credentialsService: CredentialsService,
    private authStateService: AuthStateService,
  ) {}

  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const credentialedRequest = this.withAuthScope(request.withCredentials ? request : request.clone({ withCredentials: true }));

    if (this.isAuthRequest(credentialedRequest) || credentialedRequest.context.get(SKIP_AUTH_CHECK)) {
      return next.handle(credentialedRequest);
    }

    return next.handle(credentialedRequest).pipe(
      catchError((error) => {
        if (error instanceof HttpErrorResponse) {
          if (error.status === 401) {
            return this.handle401Error(credentialedRequest, next);
          }
        }
        return throwError(() => error);
      }),
    );
  }

  private isAuthRequest(request: HttpRequest<any>): boolean {
    return (
      request.url.includes('/auth/email/login') ||
      request.url.includes('/auth/akzente/login') ||
      request.url.includes('/auth/client/login') ||
      request.url.includes('/auth/merchandiser/login') ||
      request.url.includes('/auth/refresh') ||
      request.url.includes('/auth/forgot/password') ||
      request.url.includes('/auth/reset/password')
    );
  }

  private handle401Error(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    if (!this.isRefreshing) {
      this.isRefreshing = true;
      this.refreshTokenSubject.next(null);

      return this.authService.refreshToken().pipe(
        switchMap(() => {
          this.isRefreshing = false;
          this.refreshTokenSubject.next(true);
          return next.handle(this.prepareRequest(request));
        }),
        catchError((error) => {
          this.isRefreshing = false;
          this.clearAuthAndRedirect();
          return throwError(() => error);
        }),
        finalize(() => {
          this.isRefreshing = false;
        }),
      );
    } else {
      return this.refreshTokenSubject.pipe(
        filter((refreshed): refreshed is boolean => refreshed !== null),
        take(1),
        switchMap(() => next.handle(this.prepareRequest(request))),
      );
    }
  }

  private prepareRequest(request: HttpRequest<unknown>): HttpRequest<unknown> {
    return this.withAuthScope(request.withCredentials ? request : request.clone({ withCredentials: true }));
  }

  private withAuthScope(request: HttpRequest<unknown>): HttpRequest<unknown> {
    const scope = environment.settings?.auth?.cookieScope;
    if (!scope || request.headers.has('X-Akzente-Auth-Scope')) {
      return request;
    }

    return request.clone({
      setHeaders: {
        'X-Akzente-Auth-Scope': scope,
      },
    });
  }

  private clearAuthAndRedirect(): void {
    this.tokenService.clearTokens();
    this.credentialsService.setCredentials();
    this.authStateService.setAuthState(AuthState.NOT_AUTHENTICATED);

    // Don't navigate directly, let the shell component handle it
    // The navigation will happen based on the auth state change
  }
}
