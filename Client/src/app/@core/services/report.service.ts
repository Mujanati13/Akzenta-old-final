import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';

export interface Report {
  id?: number;
  project?: {
    id?: number;
    name?: string;
    startDate?: string;
    endDate?: string;
    createdAt?: string;
    updatedAt?: string;
  };
  status?: {
    id?: number;
    name?: string;
    color?: string;
  };
  branch?: {
    id?: number;
    name?: string;
    branchNumber?: string | null;
    street?: string;
    zipCode?: string;
    phone?: string;
    city?: {
      id?: number;
      name?: string;
      country?: {
        name?: string | { de?: string };
      };
    };
    client?: {
      id?: number;
      name?: string;
    };
    createdAt?: string;
    updatedAt?: string;
  };
  street?: string;
  zipCode?: string;
  address?: string;
  plannedOn?: string;
  note?: string;
  reportTo?: string;
  feedback?: string | boolean;
  isFavorite?: boolean;
  createdAt?: string;
  updatedAt?: string;
  merchandiser?: any;
}

@Injectable({
  providedIn: 'root',
})
export class ReportService {
  private readonly apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  /**
   * Get reports for a specific project
   * @param projectId The ID of the project
   * @returns Observable of Report array
   */
  getReportsByProject(projectId: string | number): Observable<Report[]> {
    const url = `${this.apiUrl}/report/project/${projectId}`;

    return this.http.get<Report[]>(url);
  }

  /**
   * Toggle favorite status for a report
   * @param reportId The ID of the report
   * @returns Observable of the updated report
   */
  toggleFavoriteStatus(reportId: number): Observable<Report> {
    const url = `${this.apiUrl}/report/${reportId}/toggle-favorite`;
    return this.http.post<Report>(url, {});
  }

  /**
   * Get a single report by ID
   * @param reportId The ID of the report
   */
  getReportById(reportId: string | number): Observable<any> {
    const url = `${this.apiUrl}/report/${reportId}`;
    return this.http.get<any>(url);
  }

  /**
   * Send a conversation message related to a report
   * @param reportId The report ID
   * @param payload Object containing content and receiverType
   */
  sendMessage(reportId: string | number, payload: { content: string; receiverType: 'akzente' }): Observable<any> {
    const url = `${this.apiUrl}/report/${reportId}/send-message`;
    return this.http.post<any>(url, payload);
  }

  /**
   * Export project reports as Excel file
   * @param projectId The ID of the project
   * @param status Optional status filter
   * @returns Observable of Blob (Excel file)
   */
  exportProjectReportsAsExcel(projectId: string | number, status?: string): Observable<Blob> {
    let url = `${this.apiUrl}/report/project/${projectId}/export-excel`;
    if (status) {
      url = `${url}?status=${encodeURIComponent(status)}`;
    }
    return this.http.get(url, { responseType: 'blob' });
  }

  /**
   * Export single report as Excel file
   * @param reportId The ID of the report
   * @returns Observable of Blob (Excel file)
   */
  exportSingleReportAsExcel(reportId: string | number): Observable<Blob> {
    const url = `${this.apiUrl}/report/${reportId}/export-excel`;
    return this.http.get(url, { responseType: 'blob' });
  }

  /**
   * Close a report by its ID
   * @param reportId The ID of the report
   * @returns Observable of the updated report
   */
  closeReport(reportId: string | number): Observable<any> {
    const url = `${this.apiUrl}/report/${reportId}/close`;
    return this.http.patch<any>(url, {});
  }
}
