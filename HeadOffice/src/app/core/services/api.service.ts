import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams, HttpErrorResponse, HttpContext } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';
import { environment } from '@env/environment';
import { SKIP_API_PREFIX, SKIP_AUTH_CHECK } from '@app/@core/interceptors/api-prefix.interceptor';

interface ApiConfig {
  baseURL: string;
  timeout: number;
}

interface ErrorResponse {
  status?: number;
  message?: string;
  data?: any;
}

interface ApiRequestConfig {
  headers?: { [key: string]: string };
  params?: { [key: string]: any };
  skipAuth?: boolean;
  skipApiPrefix?: boolean;
  _retry?: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class ApiService {
  private readonly apiConfig: ApiConfig = {
    baseURL: environment.apiUrl,
    timeout: 30000,
  };

  constructor(private http: HttpClient) {}

  /**
   * Get the current language (from localStorage or fallback to 'en')
   */
  private getLanguage(): string {
    return localStorage.getItem('i18nextLng') || 'de';
  }

  /**
   * Build full URL with base URL if needed
   */
  private buildUrl(url: string, skipApiPrefix = false): string {
    // If URL is already absolute or we should skip API prefix, return as is
    if (url.startsWith('http') || skipApiPrefix) {
      return url;
    }

    // Remove leading slash if present to avoid double slashes
    const cleanUrl = url.startsWith('/') ? url.substring(1) : url;

    // Combine base URL with the endpoint
    return `${this.apiConfig.baseURL}/${cleanUrl}`;
  }

  /**
   * Create HTTP headers with language only. Auth is cookie-backed.
   */
  private createHeaders(customHeaders: { [key: string]: string } = {}, skipAuth = false): HttpHeaders {
    let headers = new HttpHeaders(customHeaders);

    void skipAuth;

    const language = this.getLanguage();
    headers = headers.set('x-custom-lang', language);

    return headers;
  }

  /**
   * Create HTTP context for interceptor configuration
   */
  private createContext(skipAuth = false, skipApiPrefix = false): HttpContext {
    let context = new HttpContext();

    if (skipAuth) {
      context = context.set(SKIP_AUTH_CHECK, true);
    }

    if (skipApiPrefix) {
      context = context.set(SKIP_API_PREFIX, true);
    }

    return context;
  }

  /**
   * Create HTTP params from object
   */
  private createParams(params: { [key: string]: any } = {}): HttpParams {
    let httpParams = new HttpParams();

    Object.keys(params).forEach((key) => {
      if (params[key] !== null && params[key] !== undefined) {
        httpParams = httpParams.set(key, params[key].toString());
      }
    });

    return httpParams;
  }

  /**
   * Handle HTTP errors and token refresh
   */
  private handleError = (error: HttpErrorResponse, config?: ApiRequestConfig): Observable<any> => {
    const errorResponse: ErrorResponse = {};

    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorResponse.message = 'Client Error';
      errorResponse.data = error.error.message;
    } else {
      // Server-side error
      errorResponse.status = error.status;
      errorResponse.message = error.error?.message || 'Server Error';
      errorResponse.data = error.error;
    }

    return throwError(() => errorResponse);
  };

  /**
   * Execute HTTP request with error handling and retry logic
   */
  private executeRequest<T>(method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', url: string, data?: any, config: ApiRequestConfig = {}): Observable<T> {
    // Build the full URL using the base URL from apiConfig
    const fullUrl = this.buildUrl(url, config.skipApiPrefix);

    const headers = this.createHeaders(config.headers, config.skipAuth);
    const context = this.createContext(config.skipAuth, config.skipApiPrefix);
    const params = this.createParams(config.params);

    const requestOptions = {
      headers,
      context,
      params: method === 'GET' || method === 'DELETE' || method === 'PATCH' ? params : undefined,
      body: method !== 'GET' && method !== 'DELETE' ? data : undefined,
      withCredentials: true,
    };

    const request$ = this.http.request<T>(method, fullUrl, requestOptions);

    return request$.pipe(
      // Apply timeout from apiConfig
      timeout(this.apiConfig.timeout),
      catchError((error: HttpErrorResponse) => this.handleError(error, config)),
    );
  }

  /**
   * GET request with optional headers and query parameters
   */
  get<T>(url: string, params: any = {}, headers: any = {}, skipAuth = false, skipApiPrefix = false): Observable<T> {
    const config: ApiRequestConfig = { headers, params, skipAuth, skipApiPrefix };
    return this.executeRequest<T>('GET', url, undefined, config);
  }

  /**
   * POST request with optional headers
   */
  post<T>(url: string, data: any = {}, headers: any = {}, skipAuth = false, skipApiPrefix = false): Observable<T> {
    const config: ApiRequestConfig = { headers, skipAuth, skipApiPrefix };
    return this.executeRequest<T>('POST', url, data, config);
  }

  /**
   * POST request for file uploads - ensures no Content-Type header is set
   */
  postFile<T>(url: string, formData: FormData, skipAuth = false, skipApiPrefix = false): Observable<T> {
    // For file uploads, we need special handling to avoid any headers that might interfere
    // with multipart/form-data boundary

    const fullUrl = this.buildUrl(url, skipApiPrefix);

    // Keep file uploads cookie-backed without forcing a multipart Content-Type.
    let headers = new HttpHeaders();
    void skipAuth;

    // Create context for interceptors
    const context = this.createContext(skipAuth, skipApiPrefix);

    const requestOptions = {
      headers,
      context,
      body: formData,
      withCredentials: true,
    };

    const request$ = this.http.request<T>('POST', fullUrl, requestOptions);

    return request$.pipe(
      // Apply timeout from apiConfig
      timeout(this.apiConfig.timeout),
      catchError((error: HttpErrorResponse) => {
        return this.handleError(error, { skipAuth, skipApiPrefix });
      }),
    );
  }

  /**
   * PATCH request for file uploads - ensures no Content-Type header is set
   */
  patchFile<T>(url: string, formData: FormData, skipAuth = false, skipApiPrefix = false, timeoutMs = this.apiConfig.timeout): Observable<T> {
    // For file uploads, we need special handling to avoid any headers that might interfere
    // with multipart/form-data boundary

    const fullUrl = this.buildUrl(url, skipApiPrefix);

    // Keep file uploads cookie-backed without forcing a multipart Content-Type.
    let headers = new HttpHeaders();
    void skipAuth;

    // Create context for interceptors
    const context = this.createContext(skipAuth, skipApiPrefix);

    const requestOptions = {
      headers,
      context,
      body: formData,
      withCredentials: true,
    };

    const request$ = this.http.request<T>('PATCH', fullUrl, requestOptions);

    return request$.pipe(
      timeout(timeoutMs),
      catchError((error: HttpErrorResponse) => {
        return this.handleError(error, { skipAuth, skipApiPrefix });
      }),
    );
  }
  /**
   * PUT request with optional headers
   */
  put<T>(url: string, data: any = {}, headers: any = {}, skipAuth = false, skipApiPrefix = false): Observable<T> {
    const defaultHeaders = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...headers,
    };
    const config: ApiRequestConfig = { headers: defaultHeaders, skipAuth, skipApiPrefix };
    return this.executeRequest<T>('PUT', url, data, config);
  }

  /**
   * PATCH request with optional headers and query parameters
   */
  patch<T>(url: string, data: any = {}, params: any = {}, headers: any = {}, skipAuth = false, skipApiPrefix = false): Observable<T> {
    const config: ApiRequestConfig = { headers, params, skipAuth, skipApiPrefix };
    return this.executeRequest<T>('PATCH', url, data, config);
  }

  /**
   * DELETE request with optional headers and query parameters
   */
  delete<T>(url: string, params: any = {}, headers: any = {}, skipAuth = false, skipApiPrefix = false): Observable<T> {
    const config: ApiRequestConfig = { headers, params, skipAuth, skipApiPrefix };
    return this.executeRequest<T>('DELETE', url, undefined, config);
  }

  /**
   * GET request that returns a Blob (for file downloads)
   */
  getBlob(url: string, params: any = {}, headers: any = {}, skipAuth = false, skipApiPrefix = false): Observable<Blob> {
    const fullUrl = this.buildUrl(url, skipApiPrefix);

    const httpHeaders = this.createHeaders(headers, skipAuth);
    const context = this.createContext(skipAuth, skipApiPrefix);
    const httpParams = this.createParams(params);

    const requestOptions = {
      headers: httpHeaders,
      context,
      params: httpParams,
      responseType: 'blob' as 'blob',
      withCredentials: true,
    };

    return this.http.get(fullUrl, requestOptions).pipe(
      timeout(this.apiConfig.timeout),
      catchError((error: HttpErrorResponse) => this.handleError(error, { headers, params, skipAuth, skipApiPrefix })),
    );
  }
}
