import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface ClientDetailProject {
  id?: string | number;
  name?: string;
  zeitraum?: string;
  calendarWeek?: string;
  filialen?: number;
  branchesCount?: number;
  status?: string;
  isFavorite?: boolean;
  reports?: any[];
  slug?: string;
  clientId?: string;
  clientName?: string;
  reportedPercentage?: number;
}

// Minimal client payload to gate template rendering when restored from cache
export interface ClientDetailClient {
  id?: string | number;
  name?: string;
  logo?: any;
  slug?: string;
}

export interface ClientDetailData {
  clientId?: string | number;
  client?: ClientDetailClient | null;
  projects: ClientDetailProject[];
  timestamp: number;
}

export interface ProjectReportFiltersState {
  status: string[];
  merchandiser: string[];
  filialen: string[];
  plannedOn: string[];
  reportTo?: string[];
  generic: { [field: string]: string[] };
}

export interface ClientDetailState {
  client?: ClientDetailClient | null;
  projects?: ClientDetailProject[];
  expandedRows?: { [key: string]: boolean };
  /** Mobile full-screen Aufträge sidebar: which project id is open */
  sidebarVisibleProjectId?: string | null;
  /** Mobile reports sidebar scroll position per project */
  mobileReportsSidebarScrollPositionByProject?: { [projectId: string]: number };
  statusFilter?: string;
  projectSearchTerm?: string;
  filialeSearchTerm?: string;
  reportStatusFilter?: string[];
  reportMerchandiserFilter?: string[];
  reportFilialenFilter?: string[];
  reportPlannedOnFilter?: string[];
  reportToFilter?: string[];
  projectColumnFilters?: { [key: string]: string[] };
  genericFilterValues?: { [field: string]: string[] };
  dateRange2?: { start: Date | null; end: Date | null };
  projectsVisibleColumns?: { [key: string]: boolean };
  reportsVisibleColumns?: { [key: string]: boolean };
  projectsOrderedColumns?: { field: string; header: string }[];
  reportsOrderedColumns?: { field: string; header: string }[];
  selectedColumns?: { field: string; header: string }[];
  selectedReportColumns?: { field: string; header: string }[];
  projectSortField?: string;
  projectSortOrder?: number;
  reportSortField?: string;
  reportSortOrder?: number;
  defaultReportFilters?: ProjectReportFiltersState;
  projectReportFilters?: { [projectId: string]: ProjectReportFiltersState };
  timestamp?: number;
}

@Injectable({
  providedIn: 'root',
})
export class ClientDetailStateService {
  private readonly CLIENT_DETAIL_DATA_STORAGE_KEY = 'merchandiser_client_detail_data_v1';
  private readonly CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

  private readonly clientDetailDataSubject = new BehaviorSubject<ClientDetailData | null>(null);

  readonly clientDetailData$ = this.clientDetailDataSubject.asObservable();
  private expandedRowsChangeSubject = new BehaviorSubject<{ clientId: number; expandedRows: { [key: string]: boolean } } | null>(null);
  readonly expandedRowsChange$ = this.expandedRowsChangeSubject.asObservable();

  setClientDetailData(projects: ClientDetailProject[], client?: ClientDetailClient | null): void {
    if (projects) {
      const clientId = client?.id ?? projects?.[0]?.clientId ?? null;
      const clientPayload = client ? { id: client.id, name: client.name, logo: (client as any).logo ?? client.logo, slug: (client as any).slug ?? client.slug } : null;

      const clientDetailData: ClientDetailData = {
        clientId: clientId ?? undefined,
        client: clientPayload,
        projects: projects.map((project) => ({ ...project })),
        timestamp: Date.now(),
      };
      this.clientDetailDataSubject.next(clientDetailData);
      this.persistClientDetailData(clientDetailData);
    }
  }

  getClientDetailDataSnapshot(expectedClientId?: string | number): ClientDetailData | null {
    const inMemory = this.clientDetailDataSubject.value;
    if (inMemory && (!expectedClientId || inMemory.clientId == expectedClientId)) {
      return inMemory;
    }

    return null;
  }

  clearCache(): void {
    this.clientDetailDataSubject.next(null);
    if (this.hasBrowserStorageSupport()) {
      window.localStorage.removeItem(this.CLIENT_DETAIL_DATA_STORAGE_KEY);
    }
  }

  isCacheValid(): boolean {
    const data = this.clientDetailDataSubject.value;
    if (!data || !data.timestamp) {
      return false;
    }

    const age = Date.now() - data.timestamp;
    return age < this.CACHE_DURATION;
  }

  private loadClientDetailDataFromStorage(): ClientDetailData | null {
    return null;
  }

  private persistClientDetailData(data: ClientDetailData): void {
    void data;
  }

  private hasBrowserStorageSupport(): boolean {
    return typeof window !== 'undefined' && !!window.localStorage;
  }

  // Filter state management methods
  private readonly FILTER_STATE_KEY_PREFIX = 'merchandiser_client_detail_filters_';

  saveFilterState(clientId: number, state: ClientDetailState): void {
    if (!clientId) return;

    const stateToSave: ClientDetailState = {
      ...state,
      timestamp: Date.now(),
    };

    try {
      localStorage.setItem(this.getFilterStorageKey(clientId), JSON.stringify(stateToSave));
      this.expandedRowsChangeSubject.next({
        clientId,
        expandedRows: state.expandedRows || {},
      });
    } catch (e) {
      console.warn('Failed to save client detail filter state', e);
    }
  }

  getFilterState(clientId: number): ClientDetailState | null {
    if (!clientId) return null;

    try {
      const raw = localStorage.getItem(this.getFilterStorageKey(clientId));
      if (!raw) return null;

      const state = JSON.parse(raw) as ClientDetailState;

      // Restore Date objects
      if (state.dateRange2) {
        if (state.dateRange2.start) state.dateRange2.start = new Date(state.dateRange2.start);
        if (state.dateRange2.end) state.dateRange2.end = new Date(state.dateRange2.end);
      }

      // Check if cache is still valid
      if (state.timestamp && Date.now() - state.timestamp < this.CACHE_DURATION) {
        return state;
      } else {
        // Cache expired, remove it
        localStorage.removeItem(this.getFilterStorageKey(clientId));
        return null;
      }
    } catch (e) {
      console.warn('Failed to load client detail filter state', e);
      return null;
    }
  }

  clearFilterState(clientId: number): void {
    if (!clientId) return;
    localStorage.removeItem(this.getFilterStorageKey(clientId));
  }

  isFilterStateValid(clientId: number): boolean {
    const state = this.getFilterState(clientId);
    return state !== null;
  }

  private getFilterStorageKey(clientId: number): string {
    return `${this.FILTER_STATE_KEY_PREFIX}${clientId}`;
  }
}
