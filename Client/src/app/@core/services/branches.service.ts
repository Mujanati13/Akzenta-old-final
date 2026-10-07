import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from '@app/core/services/api.service';

export interface Branch {
  id: number;
  name: string;
  branchNumber?: string | null;
  street?: string;
  zipCode?: string;
  phone?: string;
  client?: {
    id: number;
    name: string;
  };
  city?: {
    id: number;
    name: string;
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  hasNextPage: boolean;
  totalCount?: number;
}

@Injectable({
  providedIn: 'root',
})
export class BranchesService {
  private readonly endpoint = 'branch';

  constructor(private apiService: ApiService) {}

  /**
   * Get all branches (for Akzente users)
   * This endpoint is available at: GET /api/v1/branch
   * @param page Optional page number for pagination
   * @param limit Optional limit for pagination (0 = all)
   * @returns Observable of paginated Branch response
   */
  getAllBranches(page: number = 1, limit: number = 0): Observable<PaginatedResponse<Branch>> {
    return this.apiService.get<PaginatedResponse<Branch>>(`branch`, { page, limit }).pipe(
      map((response) => ({
        data: response?.data || [],
        hasNextPage: !!response?.hasNextPage,
        totalCount: response?.totalCount,
      })),
    );
  }

  /**
   * Get branches for a specific client company
   * @param clientCompanyId The ID of the client company
   * @returns Observable of Branch array
   */
  getBranchesByClientCompany(clientCompanyId: number): Observable<Branch[]> {
    return this.apiService.get<Branch[]>(`client-company/${clientCompanyId}/branches`, {});
  }

  /**
   * Get reports for a specific branch
   * @param branchId The ID of the branch
   * @returns Observable of Report array
   */
  getReportsByBranch(branchId: number): Observable<any[]> {
    return this.apiService.get<any[]>(`${this.endpoint}/${branchId}/reports`, {});
  }
}
