import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface AnfragenData {
  projects: any[];
  timestamp: number;
}

@Injectable({
  providedIn: 'root',
})
export class AnfragenStateService {
  private readonly ANFRAGEN_DATA_STORAGE_KEY = 'merchandiser_anfragen_data_v1';
  private readonly CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

  private readonly anfragenDataSubject = new BehaviorSubject<AnfragenData | null>(null);

  readonly anfragenData$ = this.anfragenDataSubject.asObservable();

  setAnfragenData(projects: any[]): void {
    if (projects) {
      const anfragenData: AnfragenData = {
        projects: projects.map((project) => ({ ...project })),
        timestamp: Date.now(),
      };
      this.anfragenDataSubject.next(anfragenData);
      this.persistAnfragenData(anfragenData);
    }
  }

  getAnfragenDataSnapshot(): AnfragenData | null {
    return this.anfragenDataSubject.value;
  }

  clearCache(): void {
    this.anfragenDataSubject.next(null);
    if (this.hasBrowserStorageSupport()) {
      window.localStorage.removeItem(this.ANFRAGEN_DATA_STORAGE_KEY);
    }
  }

  isCacheValid(): boolean {
    const data = this.anfragenDataSubject.value;
    if (!data || !data.timestamp) {
      return false;
    }

    const age = Date.now() - data.timestamp;
    return age < this.CACHE_DURATION;
  }

  private loadAnfragenDataFromStorage(): AnfragenData | null {
    return null;
  }

  private persistAnfragenData(data: AnfragenData): void {
    void data;
  }

  private hasBrowserStorageSupport(): boolean {
    return typeof window !== 'undefined' && !!window.localStorage;
  }
}
