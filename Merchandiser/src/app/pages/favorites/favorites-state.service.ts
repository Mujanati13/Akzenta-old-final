import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface FavoritesData {
  favoriteProjects: any[];
  favoriteReports: any[];
  timestamp: number;
}

@Injectable({
  providedIn: 'root',
})
export class FavoritesStateService {
  private readonly FAVORITES_DATA_STORAGE_KEY = 'merchandiser_favorites_data_v1';
  private readonly CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

  private readonly favoritesDataSubject = new BehaviorSubject<FavoritesData | null>(null);

  readonly favoritesData$ = this.favoritesDataSubject.asObservable();

  setFavoritesData(data: { favoriteProjects: any[]; favoriteReports: any[] }): void {
    if (data) {
      const favoritesData: FavoritesData = {
        favoriteProjects: data.favoriteProjects.map((project) => ({ ...project })),
        favoriteReports: data.favoriteReports.map((report) => ({ ...report })),
        timestamp: Date.now(),
      };
      this.favoritesDataSubject.next(favoritesData);
      this.persistFavoritesData(favoritesData);
    }
  }

  getFavoritesDataSnapshot(): FavoritesData | null {
    return this.favoritesDataSubject.value;
  }

  clearCache(): void {
    this.favoritesDataSubject.next(null);
    if (this.hasBrowserStorageSupport()) {
      window.localStorage.removeItem(this.FAVORITES_DATA_STORAGE_KEY);
    }
  }

  isCacheValid(): boolean {
    const data = this.favoritesDataSubject.value;
    if (!data || !data.timestamp) {
      return false;
    }

    const age = Date.now() - data.timestamp;
    return age < this.CACHE_DURATION;
  }

  private loadFavoritesDataFromStorage(): FavoritesData | null {
    return null;
  }

  private persistFavoritesData(data: FavoritesData): void {
    void data;
  }

  private hasBrowserStorageSupport(): boolean {
    return typeof window !== 'undefined' && !!window.localStorage;
  }
}
