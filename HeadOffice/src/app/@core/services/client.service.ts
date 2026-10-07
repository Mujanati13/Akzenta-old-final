import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, ReplaySubject, combineLatest } from 'rxjs';
import { Store } from '@ngrx/store';
import { selectClientCompanies, selectInitialDataLoaded } from '@app/@core/store/app-data/app-data.selectors';
import { ClientCompany } from '@app/core/services/client-company.service';
import { filter, map, catchError, take, tap } from 'rxjs/operators';
import { ClientCompanyService } from '@app/core/services/client-company.service';

export interface Project {
  id: string;
  name: string;
  clientId: string;
}

export interface Client {
  id: string;
  name: string;
  projects?: Project[];
  image?: string;
  logo?: {
    id: string;
    path: string;
  };
  selectedProjectId?: string;
}

@Injectable({
  providedIn: 'root',
})
export class ClientService {
  private clientsSubject = new BehaviorSubject<Client[]>([]);
  private selectedClientSubject = new ReplaySubject<Client | null>(1);
  private selectedClientCache: Client | null = null;

  constructor(
    private store: Store,
    private clientCompanyService: ClientCompanyService,
  ) {
    this.initializeFromStore();
  }

  private initializeFromStore(): void {
    // Subscribe to both client companies and initial data loaded state
    combineLatest([this.store.select(selectClientCompanies), this.store.select(selectInitialDataLoaded)])
      .pipe(
        filter(([clientCompanies, initialDataLoaded]) => {
          // Only process when initial data is loaded and we have client companies
          return initialDataLoaded && Array.isArray(clientCompanies) && clientCompanies.length > 0;
        }),
      )
      .subscribe(([clientCompanies]) => {
        const clients = this.transformClientCompaniesToClients(clientCompanies);
        this.clientsSubject.next(clients);
      });
  }

  private transformClientCompaniesToClients(clientCompanies: ClientCompany[]): Client[] {
    return clientCompanies.map((company) => ({
      id: company.id.toString(),
      name: company.name,
      logo: company.logo || undefined,
      image: company.logo?.path || undefined,
      projects: [], // Projects will need to be loaded separately or from additional API data
    }));
  }

  getClients(): Observable<Client[]> {
    return this.clientsSubject.asObservable();
  }

  getClientById(id: string): Client | undefined {
    const clients = this.clientsSubject.getValue();
    const client = clients.find((client) => client.id === id);

    if (client) {
      // Only emit if different from current cache to avoid infinite loops
      if (!this.selectedClientCache || this.selectedClientCache.id !== client.id) {
        this.selectedClientCache = client;
        this.selectedClientSubject.next(client);
      }
    }
    return client;
  }

  getSelectedClient(): Observable<Client | null> {
    return this.selectedClientSubject.asObservable();
  }

  clearSelectedClient(): void {
    this.selectedClientCache = null;
    this.selectedClientSubject.next(null);
  }

  getProjectById(clientId: string, projectId: string): Project | undefined {
    const clients = this.clientsSubject.getValue();
    const client = clients.find((c) => c.id === clientId);
    return client?.projects?.find((p) => p.id === projectId);
  }

  setClientProjects(clientId: string, projects: Project[]): void {
    const clients = this.clientsSubject.getValue();

    if (!clients || clients.length === 0) {
      if (this.selectedClientCache) {
        this.selectedClientCache = {
          ...this.selectedClientCache,
          projects: projects.map((project) => ({
            ...project,
            id: project.id?.toString() || project.id,
            clientId: clientId,
          })),
        };
        this.selectedClientSubject.next(this.selectedClientCache);
      }
      return;
    }

    let updatedClient: Client | undefined;

    const updatedClients = clients.map((client) => {
      if (client.id === clientId) {
        updatedClient = {
          ...client,
          projects: projects.map((project) => ({
            ...project,
            id: project.id?.toString() || project.id,
            clientId: clientId,
          })),
        };
        return updatedClient;
      }
      return client;
    });

    if (!updatedClient) {
      const fallbackClient: Client = {
        ...(this.selectedClientCache?.id === clientId ? this.selectedClientCache : { id: clientId, name: 'Kunde' }),
        projects: projects.map((project) => ({
          ...project,
          id: project.id?.toString() || project.id,
          clientId: clientId,
        })),
      };
      this.selectedClientCache = fallbackClient;
      this.selectedClientSubject.next(fallbackClient);
      return;
    }

    this.selectedClientCache = updatedClient;
    this.clientsSubject.next(updatedClients);
    this.selectedClientSubject.next(updatedClient);
  }

  /**
   * Ensures the current client and project appear in the sidebar (report detail/edit routes).
   */
  syncReportSidebarContext(clientId: string, projectId: string, options?: { clientName?: string; projectName?: string }): void {
    if (!clientId || !projectId) {
      return;
    }

    const normalizedClientId = String(clientId);
    const normalizedProjectId = String(projectId);
    const clients = this.clientsSubject.getValue();

    let client = clients.find((c) => c.id === normalizedClientId) || (this.selectedClientCache?.id === normalizedClientId ? this.selectedClientCache : undefined);

    if (!client) {
      client = {
        id: normalizedClientId,
        name: options?.clientName || 'Kunde',
        projects: [],
      };
    } else {
      client = { ...client };
    }

    if (options?.clientName) {
      client.name = options.clientName;
    }

    const projects = [...(client.projects || [])];
    const projectIndex = projects.findIndex((p) => String(p.id) === normalizedProjectId);
    const projectEntry: Project = {
      id: normalizedProjectId,
      name: options?.projectName || projects[projectIndex]?.name || 'Projekt',
      clientId: normalizedClientId,
    };

    if (projectIndex >= 0) {
      projects[projectIndex] = { ...projects[projectIndex], ...projectEntry };
    } else {
      projects.push(projectEntry);
    }

    const updatedClient: Client = {
      ...client,
      projects,
      selectedProjectId: normalizedProjectId,
    };

    this.selectedClientCache = updatedClient;
    this.selectedClientSubject.next(updatedClient);

    if (clients.some((c) => c.id === normalizedClientId)) {
      this.clientsSubject.next(clients.map((c) => (c.id === normalizedClientId ? updatedClient : c)));
    }
  }

  setSelectedProject(clientId: string, projectId: string | null): void {
    const clients = this.clientsSubject.getValue();

    if (!clients || clients.length === 0) {
      if (this.selectedClientCache) {
        this.selectedClientCache = {
          ...this.selectedClientCache,
          selectedProjectId: projectId ?? undefined,
        };
        this.selectedClientSubject.next(this.selectedClientCache);
      }
      return;
    }

    let updatedClient: Client | undefined;

    const updatedClients = clients.map((client) => {
      if (client.id === clientId) {
        updatedClient = {
          ...client,
          selectedProjectId: projectId ?? undefined,
        };
        return updatedClient;
      }
      return client;
    });

    if (!updatedClient) {
      if (this.selectedClientCache?.id === clientId) {
        this.selectedClientCache = {
          ...this.selectedClientCache,
          selectedProjectId: projectId ?? undefined,
        };
        this.selectedClientSubject.next(this.selectedClientCache);
      }
      return;
    }

    this.selectedClientCache = updatedClient;
    this.clientsSubject.next(updatedClients);
    this.selectedClientSubject.next(updatedClient);
  }

  /**
   * Update sidebar clients with fresh data from clients list component
   * This is called when the clients list loads fresh data
   */
  updateSidebarClients(clientCompanies: ClientCompany[]): void {
    const clients = this.transformClientCompaniesToClients(clientCompanies);
    this.clientsSubject.next(clients);
  }

  /**
   * Update a single client entry in the sidebar cache (e.g., after client edit).
   */
  updateClientSidebarEntry(clientCompany: Partial<ClientCompany> & { id: number | string }): void {
    const clientId = String(clientCompany.id);
    const currentClients = this.clientsSubject.getValue();
    const nextName = typeof clientCompany.name === 'string' ? clientCompany.name : undefined;
    const nextLogo = clientCompany.logo ?? undefined;
    const nextImage = clientCompany.logo?.path ?? undefined;

    let hasUpdated = false;
    const updatedClients = currentClients.map((client) => {
      if (client.id !== clientId) {
        return client;
      }

      hasUpdated = true;
      return {
        ...client,
        name: nextName ?? client.name,
        logo: nextLogo !== undefined ? nextLogo : client.logo,
        image: nextImage !== undefined ? nextImage : client.image,
      };
    });

    if (!hasUpdated) {
      return;
    }

    this.clientsSubject.next(updatedClients);

    if (this.selectedClientCache?.id === clientId) {
      const selectedUpdated = updatedClients.find((client) => client.id === clientId) ?? null;
      this.selectedClientCache = selectedUpdated;
      this.selectedClientSubject.next(selectedUpdated);
    }
  }

  /**
   * Force refresh clients from store (useful for debugging or manual refresh)
   */
  refreshFromStore(): void {
    this.store
      .select(selectClientCompanies)
      .pipe(
        filter((clientCompanies) => Array.isArray(clientCompanies) && clientCompanies.length > 0),
        take(1),
      )
      .subscribe((clientCompanies) => {
        const clients = this.transformClientCompaniesToClients(clientCompanies);
        this.clientsSubject.next(clients);
      });
  }

  /**
   * Fetch a client by id from the backend if not found in the local store.
   * Updates the local store and selected client.
   */
  fetchClientById(id: string): Observable<Client | undefined> {
    const found = this.getClientById(id);
    if (found) {
      return new BehaviorSubject(found).asObservable();
    }
    // Try to fetch from backend
    return this.clientCompanyService.getClientCompanyWithRelationships(Number(id)).pipe(
      tap((company: any) => {
        const client: Client = {
          id: company.id.toString(),
          name: company.name,
          logo: company.logo || undefined,
          image: company.logo?.path || undefined,
          projects: [], // You may want to map projects if available
        };
        // Add to local store
        const clients = this.clientsSubject.getValue();
        this.clientsSubject.next([...clients, client]);
        this.selectedClientSubject.next(client);
      }),
      map((company: any) => {
        return {
          id: company.id.toString(),
          name: company.name,
          logo: company.logo || undefined,
          image: company.logo?.path || undefined,
          projects: [],
        } as Client;
      }),
      catchError(() => {
        this.selectedClientSubject.next(null);
        return new BehaviorSubject(undefined).asObservable();
      }),
    );
  }
}
