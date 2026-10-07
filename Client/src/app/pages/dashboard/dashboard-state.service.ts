import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { DashboardProject } from '@app/core/services/dashboard.service';

export interface DashboardData {
  projects: DashboardProject[];
  timestamp: number;
}

@Injectable({
  providedIn: 'root',
})
export class DashboardStateService {
  private readonly DASHBOARD_DATA_STORAGE_KEY = 'client_dashboard_data_v1';
  private readonly CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

  private readonly dashboardDataSubject = new BehaviorSubject<DashboardData | null>(null);

  readonly dashboardData$ = this.dashboardDataSubject.asObservable();

  setDashboardData(projects: DashboardProject[]): void {
    if (projects) {
      const dashboardData: DashboardData = {
        projects: projects.map((project) => ({ ...project })), // Deep copy
        timestamp: Date.now(),
      };
      this.dashboardDataSubject.next(dashboardData);
      this.persistDashboardData(dashboardData);
    }
  }

  getDashboardDataSnapshot(): DashboardData | null {
    return this.dashboardDataSubject.value;
  }

  clearCache(): void {
    this.dashboardDataSubject.next(null);
    if (this.hasBrowserStorageSupport()) {
      window.sessionStorage.removeItem(this.DASHBOARD_DATA_STORAGE_KEY);
    }
  }

  isCacheValid(): boolean {
    const data = this.dashboardDataSubject.value;
    if (!data || !data.timestamp) {
      return false;
    }

    const age = Date.now() - data.timestamp;
    return age < this.CACHE_DURATION;
  }

  private loadDashboardDataFromStorage(): DashboardData | null {
    return null;
  }

  private persistDashboardData(data: DashboardData): void {
    void data;
  }

  private hasBrowserStorageSupport(): boolean {
    return typeof window !== 'undefined' && !!window.sessionStorage;
  }
}
