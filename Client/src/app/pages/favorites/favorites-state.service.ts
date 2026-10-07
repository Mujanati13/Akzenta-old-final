import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { FavoriteReport } from '@app/@core/services/favorites.service';

export interface ProjectItem {
  id: number;
  isFavorite: boolean;
  name: string;
  slug?: string;
  dateRange: string;
  weekNumber: string;
  status: 'running' | 'completed';
  stats: {
    new: number;
    open: number;
    completed: number;
  };
}

export interface FavoritesData {
  favoriteProjects: ProjectItem[];
  favoriteReports: FavoriteReport[];
  timestamp: number;
}

@Injectable({
  providedIn: 'root',
})
export class FavoritesStateService {
  private readonly FAVORITES_DATA_STORAGE_KEY = 'client_favorites_data_v1';
  private readonly CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

  private readonly favoritesDataSubject = new BehaviorSubject<FavoritesData | null>(null);

  readonly favoritesData$ = this.favoritesDataSubject.asObservable();

  setFavoritesData(favoriteProjects: ProjectItem[], favoriteReports: FavoriteReport[]): void {
    if (favoriteProjects || favoriteReports) {
      const favoritesData: FavoritesData = {
        favoriteProjects: favoriteProjects.map((project) => ({ ...project })),
        favoriteReports: favoriteReports.map((report) => ({ ...report })),
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
      window.sessionStorage.removeItem(this.FAVORITES_DATA_STORAGE_KEY);
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
    return typeof window !== 'undefined' && !!window.sessionStorage;
  }
}
