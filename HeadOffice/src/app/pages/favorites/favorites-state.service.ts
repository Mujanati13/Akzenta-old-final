import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { FavoritesResponse, FavoriteClientCompany, FavoriteReport, FavoriteProject } from '@app/core/services/favorites.service';

interface ReportCounts {
  newReports: number;
  ongoingReports: number;
  completedReports: number;
}

export interface FavoriteClientCompanyWithCounts extends FavoriteClientCompany {
  isMyClient: boolean;
  reportCounts?: ReportCounts;
}

export interface FavoritesData {
  favoriteClientCompanies: FavoriteClientCompanyWithCounts[];
  favoriteReports: FavoriteReport[];
  favoriteProjects: FavoriteProject[];
  scrollPosition?: number;
  timestamp: number;
}

@Injectable({
  providedIn: 'root',
})
export class FavoritesStateService {
  private readonly FAVORITES_DATA_STORAGE_KEY = 'favorites_data_v1';
  private readonly CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

  private readonly favoritesDataSubject = new BehaviorSubject<FavoritesData | null>(null);

  readonly favoritesData$ = this.favoritesDataSubject.asObservable();

  saveState(state: Partial<FavoritesData>): void {
    const currentState = this.favoritesDataSubject.value || {
      favoriteClientCompanies: [],
      favoriteReports: [],
      favoriteProjects: [],
      timestamp: Date.now(),
    };

    const newState: FavoritesData = {
      ...currentState,
      ...state,
      timestamp: Date.now(),
    };
    this.favoritesDataSubject.next(newState);
    this.persistFavoritesData(newState);
  }

  getFavoritesDataSnapshot(): FavoritesData | null {
    const cached = this.loadFavoritesDataFromStorage();
    if (cached) {
      return cached;
    }
    return this.favoritesDataSubject.value;
  }

  clearCache(): void {
    this.favoritesDataSubject.next(null);
    if (this.hasBrowserStorageSupport()) {
      window.localStorage.removeItem(this.FAVORITES_DATA_STORAGE_KEY);
    }
  }

  isCacheValid(): boolean {
    const data = this.favoritesDataSubject.value || this.loadFavoritesDataFromStorage();
    if (!data || !data.timestamp) {
      return false;
    }

    const age = Date.now() - data.timestamp;
    return age < this.CACHE_DURATION;
  }

  private loadFavoritesDataFromStorage(): FavoritesData | null {
    if (!this.hasBrowserStorageSupport()) {
      return null;
    }

    const raw = window.localStorage.getItem(this.FAVORITES_DATA_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    try {
      const data = JSON.parse(raw) as FavoritesData;
      // Check if cache is still valid
      const age = Date.now() - data.timestamp;
      if (age < this.CACHE_DURATION) {
        return data;
      } else {
        // Cache expired, clear it
        window.localStorage.removeItem(this.FAVORITES_DATA_STORAGE_KEY);
        return null;
      }
    } catch (error) {
      console.warn('Failed to parse favorites data from storage:', error);
      return null;
    }
  }

  private persistFavoritesData(data: FavoritesData): void {
    if (!this.hasBrowserStorageSupport()) {
      return;
    }

    try {
      window.localStorage.setItem(
        this.FAVORITES_DATA_STORAGE_KEY,
        JSON.stringify({
          ...data,
          favoriteClientCompanies: [],
          favoriteReports: [],
          favoriteProjects: [],
        } satisfies FavoritesData),
      );
    } catch (error) {
      console.warn('Failed to persist favorites data:', error);
    }
  }

  private hasBrowserStorageSupport(): boolean {
    return typeof window !== 'undefined' && !!window.localStorage;
  }
}
