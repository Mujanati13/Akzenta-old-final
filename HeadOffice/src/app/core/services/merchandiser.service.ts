import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '@app/core/services/api.service';

export interface CreateMerchandiserDto {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  gender: 'male' | 'female' | 'other';
  phone: string;
  address: string;
  postalCode: string;
  city: string;
  country: string;
  qualifications: string[];
  dateOfBirth: string;
  clientCompanies: { id: number }[];
}

export interface UpdateMerchandiserDto {
  email?: string;
  forceEmailUpdate?: boolean;
  firstName?: string;
  lastName?: string;
  gender?: 'male' | 'female' | 'other';
  phone?: string;
  address?: string;
  postalCode?: string;
  city?: string;
  country?: string;
  qualifications?: string[];
  dateOfBirth?: string;
  status?: string;
  isFavorite?: boolean;
  clientCompanies?: { id: number }[];
}

export interface User {
  id: number;
  email: string; // Add email field
  provider: string; // Add provider field
  socialId: string | null; // Add socialId field
  firstName: string;
  lastName: string;
  gender: string;
  phone: string;
  isSales?: boolean; // Sales role flag for client users
  type?: {
    id: number;
    name: string;
    __entity: string;
  };
  role?: {
    id: number;
    name: string;
    __entity: string;
  };
  status?: {
    id: number;
    name: string;
    __entity: string;
  };
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface JobType {
  id: number;
  name: string;
  comment: string;
  createdAt: string;
  updatedAt: string;
}

export interface City {
  id: number;
  name: string;
  coordinates: number[];
  country: {
    id: number;
    name: {
      de: string;
    };
    flag: string | null;
    createdAt: string;
    updatedAt: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface Language {
  id: number;
  language: {
    id: number;
    name: string;
    createdAt: string;
    updatedAt: string;
  };
  level: string;
  createdAt: string;
  updatedAt: string;
}

export interface Specialization {
  id: number;
  specialization: {
    id: number;
    jobType: {
      id: number;
      name: string;
      createdAt: string;
      updatedAt: string;
    };
    name: string;
    createdAt: string;
    updatedAt: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface Reference {
  id: number;
  company: string;
  activity: string;
  branche: string;
  startDate: string;
  endDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface Education {
  id: number;
  company: string;
  activity: string;
  graduationDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface FileEntity {
  id: number;
  file: {
    id: string;
    path: string;
  };
  type: string;
  name?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Review {
  id: number;
  akzente: {
    id: number;
    user: {
      id: number;
      firstName: string;
      lastName: string;
      email: string;
    };
  };
  rating: number;
  review: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewStats {
  averageRating: number;
  reviewCount: number;
}

export interface Merchandiser {
  id: number;
  user: User;
  birthday: string;
  website: string;
  street: string;
  zipCode: string;
  city: City;
  nationality: string;
  deliveryStreet?: string | null;
  deliveryZipCode?: string | null;
  deliveryCountry?: string | null;
  secondaryResidence?: string | null;
  secondaryZipCode?: string | null;
  secondaryCountry?: string | null;
  jobTypes: JobType[];
  languages: Language[];
  specializations: Specialization[];
  references: Reference[];
  education: Education[];
  files: FileEntity[];
  reviews?: Review[]; // Add reviews array
  reviewStats?: ReviewStats; // Add review stats
  contractuals?: { id: number; name: string }[];
  isFavorite?: boolean;
  createdAt: string;
  updatedAt: string;
  // Computed properties for backward compatibility
  email?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  gender?: string;
  address?: string;
  postalCode?: string;
  country?: string;
  distance?: string;
  qualifications?: string[];
  dateOfBirth?: string;
  status?: {
    id: number;
    name: string;
    __entity: string;
  };
  location?: { lat: number; lng: number };
  clientCompanies?: { id: number; name: string }[];
  projects?: {
    past: {
      id: number;
      name: string;
      status: string;
      clientCompany: {
        id: number;
        name: string;
      };
      createdAt: string;
      updatedAt: string;
    }[];
    current: {
      id: number;
      name: string;
      status: string;
      clientCompany: {
        id: number;
        name: string;
      };
      createdAt: string;
      updatedAt: string;
    }[];
  };
}

export interface MerchandiserSearchParams {
  name: string;
  location: string;
  qualifications: string;
  status: string;
  clientAssignment: string;
  customFilter: string;
  page?: number;
  limit?: number;
}

export interface MerchandiserResponse {
  data: Merchandiser[];
  hasNextPage: boolean;
  totalCount?: number; // Total count from backend
}

@Injectable({
  providedIn: 'root',
})
export class MerchandiserService {
  private readonly endpoint = 'merchandiser';

  constructor(private apiService: ApiService) {}

  /**
   * Create a new merchandiser (only accessible to Akzente users)
   */
  createMerchandiser(data: CreateMerchandiserDto): Observable<Merchandiser> {
    return this.apiService.post<Merchandiser>('auth/register-merchandiser', data);
  }

  /**
   * Get all merchandisers with pagination
   */
  getMerchandisers(page: number = 1, limit: number = 0): Observable<MerchandiserResponse> {
    return this.apiService.get<MerchandiserResponse>(this.endpoint, { page, limit });
  }

  /**
   * Get merchandiser by ID
   */
  getMerchandiserById(id: number): Observable<Merchandiser> {
    return this.apiService.get<Merchandiser>(`${this.endpoint}/${id}`);
  }

  /**
   * Get merchandiser by ID
   */
  getEditMerchandiserById(id: number): Observable<Merchandiser> {
    return this.apiService.get<Merchandiser>(`${this.endpoint}/${id}/profile`);
  }

  /**
   * Update merchandiser
   */
  updateMerchandiser(id: number, data: UpdateMerchandiserDto): Observable<Merchandiser> {
    return this.apiService.patch<Merchandiser>(`${this.endpoint}/${id}`, data);
  }

  /**
   * Delete merchandiser
   */
  deleteMerchandiser(id: number): Observable<void> {
    return this.apiService.delete<void>(`${this.endpoint}/${id}`);
  }

  /**
   * Search merchandisers with filters
   */
  searchMerchandisers(searchParams: MerchandiserSearchParams): Observable<MerchandiserResponse> {
    // Build filters object based on search parameters
    const filters: any = {};

    if (searchParams.name && searchParams.name.trim()) {
      filters.search = searchParams.name.trim();
    }

    if (searchParams.location && searchParams.location.trim()) {
      filters.location = searchParams.location.trim();
    }

    if (searchParams.qualifications && searchParams.qualifications.trim()) {
      filters.qualifications = searchParams.qualifications.trim();
    }

    if (searchParams.status && searchParams.status.trim()) {
      filters.status = searchParams.status.trim();
    }

    if (searchParams.clientAssignment && searchParams.clientAssignment.trim()) {
      filters.clientAssignment = searchParams.clientAssignment.trim();
    }

    if (searchParams.customFilter && searchParams.customFilter.trim()) {
      filters.customFilter = searchParams.customFilter.trim();
    }

    // Create query parameters with filters object
    const params: any = {};

    if (Object.keys(filters).length > 0) {
      params.filters = JSON.stringify(filters);
    }

    if (searchParams.page !== undefined) {
      params.page = searchParams.page;
    }

    // Only send limit if it's explicitly provided (not undefined)
    // If limit is not provided, API will fetch all records
    if (searchParams.limit !== undefined) {
      params.limit = searchParams.limit;
    } else {
    }

    return this.apiService.get<MerchandiserResponse>(`${this.endpoint}`, params);
  }

  /**
   * Get merchandisers by client company
   */
  getMerchandisersByClient(clientId: number, page: number = 1, limit: number = 0): Observable<MerchandiserResponse> {
    return this.apiService.get<MerchandiserResponse>(`${this.endpoint}/client/${clientId}`, { page, limit });
  }

  /**
   * Toggle merchandiser favorite status
   */
  toggleFavoriteStatus(merchandiserId: number): Observable<{ isFavorite: boolean; message: string }> {
    return this.apiService.post<{ isFavorite: boolean; message: string }>(`${this.endpoint}/${merchandiserId}/toggle-favorite`, {});
  }

  /**
   * Update merchandiser status
   */
  updateStatus(id: number, status: string): Observable<Merchandiser> {
    return this.apiService.patch<Merchandiser>(`${this.endpoint}/${id}/status`, { status });
  }

  /**
   * Assign merchandiser to client companies
   */
  assignToClients(merchandiserId: number, clientCompanyIds: number[]): Observable<Merchandiser> {
    return this.apiService.patch<Merchandiser>(`${this.endpoint}/${merchandiserId}/assign-clients`, { clientCompanyIds });
  }

  /**
   * Get merchandisers within distance from location
   */
  getMerchandisersByLocation(lat: number, lng: number, radius: number = 50): Observable<MerchandiserResponse> {
    return this.apiService.get<MerchandiserResponse>(`${this.endpoint}/location`, { lat, lng, radius });
  }

  /**
   * Get merchandisers by qualification
   */
  getMerchandisersByQualification(qualification: string): Observable<MerchandiserResponse> {
    return this.apiService.get<MerchandiserResponse>(`${this.endpoint}/qualification/${qualification}`);
  }

  /**
   * Bulk update merchandisers
   */
  bulkUpdateMerchandisers(updates: { id: number; data: UpdateMerchandiserDto }[]): Observable<Merchandiser[]> {
    return this.apiService.patch<Merchandiser[]>(`${this.endpoint}/bulk-update`, { updates });
  }

  /**
   * Export merchandisers to CSV
   */
  exportMerchandisers(filters?: MerchandiserSearchParams): Observable<Blob> {
    return this.apiService.getBlob(`${this.endpoint}/export`, filters);
  }

  /**
   * Import merchandisers from CSV
   */
  importMerchandisers(file: File): Observable<{ success: number; errors: string[] }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.apiService.postFile<{ success: number; errors: string[] }>(`${this.endpoint}/import`, formData);
  }

  uploadFile(formData: FormData): Observable<any> {
    return this.apiService.postFile<any>(`${this.endpoint}/upload-file`, formData);
  }

  deleteFile(fileId: number): Observable<any> {
    return this.apiService.delete<any>(`${this.endpoint}/files/${fileId}`);
  }

  updateFileName(fileId: number, name: string | null): Observable<any> {
    return this.apiService.patch<any>(`${this.endpoint}/files/${fileId}`, { name });
  }

  /**
   * Get filter options for merchandiser search (job types and statuses)
   */
  getFilterOptions(): Observable<{ jobTypes: { id: number; name: string }[]; statuses: { id: number; name: string }[] }> {
    return this.apiService.get<{ jobTypes: { id: number; name: string }[]; statuses: { id: number; name: string }[] }>(`${this.endpoint}/filter-options`);
  }
}
