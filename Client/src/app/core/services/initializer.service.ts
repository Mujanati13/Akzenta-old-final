import { Injectable } from '@angular/core';
import { HttpClient, HttpContext, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, catchError, of, tap } from 'rxjs';
import { environment } from '@env/environment';
import { SKIP_API_PREFIX, SKIP_AUTH_CHECK } from '@app/@core/interceptors/api-prefix.interceptor';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import * as AppDataActions from '@app/@core/store/app-data/app-data.actions';

export interface InitialDataUser {
  id: number;
  email: string;
  provider: string;
  socialId: string | null;
  firstName: string;
  lastName: string;
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
}

export interface ClientCompany {
  id: number;
  logo: {
    id: string;
    path: string;
  };
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface AssignedProject {
  id: string | number;
  name: string;
  slug?: string;
  clientId?: string;
  clientName?: string;
  clientCompany?: {
    id: number;
    name?: string;
  };
}

export interface InitialData {
  user: InitialDataUser;
  clientCompanies: ClientCompany[];
  assignedProjects?: AssignedProject[];
}

@Injectable({
  providedIn: 'root',
})
export class InitializerService {
  private _initialData = new BehaviorSubject<InitialData | null>(null);
  public initialData$ = this._initialData.asObservable();

  private _currentUser = new BehaviorSubject<InitialDataUser | null>(null);
  public currentUser$ = this._currentUser.asObservable();

  private _currentClientCompany = new BehaviorSubject<ClientCompany | null>(null);
  public currentClientCompany$ = this._currentClientCompany.asObservable();

  private _allAssignedProjects: Array<AssignedProject & { clientCompany?: { id?: number } }> = [];
  private _assignedProjects = new BehaviorSubject<AssignedProject[]>([]);
  public assignedProjects$ = this._assignedProjects.asObservable();

  constructor(
    private http: HttpClient,
    private router: Router,
    private store: Store,
  ) {}

  /**
   * Loads application initial data
   */
  loadInitialAppData(): Observable<InitialData | null> {
    // Use the full URL directly instead of relying on ApiPrefixInterceptor
    const url = `${environment.apiUrl}/get-initial-data`;

    // Create a proper HttpContext with both tokens
    const context = new HttpContext().set(SKIP_API_PREFIX, true).set(SKIP_AUTH_CHECK, true);

    return this.http
      .get<InitialData>(url, {
        context,
        withCredentials: true,
      })
      .pipe(
        tap((data) => {
          // Update in-memory snapshots first so consumers can read synchronously
          this._initialData.next(data);

          // Dispatch to store - this is crucial for other services/components
          this.store.dispatch(AppDataActions.loadInitialDataSuccess({ data }));

          // If user data is present, update the current user subject
          if (data?.user) {
            this._currentUser.next(data.user);
            this.store.dispatch(AppDataActions.updateUser({ user: data.user }));
          }

          // Set the first client company as default if available
          if (data?.clientCompanies?.length) {
            const firstCompany = data.clientCompanies[0];
            this._currentClientCompany.next(firstCompany);
            this.store.dispatch(AppDataActions.updateCurrentClientCompany({ clientCompany: firstCompany }));
          }

          // Set assigned projects if available
          if (data?.assignedProjects) {
            this.setAllAssignedProjects(data.assignedProjects);
          }
        }),
        catchError((error) => {
          console.error('❌ InitializerService: Failed to load initial app data', error);

          // Dispatch error to store
          this.store.dispatch(
            AppDataActions.loadInitialDataFailure({
              error: error.message || 'Failed to load initial data',
            }),
          );

          // If we get a 401/403 during initialization, go to login
          if (error.status === 401) {
            // Only navigate to login if not already on login page
            if (!this.router.url.includes('/login')) {
              this.router.navigate(['/login']);
            }
          }

          return of(null); // Return null instead of failing app initialization
        }),
      );
  }

  /**
   * Get the initial data as a snapshot (for synchronous access)
   */
  getInitialData(): InitialData | null {
    return this._initialData.getValue();
  }

  /**
   * Get the current user data as a snapshot (for synchronous access)
   */
  getCurrentUser(): InitialDataUser | null {
    return this._currentUser.getValue();
  }

  /**
   * Get the current client company data as a snapshot (for synchronous access)
   */
  getCurrentClientCompany(): ClientCompany | null {
    return this._currentClientCompany.getValue();
  }

  /**
   * Set the current client company
   */
  setCurrentClientCompany(clientCompany: ClientCompany): void {
    if (this._currentClientCompany.getValue()?.id === clientCompany.id) {
      return;
    }

    this._currentClientCompany.next(clientCompany);
    this.store.dispatch(AppDataActions.updateCurrentClientCompany({ clientCompany }));
    this.applyAssignedProjectsForCurrentCompany();
  }

  /**
   * Keep the full project list (all client companies) and refresh the filtered view.
   */
  setAllAssignedProjects(projects: ReadonlyArray<{ clientCompany?: { id?: number } }>): void {
    this._allAssignedProjects = projects as Array<AssignedProject & { clientCompany?: { id?: number } }>;
    this.applyAssignedProjectsForCurrentCompany();
  }

  /**
   * Get all assigned projects across every client company.
   */
  getAllAssignedProjects(): Array<AssignedProject & { clientCompany?: { id?: number } }> {
    return this._allAssignedProjects;
  }

  filterProjectsByClientCompany<T extends { clientCompany?: { id?: number } }>(projects: T[], clientCompany: ClientCompany | null = this.getCurrentClientCompany()): T[] {
    if (!clientCompany) {
      return projects;
    }

    return projects.filter((project) => project.clientCompany?.id === clientCompany.id);
  }

  private applyAssignedProjectsForCurrentCompany(): void {
    const filteredProjects = this.filterProjectsByClientCompany(this._allAssignedProjects);
    this._assignedProjects.next(filteredProjects as AssignedProject[]);
    this.store.dispatch(AppDataActions.updateAssignedProjects({ projects: filteredProjects }));
  }

  /**
   * Get all client companies
   */
  getClientCompanies(): ClientCompany[] {
    const data = this._initialData.getValue();
    return data?.clientCompanies || [];
  }

  /**
   * Get assigned projects as a snapshot (for synchronous access)
   */
  getAssignedProjects(): AssignedProject[] {
    return this._assignedProjects.getValue();
  }

  /**
   * Set assigned projects
   */
  setAssignedProjects(projects: AssignedProject[]): void {
    this.setAllAssignedProjects(projects);
  }
}
