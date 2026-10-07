import { Injectable } from '@angular/core';
import { HttpContextToken, HttpErrorResponse, HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Observable, Subject, takeUntil, throwError } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { catchError, finalize } from 'rxjs/operators';
import { CredentialsService } from '@auth';
import { Router } from '@angular/router';
import { environment } from '@env/environment';

// Create a context token to control when to skip this interceptor
export const SKIP_API_PREFIX = new HttpContextToken(() => false);
export const SKIP_AUTH_CHECK = new HttpContextToken(() => false);

@Injectable({
  providedIn: 'root',
})
export class ApiPrefixInterceptor implements HttpInterceptor {
  private readonly _ongoingRequests = new Map<string, Subject<any>>();

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

    if (!hasAuthorizationHeader && !isAuthEndpoint && !(request.body instanceof FormData)) {
      headers = headers.set('content-type', 'application/json');
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

    /**
     * In below piece of code If there is an ongoing request with the same method and URL than return the ongoing request instead of creating a new one
     * This is useful when the user clicks multiple times on a button that triggers a request
     */

    const requestKey = this._getRequestKey(request);

    const ongoingRequest = this._ongoingRequests.get(requestKey);
    if (ongoingRequest) {
      return ongoingRequest.asObservable();
    } else {
      const cancelSubject = new Subject<any>();
      this._ongoingRequests.set(requestKey, cancelSubject);

      return next.handle(request).pipe(
        takeUntil(cancelSubject),
        catchError((error: HttpErrorResponse) => {
          if (!request.context.get(SKIP_AUTH_CHECK) && error.status === 401) {
            return throwError(() => error);
          }

          if (!request.context.get(SKIP_AUTH_CHECK) && error.status === 403) {
            this._credentialsService.setCredentials();
            this._router.navigate(['/login']);
          }
          return throwError(() => error);
        }),
        finalize(() => {
          this._ongoingRequests.delete(requestKey);
          cancelSubject.complete();
        }),
      );
    }
  }

  private _getRequestKey(req: HttpRequest<any>): string {
    return `${req.method} ${req.urlWithParams}`;
  }

  private _isAuthEndpoint(url: string): boolean {
    return (
      url.includes('/auth/login') ||
      url.includes('/auth/client/login') ||
      url.includes('/auth/merchandiser/login') ||
      url.includes('/auth/akzente/login') ||
      url.includes('/auth/refresh') ||
      url.includes('/auth/logout')
    );
  }
}
