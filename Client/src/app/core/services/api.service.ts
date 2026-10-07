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

  private getLanguage(): string {
    return localStorage.getItem('i18nextLng') || 'de';
  }

  private buildUrl(url: string, skipApiPrefix = false): string {
    if (url.startsWith('http') || skipApiPrefix) {
      return url;
    }

    const cleanUrl = url.startsWith('/') ? url.substring(1) : url;
    return `${this.apiConfig.baseURL}/${cleanUrl}`;
  }

  private createHeaders(customHeaders: { [key: string]: string } = {}, skipAuth = false): HttpHeaders {
    let headers = new HttpHeaders(customHeaders);

    void skipAuth;

    const language = this.getLanguage();
    headers = headers.set('x-custom-lang', language);
    return headers;
  }

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

  private createParams(params: { [key: string]: any } = {}): HttpParams {
    let httpParams = new HttpParams();

    Object.keys(params).forEach((key) => {
      if (params[key] !== null && params[key] !== undefined) {
        httpParams = httpParams.set(key, params[key].toString());
      }
    });

    return httpParams;
  }

  private handleError = (error: HttpErrorResponse, _config?: ApiRequestConfig): Observable<never> => {
    const errorResponse: ErrorResponse = {};

    if (error.error instanceof ErrorEvent) {
      errorResponse.message = 'Client Error';
      errorResponse.data = error.error.message;
    } else {
      errorResponse.status = error.status;
      errorResponse.message = error.error?.message || 'Server Error';
      errorResponse.data = error.error;
    }

    return throwError(() => errorResponse);
  };

  private executeRequest<T>(method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', url: string, data?: any, config: ApiRequestConfig = {}): Observable<T> {
    const fullUrl = this.buildUrl(url, config.skipApiPrefix);
    const headers = this.createHeaders(config.headers, config.skipAuth);
    const context = this.createContext(config.skipAuth, config.skipApiPrefix);
    const params = this.createParams(config.params);

    const requestOptions = {
      headers,
      context,
      params: method === 'GET' || method === 'DELETE' ? params : undefined,
      body: method !== 'GET' && method !== 'DELETE' ? data : undefined,
      withCredentials: true,
    };

    return this.http.request<T>(method, fullUrl, requestOptions).pipe(
      timeout(this.apiConfig.timeout),
      catchError((error: HttpErrorResponse) => this.handleError(error, config)),
    );
  }

  get<T>(url: string, params: any = {}, headers: any = {}, skipAuth = false, skipApiPrefix = false): Observable<T> {
    const config: ApiRequestConfig = { headers, params, skipAuth, skipApiPrefix };
    return this.executeRequest<T>('GET', url, undefined, config);
  }

  post<T>(url: string, data: any = {}, headers: any = {}, skipAuth = false, skipApiPrefix = false): Observable<T> {
    const config: ApiRequestConfig = { headers, skipAuth, skipApiPrefix };
    return this.executeRequest<T>('POST', url, data, config);
  }

  postFile<T>(url: string, formData: FormData, skipAuth = false, skipApiPrefix = false): Observable<T> {
    const fullUrl = this.buildUrl(url, skipApiPrefix);
    const context = this.createContext(skipAuth, skipApiPrefix);
    const requestOptions = {
      headers: new HttpHeaders(),
      context,
      body: formData,
      withCredentials: true,
    };

    return this.http.request<T>('POST', fullUrl, requestOptions).pipe(
      timeout(this.apiConfig.timeout),
      catchError((error: HttpErrorResponse) => this.handleError(error, { skipAuth, skipApiPrefix })),
    );
  }

  patchFile<T>(url: string, formData: FormData, skipAuth = false, skipApiPrefix = false): Observable<T> {
    const fullUrl = this.buildUrl(url, skipApiPrefix);
    const context = this.createContext(skipAuth, skipApiPrefix);
    const requestOptions = {
      headers: new HttpHeaders(),
      context,
      body: formData,
      withCredentials: true,
    };

    return this.http.request<T>('PATCH', fullUrl, requestOptions).pipe(
      timeout(this.apiConfig.timeout),
      catchError((error: HttpErrorResponse) => this.handleError(error, { skipAuth, skipApiPrefix })),
    );
  }

  put<T>(url: string, data: any = {}, headers: any = {}, skipAuth = false, skipApiPrefix = false): Observable<T> {
    const defaultHeaders = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...headers,
    };
    const config: ApiRequestConfig = {
      headers: defaultHeaders,
      skipAuth,
      skipApiPrefix,
    };
    return this.executeRequest<T>('PUT', url, data, config);
  }

  patch<T>(url: string, data: any = {}, headers: any = {}, skipAuth = false, skipApiPrefix = false): Observable<T> {
    const config: ApiRequestConfig = { headers, skipAuth, skipApiPrefix };
    return this.executeRequest<T>('PATCH', url, data, config);
  }

  delete<T>(url: string, params: any = {}, headers: any = {}, skipAuth = false, skipApiPrefix = false): Observable<T> {
    const config: ApiRequestConfig = { headers, params, skipAuth, skipApiPrefix };
    return this.executeRequest<T>('DELETE', url, undefined, config);
  }

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
