import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '@app/core/services/api.service';

export interface FavoriteClientCompany {
  id: number;
  logo: {
    id: string;
    path: string;
  };
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface FavoriteReport {
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
  feedback: string;
  createdAt: string;
  updatedAt: string;
}

export interface FavoriteProject {
  id: number;
  name: string;
  startDate?: string;
  endDate?: string;
  clientCompany?: {
    id: number;
    name: string;
    logo?: {
      id: string;
      path: string;
    };
  };
  status?: {
    id: number;
    name: string;
    color?: string;
  };
  isFavorite?: boolean;
}

export interface FavoritesResponse {
  favoriteClientCompanies: FavoriteClientCompany[];
  favoriteReports: FavoriteReport[];
  favoriteProjects: FavoriteProject[];
}

@Injectable({
  providedIn: 'root',
})
export class FavoritesService {
  private readonly endpoint = 'akzente/favorites';

  constructor(private apiService: ApiService) {}

  /**
   * Get all favorites (client companies, missions, and projects)
   */
  getFavorites(): Observable<FavoritesResponse> {
    return this.apiService.get<FavoritesResponse>(`${this.endpoint}/list`);
  }

  /**
   * Toggle favorite status for a client company
   */
  toggleClientCompanyFavorite(clientCompanyId: number): Observable<{ isFavorite: boolean; message: string }> {
    return this.apiService.post<{ isFavorite: boolean; message: string }>(`client-company/${clientCompanyId}/toggle-favorite`, {});
  }

  /**
   * Toggle favorite status for a report (mission)
   */
  toggleReportFavorite(missionId: number): Observable<{ isFavorite: boolean; message: string }> {
    return this.apiService.post<{ isFavorite: boolean; message: string }>(`report/${missionId}/toggle-favorite`, {});
  }

  /**
   * Toggle favorite status for a project
   */
  toggleProjectFavorite(projectId: number): Observable<{ isFavorite: boolean; message: string }> {
    return this.apiService.post<{ isFavorite: boolean; message: string }>(`project/${projectId}/toggle-favorite`, {});
  }
}
