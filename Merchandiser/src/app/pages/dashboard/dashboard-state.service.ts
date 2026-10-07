import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface DashboardData {
  upcomingProjects: any[];
  upcomingProjectsCount: number;
  newRequests: any[];
  newRequestsCount: number;
  overdueReports: any[];
  timestamp: number;
}

@Injectable({
  providedIn: 'root',
})
export class DashboardStateService {
  private readonly DASHBOARD_DATA_STORAGE_KEY = 'merchandiser_dashboard_data_v1';
  private readonly CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

  private readonly dashboardDataSubject = new BehaviorSubject<DashboardData | null>(null);

  readonly dashboardData$ = this.dashboardDataSubject.asObservable();

  setDashboardData(data: { upcomingProjects: any[]; upcomingProjectsCount: number; newRequests: any[]; newRequestsCount: number; overdueReports: any[] }): void {
    if (data) {
      const dashboardData: DashboardData = {
        upcomingProjects: data.upcomingProjects.map((project) => ({ ...project })),
        upcomingProjectsCount: data.upcomingProjectsCount,
        newRequests: data.newRequests.map((request) => ({ ...request })),
        newRequestsCount: data.newRequestsCount,
        overdueReports: data.overdueReports.map((report) => ({ ...report })),
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
      window.localStorage.removeItem(this.DASHBOARD_DATA_STORAGE_KEY);
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
    return typeof window !== 'undefined' && !!window.localStorage;
  }
}
