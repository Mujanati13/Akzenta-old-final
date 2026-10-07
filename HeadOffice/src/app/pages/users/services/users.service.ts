import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '@app/core/services/api.service';

export interface User {
  id: number;
  email: string;
  provider: string;
  socialId: string | null;
  firstName: string;
  lastName: string;
  gender: string;
  phone: string;
  isSales?: boolean; // Sales role flag for client users
  isSale?: boolean; // Legacy backend flag for sales users
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
  favoriteClientCompanies?: ClientCompany[];
  clientCompanies?: ClientCompany[];
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface UserListResponse {
  data: User[];
  hasNextPage: boolean;
  totalCount?: number;
}

export interface UserQueryParams {
  page?: number;
  limit?: number;
  filters?: {
    userTypeNames?: string[];
    search?: string;
    userTypeSearch?: string;
    clientCompanySearch?: string;
    roles?: { id: number }[];
  };
  sort?: {
    orderBy: keyof User;
    order: 'ASC' | 'DESC';
  }[];
}

export interface UpdateUserDto {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  gender?: string;
  password?: string;
  /** Server-side password reset only — use sendGeneratedPassword() in edit mode. */
  sendGeneratedPasswordInEmail?: boolean;
  favoriteClientCompanies?: { id: number }[];
  clientCompanies?: { id: number }[];
  isSales?: boolean;
}

export interface ClientCompany {
  id: number;
  name: string;
  logo?: {
    path: string;
  };
  createdAt: string;
  updatedAt: string;
}

@Injectable({
  providedIn: 'root',
})
export class UsersService {
  private readonly endpoint = 'users';

  constructor(private apiService: ApiService) {}

  /**
   * Get users with pagination and filters
   */
  getUsers(params: UserQueryParams = {}): Observable<UserListResponse> {
    const queryParams: any = {};

    if (params.page) queryParams.page = params.page;
    if (params.limit !== undefined) queryParams.limit = params.limit;
    if (params.filters) queryParams.filters = JSON.stringify(params.filters);
    if (params.sort) queryParams.sort = JSON.stringify(params.sort);

    return this.apiService.get<UserListResponse>(this.endpoint, queryParams);
  }

  /**
   * Get user by ID
   */
  getUserById(id: string | number): Observable<User> {
    return this.apiService.get<User>(`${this.endpoint}/${id}`);
  }

  /**
   * Update user by ID
   * @param returnList - If true, returns both updated user and full users list
   */
  updateUser(id: string | number, data: UpdateUserDto, returnList: boolean = false): Observable<User | { user: User; usersList: UserListResponse }> {
    const queryParams = returnList ? { returnList: 'true' } : {};
    return this.apiService.patch<User | { user: User; usersList: UserListResponse }>(`${this.endpoint}/${id}`, data, queryParams);
  }

  /**
   * Generate and email a new password for a user (edit mode only).
   */
  sendGeneratedPassword(id: string | number): Observable<void> {
    return this.apiService.post<void>(`auth/users/${id}/send-generated-password`, {});
  }

  /**
   * Delete user by ID
   */
  deleteUser(id: string | number): Observable<void> {
    return this.apiService.delete<void>(`${this.endpoint}/${id}`);
  }

  /**
   * Get Akzente users (users with type 'akzente' or 'client')
   */
  getAkzenteUsers(params: UserQueryParams = {}): Observable<UserListResponse> {
    const queryParams: any = {};

    if (params.page) queryParams.page = params.page;
    if (params.limit !== undefined) queryParams.limit = params.limit;
    if (params.filters) queryParams.filters = JSON.stringify(params.filters);
    if (params.sort) queryParams.sort = JSON.stringify(params.sort);

    return this.apiService.get<UserListResponse>(`${this.endpoint}/akzente`, queryParams);
  }
}
