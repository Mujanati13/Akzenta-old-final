import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface AllEntriesFilterState {
  projectSearchTerm: string;
  filialeSearchTerm: string;
  dateRange2: { start: Date | null; end: Date | null };
  reportStatusFilter: string[];
  reportMerchandiserFilter: string[];
  reportFilialenFilter: string[];
  genericFilterValues: { [field: string]: string[] };
  scrollPosition?: number;
  tableScrollPosition?: number;
  mobileListScrollPosition?: number;
}

export interface AllEntriesData {
  reports: any[];
  timestamp: number;
  filterState?: AllEntriesFilterState;
}

@Injectable({
  providedIn: 'root',
})
export class AllEntriesStateService {
  private readonly ALL_ENTRIES_DATA_STORAGE_KEY = 'merchandiser_all_entries_data_v1';
  private readonly CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

  private readonly allEntriesDataSubject = new BehaviorSubject<AllEntriesData | null>(null);

  readonly allEntriesData$ = this.allEntriesDataSubject.asObservable();

  setAllEntriesData(reports: any[]): void {
    if (reports) {
      const allEntriesData: AllEntriesData = {
        reports: reports.map((report) => ({ ...report })),
        timestamp: Date.now(),
      };
      this.allEntriesDataSubject.next(allEntriesData);
      this.persistAllEntriesData(allEntriesData);
    }
  }

  getAllEntriesDataSnapshot(): AllEntriesData | null {
    const cached = this.loadAllEntriesDataFromStorage();
    if (cached) {
      return cached;
    }
    return this.allEntriesDataSubject.value;
  }

  clearCache(): void {
    this.allEntriesDataSubject.next(null);
    if (this.hasBrowserStorageSupport()) {
      window.localStorage.removeItem(this.ALL_ENTRIES_DATA_STORAGE_KEY);
    }
  }

  isCacheValid(): boolean {
    const data = this.loadAllEntriesDataFromStorage();
    if (!data || !data.timestamp) {
      return false;
    }

    const age = Date.now() - data.timestamp;
    return age < this.CACHE_DURATION;
  }

  private loadAllEntriesDataFromStorage(): AllEntriesData | null {
    if (!this.hasBrowserStorageSupport()) {
      return null;
    }

    const raw = window.localStorage.getItem(this.ALL_ENTRIES_DATA_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    try {
      const data = JSON.parse(raw) as AllEntriesData;
      const age = Date.now() - data.timestamp;
      if (age < this.CACHE_DURATION) {
        return {
          ...data,
          reports: [],
        };
      } else {
        window.localStorage.removeItem(this.ALL_ENTRIES_DATA_STORAGE_KEY);
        return null;
      }
    } catch (error) {
      console.warn('Failed to parse all entries data from storage:', error);
      return null;
    }
  }

  private persistAllEntriesData(data: AllEntriesData): void {
    if (!this.hasBrowserStorageSupport()) {
      return;
    }

    try {
      window.localStorage.setItem(
        this.ALL_ENTRIES_DATA_STORAGE_KEY,
        JSON.stringify({
          ...data,
          reports: [],
        } satisfies AllEntriesData),
      );
    } catch (error) {
      console.warn('Failed to persist all entries data:', error);
    }
  }

  private hasBrowserStorageSupport(): boolean {
    return typeof window !== 'undefined' && !!window.localStorage;
  }

  /**
   * Save filter state
   */
  setFilterState(filterState: AllEntriesFilterState): void {
    const currentData = this.getAllEntriesDataSnapshot();
    if (currentData) {
      currentData.filterState = filterState;
      this.allEntriesDataSubject.next(currentData);
      this.persistAllEntriesData(currentData);
    } else {
      // If no data exists, create a minimal entry just for filter state
      const data: AllEntriesData = {
        reports: [],
        timestamp: Date.now(),
        filterState: filterState,
      };
      this.allEntriesDataSubject.next(data);
      this.persistAllEntriesData(data);
    }
  }

  /**
   * Get filter state
   */
  getFilterState(): AllEntriesFilterState | null {
    const data = this.getAllEntriesDataSnapshot();
    return data?.filterState || null;
  }
}
