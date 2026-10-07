import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '@app/core/services/api.service';

export interface DashboardReport {
  id: number;
  project: {
    id: number;
    name: string;
    startDate: string;
    endDate: string;
    createdAt: string;
    updatedAt: string;
  };
  status: {
    id: number;
    name: string;
    akzenteName?: string;
    color?: string;
    akzenteColor?: string;
  };
  clientCompany: {
    id: number;
    logo: {
      id: string;
      path: string;
    };
    name: string;
    createdAt: string;
    updatedAt: string;
  };
  merchandiser: {
    id: number;
    user: {
      id: number;
      firstName: string;
      lastName: string;
      email: string;
      gender: string;
      phone: string;
      type: {
        id: number;
        name: string;
        __entity: string;
      };
      role: {
        id: number;
        name: string;
        __entity: string;
      };
      status: {
        id: number;
        name: string;
        __entity: string;
      };
      createdAt: string;
      updatedAt: string;
      deletedAt: string | null;
    };
    birthday: string;
    website: string;
    street: string;
    zipCode: string;
    tax_id: string;
    tax_no: string;
    status: {
      id: number;
      name: string;
      __entity: string;
    };
    nationality: string;
    contractuals: Array<{
      id: number;
      name: string;
    }>;
    createdAt: string;
    updatedAt: string;
  };
  branch: {
    id: number;
    name: string;
    phone: string;
    client: {
      id: number;
      logo: {
        id: string;
        path: string;
      };
      name: string;
      createdAt: string;
      updatedAt: string;
    };
    createdAt: string;
    updatedAt: string;
  };
  conversation: {
    id: number;
    createdAt: string;
    updatedAt: string;
  };
  street: string;
  zipCode: string;
  plannedOn: string;
  note: string;
  reportTo: string;
  visitDate: string;
  feedback: string;
  isFavorite?: boolean; // Add favorite status for reports
  createdAt: string;
  updatedAt: string;
}

export interface DashboardClientCompany {
  id: number;
  logo: {
    id: string;
    path: string;
  };
  name: string;
  isFavorite?: boolean; // Add favorite status for client companies
  createdAt: string;
  updatedAt: string;
  reportCounts?: {
    newReports: number;
    ongoingReports: number;
    completedReports: number;
  };
  isMyClient?: boolean;
}

export interface DashboardData {
  newReports: DashboardReport[];
  rejectedReports: DashboardReport[];
  clientCompaniesAssignedAkzente: DashboardClientCompany[];
  dashboardClientCompanies?: DashboardClientCompany[];
  totalClientCompaniesCount?: number;
  totalAssignedClientCompaniesCount?: number;
  processingTimeMs?: number;
}

@Injectable({
  providedIn: 'root',
})
export class DashboardService {
  private readonly endpoint = 'akzente/dashboard';

  constructor(private apiService: ApiService) {}

  /**
   * Get dashboard data
   */
  getDashboardData(): Observable<DashboardData> {
    return this.apiService.get<DashboardData>(`${this.endpoint}/data`);
  }
}
