import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { tap, catchError, map } from 'rxjs/operators';
import { ApiService } from '@app/core/services/api.service';

export interface ClientCompany {
  id: number;
  logo?: {
    id: string;
    path: string;
  } | null;
  name: string;
  isFavorite?: boolean;
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
  projects: any[];
}

@Injectable({
  providedIn: 'root',
})
export class ClientCompanyService {
  private readonly endpoint = 'merchandiser/client-companies';

  constructor(private apiService: ApiService) {}

  /**
   * Create a new client company with form data (name + logo file)
   */
  createClientCompany(data: CreateClientCompanyFormData): Observable<ClientCompany> {
    console.log('🚀 ClientCompanyService: Creating client company with form data:', {
      name: data.name,
      hasLogo: !!data.logo,
      logoName: data.logo?.name,
    });

    const formData = new FormData();
    formData.append('name', data.name);

    if (data.logo) {
      formData.append('logo', data.logo);
    }

    return this.apiService.postFile<ClientCompany>(this.endpoint, formData);
  }

  /**
   * Get all client companies with pagination
   */
  getClientCompanies(page: number = 1, limit: number = 0): Observable<InfinityPaginationResponse<ClientCompany>> {
    console.log('🚀 ClientCompanyService: Fetching client companies from:', this.endpoint, { page, limit });

    return this.apiService.get<ClientCompany[]>(this.endpoint, { page, limit }).pipe(
      tap((rawData: ClientCompany[]) => {
        console.log('📥 ClientCompanyService: Raw API response:', rawData);
      }),
      map((data: ClientCompany[]) => {
        // Transform the direct array response to InfinityPaginationResponse format
        // Also ensure each client company has the isFavorite property
        const transformedData = data.map((company) => ({
          ...company,
          isFavorite: company.isFavorite || false, // Default to false if not provided
        }));

        const result = {
          data: transformedData,
          hasNextPage: false, // Since the API returns all data at once
        } as InfinityPaginationResponse<ClientCompany>;

        console.log('📤 ClientCompanyService: Transformed response:', result);
        return result;
      }),
    );
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
    console.log('🚀 Getting client company with relationships:', id);

    return this.apiService.get<any>(`${this.endpoint}/${id}`).pipe(
      tap((response) => console.log('✅ Client company with relationships loaded:', response)),
      catchError((error) => {
        console.error('❌ Error getting client company with relationships:', error);
        return throwError(() => error);
      }),
    );
  }

  /**
   * Update client company with relationships
   */
  updateClientCompanyWithRelationships(id: number, formData: FormData): Observable<ClientCompany> {
    console.log('🚀 Updating client company with relationships:', id);

    return this.apiService.patch<ClientCompany>(`${this.endpoint}/${id}`, formData).pipe(
      tap((response) => console.log('✅ Client company updated with relationships:', response)),
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
    return this.apiService.post<{ isFavorite: boolean; message: string }>(`client-company/${clientCompanyId}/toggle-favorite`, {});
  }

  /**
   * Get projects by client company
   */
  getProjectsByClientCompany(clientCompanyId: number): Observable<ProjectsByClientCompanyResponse> {
    return this.apiService.get<ProjectsByClientCompanyResponse>(`client-company/${clientCompanyId}/projects`);
  }
}
