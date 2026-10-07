import { Injectable } from '@angular/core';
import { Observable, concat, of, throwError } from 'rxjs';
import { catchError, finalize, shareReplay, tap } from 'rxjs/operators';
import { ReportService } from '@app/core/services/report.service';

type ReportLike = any;

interface CacheSnapshot {
  data: ReportLike[];
  timestamp: number;
}

interface CacheEntry {
  stream$: Observable<ReportLike[]>;
  timestamp: number;
  inFlight: boolean;
  data?: ReportLike[];
}

@Injectable({
  providedIn: 'root',
})
export class ReportCacheService {
  private readonly ttlMs = 5 * 60 * 1000;
  private memoryCache = new Map<string, CacheEntry>();

  constructor(private readonly reportService: ReportService) {}

  getProjectReports(projectId: string | number, options: { forceRefresh?: boolean; status?: string } = {}): Observable<ReportLike[]> {
    const cacheKey = this.buildCacheKey(projectId, options.status);
    const forceRefresh = !!options.forceRefresh;

    const storedSnapshot = this.peekSnapshot(cacheKey);
    const hasValidSnapshot = !!storedSnapshot && !this.isExpired(storedSnapshot.timestamp);

    if (!forceRefresh && hasValidSnapshot) {
      const entry = this.memoryCache.get(cacheKey);
      if (entry && !entry.inFlight) {
        return entry.stream$;
      }
      if (!entry) {
        const stream$ = of(storedSnapshot.data).pipe(shareReplay(1));
        this.memoryCache.set(cacheKey, {
          stream$,
          timestamp: storedSnapshot.timestamp,
          inFlight: false,
          data: storedSnapshot.data,
        });
        return stream$;
      }
    }

    if (!forceRefresh && storedSnapshot && this.isExpired(storedSnapshot.timestamp)) {
      return concat(of(storedSnapshot.data), this.fetchAndCache(cacheKey, projectId, options.status));
    }

    if (!forceRefresh && storedSnapshot && !this.isExpired(storedSnapshot.timestamp)) {
      const entry = this.memoryCache.get(cacheKey);
      if (entry) {
        return entry.stream$;
      }
      const stream$ = of(storedSnapshot.data).pipe(shareReplay(1));
      this.memoryCache.set(cacheKey, {
        stream$,
        timestamp: storedSnapshot.timestamp,
        inFlight: false,
        data: storedSnapshot.data,
      });
      return stream$;
    }

    return this.fetchAndCache(cacheKey, projectId, options.status);
  }

  seed(projectId: string | number, reports: ReportLike[], options: { status?: string } = {}): void {
    const cacheKey = this.buildCacheKey(projectId, options.status);
    const timestamp = Date.now();
    this.persistSnapshot(cacheKey, { data: reports, timestamp });
    const stream$ = of(reports).pipe(shareReplay(1));
    this.memoryCache.set(cacheKey, { stream$, timestamp, inFlight: false, data: reports });
  }

  peek(projectId: string | number, options: { status?: string } = {}): CacheSnapshot | null {
    const cacheKey = this.buildCacheKey(projectId, options.status);
    return this.peekSnapshot(cacheKey);
  }

  invalidate(projectId: string | number, options: { status?: string } = {}): void {
    const cacheKey = this.buildCacheKey(projectId, options.status);
    this.memoryCache.delete(cacheKey);
    this.removeSnapshot(cacheKey);
  }

  private fetchAndCache(cacheKey: string, projectId: string | number, status?: string): Observable<ReportLike[]> {
    const request$ = this.reportService.getReportsByProject(projectId, { slim: true, status }).pipe(
      tap((reports) => {
        const snapshot: CacheSnapshot = { data: reports, timestamp: Date.now() };
        this.persistSnapshot(cacheKey, snapshot);
        this.memoryCache.set(cacheKey, {
          stream$: of(reports).pipe(shareReplay(1)),
          timestamp: snapshot.timestamp,
          inFlight: false,
          data: reports,
        });
      }),
      catchError((error) => {
        this.memoryCache.delete(cacheKey);
        return throwError(() => error);
      }),
      finalize(() => {
        const current = this.memoryCache.get(cacheKey);
        if (current) {
          this.memoryCache.set(cacheKey, { ...current, inFlight: false });
        }
      }),
      shareReplay(1),
    );

    this.memoryCache.set(cacheKey, {
      stream$: request$,
      timestamp: Date.now(),
      inFlight: true,
    });

    return request$;
  }

  private peekSnapshot(cacheKey: string): CacheSnapshot | null {
    const memoryEntry = this.memoryCache.get(cacheKey);
    if (memoryEntry?.data) {
      return {
        data: memoryEntry.data,
        timestamp: memoryEntry.timestamp,
      };
    }

    const stored = this.readSnapshot(cacheKey);
    return stored ?? null;
  }

  private persistSnapshot(cacheKey: string, snapshot: CacheSnapshot): void {
    void cacheKey;
    void snapshot;
  }

  private readSnapshot(cacheKey: string): CacheSnapshot | null {
    void cacheKey;
    return null;
  }

  private removeSnapshot(cacheKey: string): void {
    void cacheKey;
  }

  private buildCacheKey(projectId: string | number, status?: string): string {
    const normalizedId = String(projectId);
    if (status && status.trim() !== '') {
      return `${normalizedId}::${status.trim().toLowerCase()}`;
    }
    return normalizedId;
  }

  private isExpired(timestamp: number): boolean {
    return Date.now() - timestamp > this.ttlMs;
  }
}
