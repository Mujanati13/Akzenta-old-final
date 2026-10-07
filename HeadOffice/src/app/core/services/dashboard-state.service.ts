import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { DashboardData } from './dashboard.service';

export interface StoredColumn {
  field: string;
  header: string;
}

export interface DashboardViewState {
  newReportsColumnFilters: Record<string, string[]>;
  rejectedReportsColumnFilters: Record<string, string[]>;
  sortField: string;
  sortOrder: number;
  overdueSortField: string;
  overdueSortOrder: number;
  newProductsVisibleColumns: Record<string, boolean>;
  overdueProductsVisibleColumns: Record<string, boolean>;
  newProductsOrderedColumns: StoredColumn[];
  overdueProductsOrderedColumns: StoredColumn[];
  scrollPosition?: number;
  newReportsTableScrollPosition?: number;
  rejectedReportsTableScrollPosition?: number;
}

@Injectable({
  providedIn: 'root',
})
export class DashboardStateService {
  private readonly VIEW_STATE_STORAGE_KEY = 'dashboard_view_state_v2';
  private readonly dashboardDataSubject = new BehaviorSubject<DashboardData | null>(null);
  private readonly viewStateSubject = new BehaviorSubject<DashboardViewState | null>(this.loadViewStateFromStorage());

  readonly dashboardData$ = this.dashboardDataSubject.asObservable();
  readonly viewState$ = this.viewStateSubject.asObservable();

  setDashboardData(data: DashboardData | null): void {
    this.dashboardDataSubject.next(data);
  }

  getDashboardDataSnapshot(): DashboardData | null {
    return this.dashboardDataSubject.value;
  }

  saveViewState(state: DashboardViewState): void {
    const clonedState = this.cloneState(state);
    this.viewStateSubject.next(clonedState);
    this.persistViewState(clonedState);
  }

  getViewStateSnapshot(): DashboardViewState | null {
    const state = this.viewStateSubject.value;
    return state ? this.cloneState(state) : null;
  }

  clearCache(): void {
    this.dashboardDataSubject.next(null);
  }

  clearViewState(): void {
    this.viewStateSubject.next(null);
    if (this.hasBrowserStorageSupport()) {
      window.localStorage.removeItem(this.VIEW_STATE_STORAGE_KEY);
    }
  }

  clearSessionState(): void {
    this.clearCache();
    this.clearViewState();
  }

  private loadViewStateFromStorage(): DashboardViewState | null {
    if (!this.hasBrowserStorageSupport()) {
      return null;
    }

    const raw = window.localStorage.getItem(this.VIEW_STATE_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw);
    } catch (error) {
      console.warn('Failed to parse dashboard view state from storage:', error);
      return null;
    }
  }

  private persistViewState(state: DashboardViewState): void {
    if (!this.hasBrowserStorageSupport()) {
      return;
    }

    try {
      window.localStorage.setItem(this.VIEW_STATE_STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.warn('Failed to persist dashboard view state:', error);
    }
  }

  private cloneState(state: DashboardViewState): DashboardViewState {
    return {
      ...state,
      newReportsColumnFilters: this.cloneFilters(state.newReportsColumnFilters),
      rejectedReportsColumnFilters: this.cloneFilters(state.rejectedReportsColumnFilters),
      newProductsVisibleColumns: { ...state.newProductsVisibleColumns },
      overdueProductsVisibleColumns: { ...state.overdueProductsVisibleColumns },
      newProductsOrderedColumns: state.newProductsOrderedColumns.map((column) => ({ ...column })),
      overdueProductsOrderedColumns: state.overdueProductsOrderedColumns.map((column) => ({ ...column })),
      scrollPosition: state.scrollPosition,
      newReportsTableScrollPosition: state.newReportsTableScrollPosition,
      rejectedReportsTableScrollPosition: state.rejectedReportsTableScrollPosition,
    };
  }

  private cloneFilters(filters: Record<string, string[]>): Record<string, string[]> {
    return Object.keys(filters || {}).reduce<Record<string, string[]>>((acc, key) => {
      acc[key] = [...(filters[key] || [])];
      return acc;
    }, {});
  }

  private hasBrowserStorageSupport(): boolean {
    return typeof window !== 'undefined' && !!window.localStorage;
  }
}
