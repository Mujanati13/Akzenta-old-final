import { Injectable } from '@angular/core';
import { HttpContextToken, HttpErrorResponse, HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { catchError } from 'rxjs/operators';
import { CredentialsService } from '@auth';
import { Router } from '@angular/router';
import { environment } from '@env/environment';
import { isPublicAuthRoute } from '@app/auth/utils/public-auth-routes.util';

// Create a context token to control when to skip this interceptor
export const SKIP_API_PREFIX = new HttpContextToken(() => false);
export const SKIP_AUTH_CHECK = new HttpContextToken(() => false);

@Injectable({
  providedIn: 'root',
})
export class ApiPrefixInterceptor implements HttpInterceptor {
  constructor(
    private readonly _credentialsService: CredentialsService,
    private readonly _translateService: TranslateService,
    private readonly _router: Router,
  ) {}

  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // Skip if the context flag is set
    if (request.context.get(SKIP_API_PREFIX)) {
      return next.handle(request);
    }

    // If the request has the 'noauth' header, don't add the Authorization header
    if (request.headers.get('noauth')) {
      return next.handle(request);
    }

    let headers = request.headers;

    // Fix: Add null check for currentLang
    const currentLang = this._translateService.currentLang ? this._translateService.currentLang.substring(0, 2) : 'de'; // Default to German if no language is set

    const hasAuthorizationHeader = headers.has('Authorization');
    const isAuthEndpoint = this._isAuthEndpoint(request.url);
    if (isAuthEndpoint) {
      console.info('[AKZ_DEBUG][ApiPrefixInterceptor] auth endpoint detected', {
        url: request.url,
        hasAuthorizationHeader,
      });
    }

    if (!hasAuthorizationHeader && !(request.body instanceof FormData)) {
      if (!(request.body instanceof FormData)) {
        headers = headers.set('content-type', 'application/json');
      }
    }
    headers = headers.set('Accept-Language', currentLang).set('Content-Language', currentLang).set('lang', currentLang);

    const cookieScope = environment.settings?.auth?.cookieScope;
    if (cookieScope && !headers.has('X-Akzente-Auth-Scope')) {
      headers = headers.set('X-Akzente-Auth-Scope', cookieScope);
    }

    request = request.clone({
      headers,
      withCredentials: true,
    });

    return next.handle(request).pipe(
      catchError((error: HttpErrorResponse) => {
        // Let AuthInterceptor own 401 handling (refresh, retry, logout).
        // Clearing credentials here races with refresh flow and can remove
        // refresh token before AuthInterceptor reads it.
        if (!request.context.get(SKIP_AUTH_CHECK) && error.status === 401) {
          console.warn('[AKZ_DEBUG][ApiPrefixInterceptor] passing 401 to AuthInterceptor', {
            url: request.url,
            method: request.method,
          });
          return throwError(() => error);
        }

        if (!request.context.get(SKIP_AUTH_CHECK) && error.status === 403 && !isPublicAuthRoute()) {
          this._credentialsService.setCredentials();
          this._router.navigate(['/login']);
        }
        return throwError(() => error);
      }),
    );
  }

  private _isAuthEndpoint(url: string): boolean {
    return (
      url.includes('/auth/login') ||
      url.includes('/auth/client/login') ||
      url.includes('/auth/merchandiser/login') ||
      url.includes('/auth/akzente/login') ||
      url.includes('/auth/refresh') ||
      url.includes('/auth/logout') ||
      url.includes('/auth/forgot/password') ||
      url.includes('/auth/reset/password')
    );
  }
}
