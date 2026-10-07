import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, ReplaySubject } from 'rxjs';
import { tap } from 'rxjs/operators';
import { InitializerService, ClientCompany } from '@app/core/services/initializer.service';
import { ApiService } from '@app/core/services/api.service';

export interface Project {
  id: string;
  name: string;
  slug: string;
  clientId: string;
}

export interface Client {
  id: string;
  name: string;
  slug: string;
  projects?: Project[];
  image?: string;
  logo?: {
    id: string;
    path: string;
  };
}

export interface AssignedProject {
  id: number;
  name: string;
  description?: string;
  startDate: string;
  endDate: string;
  status?: string;
  isFavorite: boolean;
  clientCompany?: {
    id: number;
    name: string;
  };
  createdAt: string;
  updatedAt: string;
  reportedPercentage?: number; // Calculated in backend
  branchesCount?: number; // Total number of branches for this project
}

@Injectable({
  providedIn: 'root',
})
export class ClientService {
  // Mock data - replace with API call in production
  private clients: Client[] = [
    {
      id: '1',
      name: 'Luxottica',
      slug: 'luxottica',
      image: 'images/projects/p-1.png',
      projects: [
        { id: 'p1', name: 'Sommer', slug: 'sommer', clientId: '1' },
        { id: 'p2', name: 'Sale', slug: 'sale', clientId: '1' },
      ],
    },
    {
      id: '2',
      name: 'Woom',
      slug: 'woom',
      image: 'images/projects/p-2.png',
      projects: [
        { id: 'p3', name: 'Bike Design', slug: 'bike-design', clientId: '2' },
        { id: 'p4', name: 'Marketing Campaign', slug: 'marketing', clientId: '2' },
      ],
    },
    {
      id: '3',
      name: 'Hugendubel',
      slug: 'hugendubel',
      image: 'images/projects/p-3.png',
      projects: [
        { id: 'p5', name: 'Store Layout', slug: 'store-layout', clientId: '3' },
        { id: 'p6', name: 'E-commerce Platform', slug: 'ecommerce', clientId: '3' },
      ],
    },
  ];

  private clientsSubject = new BehaviorSubject<Client[]>(this.clients);
  private selectedClientSubject = new ReplaySubject<Client | null>(1);

  constructor(
    private initializerService: InitializerService,
    private apiService: ApiService,
  ) {}

  getClients(): Observable<Client[]> {
    return this.clientsSubject.asObservable();
  }

  getClientBySlug(slug: string): Client | undefined {
    const client = this.clients.find((client) => client.slug === slug);
    if (client) {
      this.selectedClientSubject.next(client);
    } else {
      this.selectedClientSubject.next(null);
    }
    return client;
  }

  getClientById(id: string): Client | undefined {
    const client = this.clients.find((client) => client.id === id);
    if (client) {
      this.selectedClientSubject.next(client);
    } else {
      this.selectedClientSubject.next(null);
    }
    return client;
  }

  fetchClientById(id: string): Observable<Client | undefined> {
    // For now, return the mock client. In production, this would make an API call
    const client = this.getClientById(id);
    return new Observable((observer) => {
      observer.next(client);
      observer.complete();
    });
  }

  getSelectedClient(): Observable<Client | null> {
    return this.selectedClientSubject.asObservable();
  }

  clearSelectedClient(): void {
    this.selectedClientSubject.next(null);
  }

  getProjectBySlug(clientSlug: string, projectSlug: string): Project | undefined {
    const client = this.clients.find((c) => c.slug === clientSlug);
    return client?.projects?.find((p) => p.slug === projectSlug);
  }

  // Method to get client companies from the initializer service
  getClientCompanies(): ClientCompany[] {
    return this.initializerService.getClientCompanies();
  }

  // Method to get current client company
  getCurrentClientCompany(): ClientCompany | null {
    return this.initializerService.getCurrentClientCompany();
  }

  /**
   * Get assigned projects for the current client user.
   * Use scope 'all' to fetch every assigned project (for company switching cache).
   * Use scope 'current' to fetch only projects for the selected client company.
   */
  getAssignedProjects(options: { scope?: 'all' | 'current' } = {}): Observable<AssignedProject[]> {
    const scope = options.scope ?? 'current';
    const currentCompany = this.initializerService.getCurrentClientCompany();
    const params = scope === 'current' && currentCompany?.id ? { clientCompanyId: currentCompany.id } : {};

    return this.apiService.get<AssignedProject[]>('client/projects/list', params);
  }

  /**
   * Refresh the full assigned-project cache used when switching client companies.
   */
  refreshAllAssignedProjects(): Observable<AssignedProject[]> {
    return this.getAssignedProjects({ scope: 'all' }).pipe(tap((projects) => this.initializerService.setAllAssignedProjects(projects)));
  }
}
