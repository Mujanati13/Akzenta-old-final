import { Injectable } from '@angular/core';
import { Observable, forkJoin } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from '@app/core/services/api.service';
import { AssignedReportsService, AssignedProject, AssignedReport } from './assigned-reports.service';
import { ReportService, Report } from './report.service';
import { ReportStatusEnum } from '@app/@core/enums/status.enum';

export interface UpcomingProject {
  id: number;
  date: string;
  clientCompany: string;
  projectName: string;
}

export interface DashboardData {
  upcomingProjects: UpcomingProject[];
  upcomingProjectsCount: number;
  newRequestsCount: number;
  newRequests: AssignedReport[];
  overdueReports: Report[];
}

@Injectable({
  providedIn: 'root',
})
export class DashboardService {
  constructor(
    private apiService: ApiService,
    private assignedReportsService: AssignedReportsService,
    private reportService: ReportService,
  ) {}

  /**
   * Get comprehensive dashboard data for merchandiser
   * Uses optimized backend endpoint that returns all data in one call
   */
  getDashboardData(): Observable<DashboardData> {
    return this.apiService.get<DashboardData>('/merchandiser/dashboard');
  }

  /**
   * Extract upcoming projects from assigned reports
   */
  private extractUpcomingProjects(assignedProjects: AssignedProject[]): UpcomingProject[] {
    const upcomingProjects: UpcomingProject[] = [];

    assignedProjects.forEach((projectGroup) => {
      // Safely access project data
      const projectName = projectGroup.project?.name || 'Unbekannt';
      const clientCompanyName = projectGroup.project?.clientCompany?.name || 'Unbekannt';

      projectGroup.reports.forEach((report) => {
        if (report.plannedOn) {
          upcomingProjects.push({
            id: report.id,
            date: report.plannedOn,
            clientCompany: clientCompanyName,
            projectName: projectName,
          });
        }
      });
    });

    // Sort by date (earliest first)
    upcomingProjects.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return dateA - dateB;
    });

    // Filter only future dates
    const now = new Date();
    return upcomingProjects.filter((project) => new Date(project.date) >= now);
  }

  /**
   * Extract new requests pending merchandiser acceptance
   */
  private extractNewRequests(assignedProjects: AssignedProject[]): AssignedReport[] {
    const newRequests: AssignedReport[] = [];

    assignedProjects.forEach((projectGroup) => {
      projectGroup.reports.forEach((report) => {
        if (report.accepted === false) {
          newRequests.push(report);
        }
      });
    });

    // Sort by creation date (newest first)
    newRequests.sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return dateB - dateA;
    });

    return newRequests;
  }

  /**
   * Get overdue reports (scheduled visit date in the past, not yet submitted)
   */
  private getOverdueReports(allReports: Report[]): Report[] {
    const now = new Date();
    return allReports.filter((report) => {
      if (report.status?.id !== ReportStatusEnum.SCHEDULED || !report.plannedOn) {
        return false;
      }

      return new Date(report.plannedOn) < now;
    });
  }

  /**
   * Format date to German format (DD. MMMM YYYY)
   */
  formatDateGerman(dateString: string): string {
    if (!dateString) return '-';

    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '-';

    const months = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

    const day = date.getDate().toString().padStart(2, '0');
    const month = months[date.getMonth()];
    const year = date.getFullYear();

    return `${day}. ${month} ${year}`;
  }

  /**
   * Format date to short German format (DD.MM.YYYY)
   */
  formatDateShort(dateString: string): string {
    if (!dateString) return '-';

    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '-';

    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();

    return `${day}.${month}.${year}`;
  }
}
