import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';

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
  startDate: string;
  endDate: string;
  createdAt: string;
  updatedAt: string;
  reportCounts?: {
    newReports: number;
    ongoingReports: number;
    completedReports: number;
  };
  clientCompany: {
    id: number;
    name: string;
  };
}

export interface MerchandiserFavoritesResponse {
  favoriteReports: FavoriteReport[];
  favoriteProjects: FavoriteProject[];
}

@Injectable({
  providedIn: 'root',
})
export class FavoritesService {
  private readonly endpoint = 'merchandiser/favorites';

  constructor(private http: HttpClient) {}

  /**
   * Get all favorites for merchandiser (reports and projects)
   */
  getFavorites(): Observable<MerchandiserFavoritesResponse> {
    console.log('🚀 FavoritesService: Getting merchandiser favorites');
    return this.http.get<MerchandiserFavoritesResponse>(`${environment.apiUrl}/${this.endpoint}/list`);
  }

  /**
   * Toggle favorite status for a report (mission)
   */
  toggleReportFavorite(reportId: number): Observable<{ isFavorite: boolean; message: string }> {
    return this.http.post<{ isFavorite: boolean; message: string }>(`${environment.apiUrl}/report/${reportId}/toggle-favorite`, {});
  }

  /**
   * Toggle favorite status for a project
   */
  toggleProjectFavorite(projectId: number): Observable<{ isFavorite: boolean; message: string }> {
    return this.http.post<{ isFavorite: boolean; message: string }>(`${environment.apiUrl}/project/${projectId}/toggle-favorite`, {});
  }
}
