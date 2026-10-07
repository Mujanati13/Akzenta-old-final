import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { ApiService } from '@app/core/services/api.service';
import { environment } from '@env/environment';

export interface AssignedReport {
  id: number;
  title: string;
  description: string;
  status: {
    id: number;
    name: string;
    akzenteName: string;
    clientName: string;
    merchandiserName: string;
    akzenteColor: string;
    clientColor: string;
    merchandiserColor: string;
  };
  branch: {
    id: number;
    name: string;
    street: string;
    zipCode: string;
    phone: string;
    client?: {
      id?: number;
      name?: string;
      logo?: {
        id?: string;
        path?: string;
      };
    };
  };
  street: string;
  zipCode: string;
  plannedOn: string;
  note: string;
  reportTo: string;
  feedback: string;
  accepted?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AssignedProject {
  project: {
    id: number;
    name: string;
    startDate: string;
    endDate: string;
    createdAt: string;
    updatedAt: string;
    clientCompany: {
      id: number;
      name: string;
      logo: {
        id: string;
        path: string;
      };
    };
  };
  reports: AssignedReport[];
  reportCount: number;
}

@Injectable({
  providedIn: 'root',
})
export class AssignedReportsService {
  constructor(
    private apiService: ApiService,
    private http: HttpClient,
  ) {}

  /**
   * Get assigned reports grouped by project
   */
  getAssignedReports(): Observable<AssignedProject[]> {
    return this.apiService.get<AssignedProject[]>('/merchandiser/assigned-reports');
  }

  /**
   * Export project reports as Excel file
   */
  exportProjectReportsAsExcel(projectId: string | number): Observable<Blob> {
    const url = `${environment.apiUrl}/report/project/${projectId}/export-excel`;
    return this.http.get(url, { responseType: 'blob' });
  }
}
