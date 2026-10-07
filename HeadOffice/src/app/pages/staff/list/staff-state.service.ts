import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface StaffData {
  id?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  address?: string;
  postalCode?: string;
  city?: string;
  country?: string;
  distance?: string;
  qualifications?: string[];
  dateOfBirth?: string;
  status?: string;
  portrait?: {
    id?: string;
    path?: string;
  };
  isFavorite?: boolean;
  location?: { lat: number; lng: number };
  clientCompanies?: { id: number; name: string }[];
}

export interface StaffStateData {
  allStaffData: StaffData[];
  totalItems: number;
  searchParams?: any;
  showMobileFilters?: boolean;
  viewMode?: 'table' | 'map' | 'grid';
  scrollPosition?: number;
  pageSize?: number;
  currentPage?: number;
  first?: number;
  selectedQualification?: string[] | string | null;
  selectedStatus?: string | null;
  referenceLocation?: { lat: number; lng: number } | null;
  gridFilters?: {
    firstName: string;
    lastName: string;
    address: string;
    country: string;
    distance: string;
    qualifications: Record<string, boolean>;
    status: Record<string, boolean>;
  };
  staffColumnFilters?: { [key: string]: string[] };
  mapFilters?: {
    qualifications: Record<string, boolean>;
    status: Record<string, boolean>;
  };
  timestamp: number;
}

@Injectable({
  providedIn: 'root',
})
export class StaffStateService {
  private readonly STORAGE_KEY = 'staff_data_cache_v1';
  private readonly CACHE_DURATION = 30 * 60 * 1000; // 30 minutes cache

  private readonly staffDataSubject = new BehaviorSubject<StaffStateData | null>(null);
  readonly staffData$ = this.staffDataSubject.asObservable();

  constructor() {
    this.loadFromStorage();
  }

  saveState(state: Partial<StaffStateData>): void {
    const currentState = this.staffDataSubject.value || {
      allStaffData: [],
      totalItems: 0,
      timestamp: Date.now(),
    };

    const newState: StaffStateData = {
      ...currentState,
      ...state,
      timestamp: Date.now(),
    };
    this.staffDataSubject.next(newState);
    this.persistToStorage(newState);
  }

  getStaffDataSnapshot(): StaffStateData | null {
    const data = this.staffDataSubject.value;
    if (!data || !this.isDataCacheValid(data)) {
      return null;
    }
    return data;
  }

  clearCache(): void {
    this.staffDataSubject.next(null);
    if (this.hasBrowserStorageSupport()) {
      window.localStorage.removeItem(this.STORAGE_KEY);
    }
  }

  isCacheValid(): boolean {
    const data = this.staffDataSubject.value || this.loadDataFromStorage();
    if (!data || !data.timestamp) {
      return false;
    }
    const age = Date.now() - data.timestamp;
    return age < this.CACHE_DURATION;
  }

  private isDataCacheValid(data: StaffStateData): boolean {
    const age = Date.now() - data.timestamp;
    return age < this.CACHE_DURATION;
  }

  private loadDataFromStorage(): StaffStateData | null {
    if (!this.hasBrowserStorageSupport()) {
      return null;
    }

    const raw = window.localStorage.getItem(this.STORAGE_KEY);
    if (!raw) {
      return null;
    }

    try {
      const data = JSON.parse(raw) as StaffStateData;
      return data;
    } catch (error) {
      return null;
    }
  }

  private loadFromStorage(): void {
    if (!this.hasBrowserStorageSupport()) {
      return;
    }

    const raw = window.localStorage.getItem(this.STORAGE_KEY);
    if (!raw) {
      return;
    }

    try {
      const data = JSON.parse(raw) as StaffStateData;
      if (this.isDataCacheValid(data)) {
        this.staffDataSubject.next(data);
      } else {
        // Cache expired, clear it
        this.clearCache();
      }
    } catch (error) {
      console.warn('Failed to parse staff data from storage:', error);
      this.clearCache();
    }
  }

  private persistToStorage(data: StaffStateData): void {
    if (!this.hasBrowserStorageSupport()) {
      return;
    }

    try {
      // Do not persist full staff datasets in localStorage. Keep only lightweight UI state.
      const { allStaffData, ...lightweightState } = data;
      window.localStorage.setItem(
        this.STORAGE_KEY,
        JSON.stringify({
          ...lightweightState,
          allStaffData: [],
          totalItems: 0,
        }),
      );
    } catch (error) {
      console.warn('Failed to persist staff data:', error);
    }
  }

  private hasBrowserStorageSupport(): boolean {
    return typeof window !== 'undefined' && !!window.localStorage;
  }
}
