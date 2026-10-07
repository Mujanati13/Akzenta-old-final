import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { User, UserListResponse, UsersService, UserQueryParams } from '../services/users.service';

export interface StoredColumn {
  field: string;
  header: string;
}

export interface UsersListViewState {
  // Filter states
  clientSearch: string;
  nameSearch: string;
  categorySearch: string;
  showFilters?: boolean;
  usersColumnFilters: Record<string, string[]>;
  dateRange: { start: Date | null; end: Date | null };

  // Column visibility states
  usersVisibleColumns: Record<string, boolean>;
  usersOrderedColumns: StoredColumn[];
  selectedColumns: StoredColumn[];

  // Sort states
  sortField: string;
  sortOrder: number;

  // Pagination
  currentPage: number;
  pageSize: number;
  paginationFirst?: number; // Store paginationFirst directly for more reliable restoration

  // Scroll
  scrollPosition?: number;
}

@Injectable({
  providedIn: 'root',
})
export class UsersListStateService {
  private readonly VIEW_STATE_STORAGE_KEY = 'users_list_view_state_v1';
  private readonly USERS_DATA_STORAGE_KEY = 'users_list_data_v1';
  private readonly CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

  private readonly usersDataSubject = new BehaviorSubject<UserListResponse | null>(null);
  private readonly viewStateSubject = new BehaviorSubject<UsersListViewState | null>(this.loadViewStateFromStorage());

  readonly usersData$ = this.usersDataSubject.asObservable();
  readonly viewState$ = this.viewStateSubject.asObservable();

  setUsersData(data: UserListResponse | null): void {
    if (data) {
      this.usersDataSubject.next(data);
      this.persistUsersData(data);
    }
  }

  getUsersDataSnapshot(): UserListResponse | null {
    return this.usersDataSubject.value;
  }

  saveViewState(state: UsersListViewState): void {
    const clonedState = this.cloneViewState(state);
    this.viewStateSubject.next(clonedState);
    this.persistViewState(clonedState);
  }

  getViewStateSnapshot(): UsersListViewState | null {
    const state = this.viewStateSubject.value;
    return state ? this.cloneViewState(state) : null;
  }

  clearCache(): void {
    this.usersDataSubject.next(null);
    if (this.hasBrowserStorageSupport()) {
      window.localStorage.removeItem(this.USERS_DATA_STORAGE_KEY);
    }
  }

  clearViewState(): void {
    this.viewStateSubject.next(null);
    if (this.hasBrowserStorageSupport()) {
      window.localStorage.removeItem(this.VIEW_STATE_STORAGE_KEY);
    }
  }

  isCacheValid(): boolean {
    const data = this.usersDataSubject.value as (UserListResponse & { timestamp?: number }) | null;
    if (!data || !data.timestamp) {
      return false;
    }

    const age = Date.now() - data.timestamp;
    return age < this.CACHE_DURATION;
  }

  private loadViewStateFromStorage(): UsersListViewState | null {
    if (!this.hasBrowserStorageSupport()) {
      return null;
    }

    const raw = window.localStorage.getItem(this.VIEW_STATE_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    try {
      const state = JSON.parse(raw) as UsersListViewState;
      // Convert date strings back to Date objects
      if (state.dateRange) {
        if (state.dateRange.start && typeof state.dateRange.start === 'string') {
          state.dateRange.start = new Date(state.dateRange.start);
        }
        if (state.dateRange.end && typeof state.dateRange.end === 'string') {
          state.dateRange.end = new Date(state.dateRange.end);
        }
      }
      return state;
    } catch (error) {
      console.warn('Failed to parse users list view state from storage:', error);
      return null;
    }
  }

  private persistViewState(state: UsersListViewState): void {
    if (!this.hasBrowserStorageSupport()) {
      return;
    }

    try {
      window.localStorage.setItem(this.VIEW_STATE_STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.warn('Failed to persist users list view state:', error);
    }
  }

  private loadUsersDataFromStorage(): (UserListResponse & { timestamp: number }) | null {
    return null;
  }

  private persistUsersData(data: UserListResponse): void {
    this.usersDataSubject.next({
      ...data,
      timestamp: Date.now(),
    } as UserListResponse & { timestamp: number });
  }

  private cloneViewState(state: UsersListViewState): UsersListViewState {
    return {
      ...state,
      usersColumnFilters: this.cloneFilters(state.usersColumnFilters),
      usersVisibleColumns: { ...state.usersVisibleColumns },
      usersOrderedColumns: state.usersOrderedColumns.map((column) => ({ ...column })),
      selectedColumns: state.selectedColumns.map((column) => ({ ...column })),
      dateRange: {
        start: state.dateRange?.start ? new Date(state.dateRange.start) : null,
        end: state.dateRange?.end ? new Date(state.dateRange.end) : null,
      },
      scrollPosition: state.scrollPosition,
    };
  }

  private cloneFilters(filters: Record<string, string[]>): Record<string, string[]> {
    return Object.keys(filters || {}).reduce<Record<string, string[]>>((acc, key) => {
      acc[key] = [...(filters[key] || [])];
      return acc;
    }, {});
  }

  private hasBrowserStorageSupport(): boolean {
    return typeof window !== 'undefined' && !!window.localStorage;
  }

  /**
   * Prefetch users data and update store
   * Can be called from anywhere to refresh the users list data
   * Note: Does NOT clear cache - allows component to show cached data while prefetch completes
   */
  prefetchUsersData(usersService: UsersService): void {
    // Don't clear cache here - let component decide based on what's available
    // If prefetch completes before component loads, great. If not, component will use cache or load fresh.

    // Get stored view state for sorting
    const storedState = this.getViewStateSnapshot();
    const currentPage = storedState?.currentPage || 1;
    const pageSize = storedState?.pageSize || 10;
    const sortField = storedState?.sortField || '';
    const sortOrder = storedState?.sortOrder || 1;

    const queryParams: UserQueryParams = {
      page: currentPage,
      limit: pageSize,
    };

    // Add sorting if specified in stored state
    if (sortField) {
      queryParams.sort = [
        {
          orderBy: sortField as keyof User,
          order: sortOrder === 1 ? 'ASC' : 'DESC',
        },
      ];
    }

    const filters: NonNullable<UserQueryParams['filters']> = {};
    if (storedState?.nameSearch?.trim()) {
      filters.search = storedState.nameSearch.trim();
    }
    if (storedState?.categorySearch?.trim()) {
      filters.userTypeSearch = storedState.categorySearch.trim();
    }
    if (Object.keys(filters).length > 0) {
      queryParams.filters = filters;
    }

    // Fetch data and update store
    usersService.getUsers(queryParams).subscribe({
      next: (response) => {
        // Update store immediately
        this.setUsersData(response);
      },
      error: (error) => {
        console.error('Error prefetching users:', error);
      },
    });
  }
}
