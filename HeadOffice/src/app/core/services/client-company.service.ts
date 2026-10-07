import { Injectable } from '@angular/core';
import { Observable, throwError, of } from 'rxjs';
import { tap, catchError, map } from 'rxjs/operators';
import { ApiService } from '@app/core/services/api.service';

export interface ClientCompany {
  id: number;
  logo?: {
    id: string;
    path: string;
  } | null;
  name: string;
  isFavorite?: boolean; // Add this property
  isMyClient?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateClientCompanyFormData {
  name: string;
  logo?: File;
}

export interface InfinityPaginationResponse<T> {
  data: T[];
  hasNextPage: boolean;
}

export interface ProjectsByClientCompanyResponse {
  clientCompany: ClientCompany;
  projects: any[]; // You can replace any[] with a Project[] if you have a Project interface
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

@Injectable({
  providedIn: 'root',
})
export class ClientCompanyService {
  private readonly endpoint = 'client-company';
  private readonly projectsCacheTtl = 30000;
  private projectsCache = new Map<number, CacheEntry<ProjectsByClientCompanyResponse>>();

  constructor(private apiService: ApiService) {}

  /**
   * Create a new client company with form data (name + logo file)
   */
  createClientCompany(data: CreateClientCompanyFormData): Observable<ClientCompany> {
    const formData = new FormData();
    formData.append('name', data.name);

    if (data.logo) {
      formData.append('logo', data.logo);
    }

    return this.apiService.postFile<ClientCompany>(this.endpoint, formData);
  }

  /**
   * Create a new client company with relationships (used in client-add form)
   */
  createClientCompanyWithRelationships(formData: FormData): Observable<ClientCompany> {
    return this.apiService.postFile<ClientCompany>(this.endpoint, formData);
  }

  /**
   * Get all client companies with pagination
   */
  getClientCompanies(page: number = 1, limit: number = 0): Observable<InfinityPaginationResponse<ClientCompany>> {
    return this.apiService.get<InfinityPaginationResponse<ClientCompany>>(this.endpoint, { page, limit });
  }

  /**
   * Update client company
   */
  updateClientCompany(id: number, data: Partial<any>): Observable<ClientCompany> {
    return this.apiService.patch<ClientCompany>(`${this.endpoint}/${id}`, data);
  }

  /**
   * Get client company by ID with relationships
   */
  getClientCompanyWithRelationships(id: number): Observable<any> {
    if (!id || isNaN(Number(id))) {
      const error = new Error(`Invalid client company ID: ${id}`);
      console.error('❌ Error getting client company with relationships:', error);
      return throwError(() => error);
    }

    return this.apiService.get<any>(`${this.endpoint}/${id}`).pipe(
      catchError((error) => {
        if (error.status === 404) {
          console.warn(`⚠️ Client company with ID ${id} not found (404)`);
        } else {
          console.error(`❌ Error getting client company with relationships (ID: ${id}):`, error);
        }
        return throwError(() => error);
      }),
    );
  }

  /**
   * Update client company with relationships
   */
  updateClientCompanyWithRelationships(id: number, formData: FormData): Observable<ClientCompany> {
    return this.apiService.patch<ClientCompany>(`${this.endpoint}/${id}`, formData).pipe(
      catchError((error) => {
        console.error('❌ Error updating client company with relationships:', error);
        return throwError(() => error);
      }),
    );
  }

  /**
   * Delete client company
   */
  deleteClientCompany(id: number): Observable<void> {
    return this.apiService.delete<void>(`${this.endpoint}/${id}`);
  }

  /**
   * Toggle favorite status for a client company
   */
  toggleFavoriteStatus(clientCompanyId: number): Observable<{ isFavorite: boolean; message: string }> {
    return this.apiService.post<{ isFavorite: boolean; message: string }>(`${this.endpoint}/${clientCompanyId}/toggle-favorite`, {});
  }

  /**
   * Get projects by client company (cached for 30s to avoid rate-limit issues)
   */
  getProjectsByClientCompany(clientCompanyId: number, forceRefresh?: boolean): Observable<ProjectsByClientCompanyResponse> {
    if (!forceRefresh) {
      const cached = this.projectsCache.get(clientCompanyId);
      if (cached && Date.now() - cached.timestamp < this.projectsCacheTtl) {
        return of(cached.data);
      }
    }
    return this.apiService.get<ProjectsByClientCompanyResponse>(`${this.endpoint}/${clientCompanyId}/projects`).pipe(
      tap((response) => {
        this.projectsCache.set(clientCompanyId, { data: response, timestamp: Date.now() });
      }),
    );
  }

  invalidateProjectsCache(clientCompanyId?: number): void {
    if (clientCompanyId) {
      this.projectsCache.delete(clientCompanyId);
    } else {
      this.projectsCache.clear();
    }
  }

  /**
   * Get all users for client company assignment (used in create form)
   */
  getAllUsers(): Observable<{ clientUsers: { data: any[] }; akzenteUsers: { data: any[] } }> {
    return this.apiService.get<{ clientUsers: { data: any[] }; akzenteUsers: { data: any[] } }>(`${this.endpoint}/users/all`);
  }

  /**
   * Get client companies assigned to the current Akzente user
   */
  getMyClientCompanies(page: number = 1, limit: number = 0): Observable<InfinityPaginationResponse<ClientCompany>> {
    return this.apiService.get<InfinityPaginationResponse<ClientCompany>>(`${this.endpoint}/my-client-companies`, { page, limit });
  }

  /**
   * Get all client companies with basic info only (id, name, logo) - fast endpoint without report counts
   * Use this for user assignment forms where only basic company info is needed
   */
  getClientCompaniesBasic(page: number = 1, limit: number = 100): Observable<InfinityPaginationResponse<ClientCompany>> {
    return this.apiService.get<InfinityPaginationResponse<ClientCompany>>(`${this.endpoint}/basic/all`, { page, limit });
  }

  /**
   * Load all client companies from the database (for user assignment forms).
   */
  getAllClientCompaniesBasic(): Observable<ClientCompany[]> {
    return this.getClientCompaniesBasic(1, 1000).pipe(map((response) => response.data ?? []));
  }
}
