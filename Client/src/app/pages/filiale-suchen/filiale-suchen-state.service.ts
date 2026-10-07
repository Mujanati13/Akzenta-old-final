import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface Filiale {
  id: string;
  name: string;
  strasse: string;
  plz: string;
  ort: string;
  phone?: string;
  projekte?: Projekt[];
}

export interface Projekt {
  id: string;
  projectId?: string;
  clientId?: string;
  branchId?: string;
  name: string;
  zeitraum: string;
  calendarWeek: string;
  status: {
    name: string;
  };
  geplant: string;
  filiale: string;
  adresse: string;
  merchandiserName?: string;
  isFavorite: boolean;
}

export interface FilialeSuchenData {
  filialen: Filiale[];
  timestamp: number;
}

export interface StoredColumn {
  field: string;
  header: string;
}

export interface FilialeSuchenViewState {
  searchQuery: string;
  filialenColumnFilterValues: { [field: string]: string[] };
  projekteColumnFilterValues: { [field: string]: string[] };
  projekteColumnFiltersByFilialeId?: { [filialeId: string]: { [field: string]: string[] } };
  sortField: string;
  sortDirection: 'asc' | 'desc';
  projektSortField: string;
  projektSortDirection: 'asc' | 'desc';
  expandedRows?: { [key: string]: boolean };
  scrollPosition?: number;
  filialeModalScrollPositionById?: { [filialeId: string]: number };
  currentPage?: number;
  pageSize?: number;
  paginationFirst?: number;
  filialenVisibleColumns?: Record<string, boolean>;
  filialenOrderedColumns?: StoredColumn[];
  selectedFilialenColumns?: StoredColumn[];
  projekteVisibleColumns?: Record<string, boolean>;
  projekteOrderedColumns?: StoredColumn[];
  selectedProjekteColumns?: StoredColumn[];
}

@Injectable({
  providedIn: 'root',
})
export class FilialeSuchenStateService {
  private readonly FILIALE_SUCHEN_DATA_STORAGE_KEY = 'headoffice_filiale_suchen_data_v1';
  private readonly FILIALE_SUCHEN_VIEW_STATE_KEY = 'headoffice_filiale_suchen_view_state_v1';
  private readonly CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

  private readonly filialeSuchenDataSubject = new BehaviorSubject<FilialeSuchenData | null>(null);
  private readonly filialeSuchenViewStateSubject = new BehaviorSubject<FilialeSuchenViewState | null>(this.loadViewStateFromStorage());

  readonly filialeSuchenData$ = this.filialeSuchenDataSubject.asObservable();
  readonly filialeSuchenViewState$ = this.filialeSuchenViewStateSubject.asObservable();

  setFilialeSuchenData(filialen: Filiale[]): void {
    if (filialen) {
      const filialeSuchenData: FilialeSuchenData = {
        filialen: filialen.map((filiale) => ({ ...filiale })),
        timestamp: Date.now(),
      };
      this.filialeSuchenDataSubject.next(filialeSuchenData);
      this.persistFilialeSuchenData(filialeSuchenData);
    }
  }

  getFilialeSuchenDataSnapshot(): FilialeSuchenData | null {
    return this.filialeSuchenDataSubject.value;
  }

  clearCache(): void {
    this.filialeSuchenDataSubject.next(null);
    if (this.hasBrowserStorageSupport()) {
      window.localStorage.removeItem(this.FILIALE_SUCHEN_DATA_STORAGE_KEY);
    }
  }

  setViewState(state: FilialeSuchenViewState): void {
    const viewState: FilialeSuchenViewState = {
      ...state,
      filialenColumnFilterValues: this.cloneColumnFilters(state.filialenColumnFilterValues),
      projekteColumnFilterValues: this.cloneColumnFilters(state.projekteColumnFilterValues),
      projekteColumnFiltersByFilialeId: state.projekteColumnFiltersByFilialeId ? JSON.parse(JSON.stringify(state.projekteColumnFiltersByFilialeId)) : undefined,
      expandedRows: state.expandedRows ? { ...state.expandedRows } : undefined,
      filialeModalScrollPositionById: state.filialeModalScrollPositionById ? { ...state.filialeModalScrollPositionById } : undefined,
      filialenVisibleColumns: state.filialenVisibleColumns ? { ...state.filialenVisibleColumns } : undefined,
      filialenOrderedColumns: state.filialenOrderedColumns?.map((column) => ({ ...column })),
      selectedFilialenColumns: state.selectedFilialenColumns?.map((column) => ({ ...column })),
      projekteVisibleColumns: state.projekteVisibleColumns ? { ...state.projekteVisibleColumns } : undefined,
      projekteOrderedColumns: state.projekteOrderedColumns?.map((column) => ({ ...column })),
      selectedProjekteColumns: state.selectedProjekteColumns?.map((column) => ({ ...column })),
    };

    this.filialeSuchenViewStateSubject.next(viewState);
    this.persistViewState(viewState);
  }

  getViewStateSnapshot(): FilialeSuchenViewState | null {
    const cached = this.loadViewStateFromStorage();
    if (cached) {
      return cached;
    }
    return this.filialeSuchenViewStateSubject.value;
  }

  clearViewState(): void {
    this.filialeSuchenViewStateSubject.next(null);
    if (this.hasBrowserStorageSupport()) {
      window.localStorage.removeItem(this.FILIALE_SUCHEN_VIEW_STATE_KEY);
    }
  }

  isCacheValid(): boolean {
    const data = this.filialeSuchenDataSubject.value;
    if (!data || !data.timestamp) {
      return false;
    }

    const age = Date.now() - data.timestamp;
    return age < this.CACHE_DURATION;
  }

  private loadFilialeSuchenDataFromStorage(): FilialeSuchenData | null {
    return null;
  }

  private persistFilialeSuchenData(data: FilialeSuchenData): void {
    void data;
    if (this.hasBrowserStorageSupport()) {
      window.localStorage.removeItem(this.FILIALE_SUCHEN_DATA_STORAGE_KEY);
    }
  }

  private loadViewStateFromStorage(): FilialeSuchenViewState | null {
    if (!this.hasBrowserStorageSupport()) {
      return null;
    }

    const raw = window.localStorage.getItem(this.FILIALE_SUCHEN_VIEW_STATE_KEY);
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as FilialeSuchenViewState;
    } catch (error) {
      console.warn('Failed to parse filiale suchen view state from storage:', error);
      return null;
    }
  }

  private persistViewState(state: FilialeSuchenViewState): void {
    if (!this.hasBrowserStorageSupport()) {
      return;
    }

    try {
      window.localStorage.setItem(this.FILIALE_SUCHEN_VIEW_STATE_KEY, JSON.stringify(state));
    } catch (error) {
      console.warn('Failed to persist filiale suchen view state:', error);
    }
  }

  private cloneColumnFilters(filters: { [field: string]: string[] } | undefined): { [field: string]: string[] } {
    return Object.keys(filters || {}).reduce<{ [field: string]: string[] }>((acc, key) => {
      acc[key] = [...(filters![key] || [])];
      return acc;
    }, {});
  }

  private hasBrowserStorageSupport(): boolean {
    return typeof window !== 'undefined' && !!window.localStorage;
  }
}
