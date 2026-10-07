import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface Project {
  _displayedFilialen?: number; // Cache for displayed filialen count based on filtered reports
  _reportCanFilter?: { [field: string]: boolean };
  _reportFilterCounts?: { [field: string]: number };
  id?: string;
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
  startDate?: Date | string; // Project start date
  endDate?: Date | string; // Project end date
  _reportFilters?: ProjectReportFilters; // Per-project report column filters
  questions?: ProjectQuestion[];
}

export interface ProjectQuestion {
  id: number;
  questionText: string;
  showInOverview?: boolean;
  isVisibleToClient?: boolean;
  createdAt?: string;
  answerType?: { name?: string };
}

export interface ProjectReportFilters {
  status: string[];
  merchandiser: string[];
  filialen: string[];
  plannedOn: string[];
  generic: { [field: string]: string[] };
}

export interface StoredColumn {
  field: string;
  header: string;
}

export interface ProjectsState {
  projects?: Project[];
  expandedRows?: { [key: string]: boolean };
  activeFilter?: 'all' | 'running' | 'completed';
  projectSearchTerm?: string;
  filialeSearchTerm?: string;
  statusFilter?: string; // Status filter from query params (persists until "Zurücksetzen" is clicked)

  // Global report filters (if applied globally) or default for new projects
  reportStatusFilter?: string[];
  reportMerchandiserFilter?: string[];
  reportFilialenFilter?: string[];
  reportPlannedOnFilter?: string[];

  // Project list filters
  projectColumnFilterValues?: { [field: string]: string[] };
  genericFilterValues?: { [field: string]: string[] }; // For project list generic filters if any

  dateRange?: { start: Date | null; end: Date | null };

  // Column settings
  projectsVisibleColumns?: { [key: string]: boolean };
  reportsVisibleColumns?: { [key: string]: boolean };
  projectsOrderedColumns?: StoredColumn[];
  reportsOrderedColumns?: StoredColumn[];
  selectedColumns?: StoredColumn[];
  selectedReportColumns?: StoredColumn[];

  // Sort settings
  projectSortField?: string;
  projectSortOrder?: number;
  reportSortField?: string;
  reportSortOrder?: number;

  // Per-project filters map
  projectReportFilters?: { [projectId: string]: ProjectReportFilters };

  // Scroll positions
  reportsTableScrollPosition?: number;
  projectsTableScrollPosition?: number;

  timestamp?: number;
}

@Injectable({
  providedIn: 'root',
})
export class ProjectsStateService {
  private readonly PROJECTS_STATE_STORAGE_KEY = 'client_projects_state_v2';
  private readonly CACHE_DURATION = 30 * 60 * 1000; // 30 minutes
  public preventSave = false;

  private readonly projectsStateSubject = new BehaviorSubject<ProjectsState | null>(null);

  readonly projectsState$ = this.projectsStateSubject.asObservable();

  setState(state: ProjectsState): void {
    const newState: ProjectsState = {
      ...this.projectsStateSubject.value,
      ...state,
      timestamp: Date.now(),
    };

    this.projectsStateSubject.next(newState);
    this.persistState(newState);
  }

  getStateSnapshot(): ProjectsState | null {
    const cached = this.loadStateFromStorage();
    if (cached) {
      // Update subject if it was null (first load)
      if (!this.projectsStateSubject.value) {
        this.projectsStateSubject.next(cached);
      }
      return cached;
    }
    return this.projectsStateSubject.value;
  }

  clearCache(): void {
    this.projectsStateSubject.next(null);
    if (this.hasBrowserStorageSupport()) {
      window.sessionStorage.removeItem(this.PROJECTS_STATE_STORAGE_KEY);
    }
  }

  isCacheValid(): boolean {
    const data = this.loadStateFromStorage();
    if (!data || !data.timestamp) {
      return false;
    }

    const age = Date.now() - data.timestamp;
    return age < this.CACHE_DURATION;
  }

  private loadStateFromStorage(): ProjectsState | null {
    if (!this.hasBrowserStorageSupport()) {
      return null;
    }

    const raw = window.sessionStorage.getItem(this.PROJECTS_STATE_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    try {
      const state = JSON.parse(raw) as ProjectsState;
      const age = Date.now() - (state.timestamp || 0);

      // Check validity
      if (age >= this.CACHE_DURATION) {
        window.sessionStorage.removeItem(this.PROJECTS_STATE_STORAGE_KEY);
        return null;
      }

      // Restore Date objects
      if (state.dateRange) {
        if (state.dateRange.start) state.dateRange.start = new Date(state.dateRange.start);
        if (state.dateRange.end) state.dateRange.end = new Date(state.dateRange.end);
      }

      return state;
    } catch (error) {
      console.warn('Failed to parse projects state from storage:', error);
      return null;
    }
  }

  private persistState(state: ProjectsState): void {
    if (!this.hasBrowserStorageSupport()) {
      return;
    }

    try {
      window.sessionStorage.setItem(
        this.PROJECTS_STATE_STORAGE_KEY,
        JSON.stringify({
          ...state,
          projects: [],
        } satisfies ProjectsState),
      );
    } catch (error) {
      console.warn('Failed to persist projects state:', error);
    }
  }

  private hasBrowserStorageSupport(): boolean {
    return typeof window !== 'undefined' && !!window.sessionStorage;
  }
}
