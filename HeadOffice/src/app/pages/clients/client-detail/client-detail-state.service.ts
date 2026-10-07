import { Injectable } from '@angular/core';
import { ClientCompany } from '@app/core/services/client-company.service';
import { Subject, BehaviorSubject } from 'rxjs';

export interface StoredColumn {
  field: string;
  header: string;
}

export interface ClientDetailState {
  client?: ClientCompany;
  projects?: any[]; // Avoid circular dependency with ClientDetailComponent
  expandedRows?: { [key: string]: boolean };
  statusFilter?: string;
  clientSearchTerm?: string;
  projectSearchTerm?: string;
  filialeSearchTerm?: string;
  reportStatusFilter?: string[];
  reportMerchandiserFilter?: string[];
  reportFilialenFilter?: string[];
  reportPlannedOnFilter?: string[];
  projectNameFilter?: string[];
  projectColumnFilterValues?: { [field: string]: string[] };
  genericFilterValues?: { [field: string]: string[] };
  dateRange?: { start: Date | null; end: Date | null };
  plannedOnDateRange?: { start: Date | null; end: Date | null };
  projectsVisibleColumns?: { [key: string]: boolean };
  reportsVisibleColumns?: { [key: string]: boolean };
  projectsOrderedColumns?: StoredColumn[];
  reportsOrderedColumns?: StoredColumn[];
  selectedColumns?: StoredColumn[];
  selectedReportColumns?: StoredColumn[];
  projectSortField?: string;
  projectSortOrder?: number;
  reportSortField?: string;
  reportSortOrder?: number;
  scrollPosition?: number;
  tableScrollPosition?: number;
  reportsTableScrollPosition?: number;
  reportsTableScrollPositionByProject?: { [projectId: string]: number };
  mobileReportsSidebarScrollPositionByProject?: { [projectId: string]: number };
  defaultReportFilters?: ProjectReportFiltersState;
  projectReportFilters?: { [projectId: string]: ProjectReportFiltersState };
  sidebarVisibleProjectId?: string | null;
  timestamp?: number;
}

export interface ProjectReportFiltersState {
  status: string[];
  merchandiser: string[];
  filialen: string[];
  plannedOn: string[];
  generic: { [field: string]: string[] };
}

@Injectable({
  providedIn: 'root',
})
export class ClientDetailStateService {
  private readonly STORAGE_KEY_PREFIX = 'client_detail_state_';
  private readonly CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

  // Flag to prevent saving state during specific navigations (e.g. sidebar click)
  public preventSave = false;

  private resetSubject = new Subject<number>();
  public reset$ = this.resetSubject.asObservable();

  // Observable to notify when expandedRows changes (for sidebar updates)
  private expandedRowsChangeSubject = new BehaviorSubject<{ clientId: number; expandedRows: { [key: string]: boolean } } | null>(null);
  public expandedRowsChange$ = this.expandedRowsChangeSubject.asObservable();

  requestReset(clientId: number): void {
    this.resetSubject.next(clientId);
  }

  saveState(clientId: number, state: ClientDetailState): void {
    if (!clientId) return;

    const stateToSave: ClientDetailState = {
      ...state,
      projectReportFilters: state.projectReportFilters,
      timestamp: Date.now(),
    };

    try {
      localStorage.setItem(
        this.getStorageKey(clientId),
        JSON.stringify({
          ...stateToSave,
          client: undefined,
          projects: undefined,
        } satisfies ClientDetailState),
      );
      // Notify about expandedRows change (for sidebar updates)
      this.expandedRowsChangeSubject.next({
        clientId,
        expandedRows: state.expandedRows || {},
      });
    } catch (e) {
      console.warn('Failed to save client detail state', e);
    }
  }

  getState(clientId: number): ClientDetailState | null {
    if (!clientId) return null;

    try {
      const raw = localStorage.getItem(this.getStorageKey(clientId));
      if (!raw) return null;

      const state = JSON.parse(raw) as ClientDetailState;

      // Restore Date objects
      if (state.dateRange) {
        if (state.dateRange.start) state.dateRange.start = new Date(state.dateRange.start);
        if (state.dateRange.end) state.dateRange.end = new Date(state.dateRange.end);
      }
      if (state.plannedOnDateRange) {
        if (state.plannedOnDateRange.start) state.plannedOnDateRange.start = new Date(state.plannedOnDateRange.start);
        if (state.plannedOnDateRange.end) state.plannedOnDateRange.end = new Date(state.plannedOnDateRange.end);
      }

      return state;
    } catch (e) {
      console.warn('Failed to load client detail state', e);
      return null;
    }
  }

  clearState(clientId: number): void {
    if (!clientId) return;
    localStorage.removeItem(this.getStorageKey(clientId));
  }

  resetViewState(clientId: number): void {
    const currentState = this.getState(clientId);
    if (!currentState) return;

    const newState: ClientDetailState = {
      timestamp: Date.now(), // Refresh timestamp
      // Explicitly reset everything else
      expandedRows: {},
      statusFilter: '',
      clientSearchTerm: '',
      projectSearchTerm: '',
      filialeSearchTerm: '',
      reportStatusFilter: [],
      reportMerchandiserFilter: [],
      reportFilialenFilter: [],
      reportPlannedOnFilter: [],
      projectNameFilter: [],
      projectColumnFilterValues: {},
      genericFilterValues: {},
      dateRange: { start: null, end: null },
      plannedOnDateRange: { start: null, end: null },
      // We reset sort and scroll too
      projectSortField: undefined,
      projectSortOrder: undefined,
      reportSortField: undefined,
      reportSortOrder: undefined,
      scrollPosition: 0,
      tableScrollPosition: 0,
      reportsTableScrollPosition: 0,
      reportsTableScrollPositionByProject: {},
      mobileReportsSidebarScrollPositionByProject: {},
      // We leave column configuration undefined so it falls back to default
    };

    this.saveState(clientId, newState);
  }

  isCacheValid(clientId: number): boolean {
    const state = this.getState(clientId);
    if (!state || !state.timestamp) return false;
    return Date.now() - state.timestamp < this.CACHE_DURATION;
  }

  private getStorageKey(clientId: number): string {
    return `${this.STORAGE_KEY_PREFIX}${clientId}`;
  }
}
