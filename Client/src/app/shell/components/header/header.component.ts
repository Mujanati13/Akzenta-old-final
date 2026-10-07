import { Component, EventEmitter, OnInit, Output, OnDestroy, HostListener, ElementRef, ViewChild } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { ClientService } from '@core/services/client.service';
import { InitializerService, ClientCompany } from '@app/core/services/initializer.service';
import { FilterResetService } from '@core/services/filter-reset.service';
import { ProjectsStateService } from '@app/pages/projects/projects-state.service';
import { DashboardStateService } from '@app/pages/dashboard/dashboard-state.service';
import { FavoritesStateService } from '@app/pages/favorites/favorites-state.service';
import { filter, map, take } from 'rxjs/operators';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
  standalone: false,
})
export class HeaderComponent implements OnInit, OnDestroy {
  @Output() sidebarToggle = new EventEmitter<void>();

  currentClient: any = null;
  currentClientCompany: ClientCompany | null = null;
  clientLogo: string | null = null;
  showClientDropdown = false;
  clientDropdownStyle: { top: string; right: string } = { top: '0px', right: '0px' };
  private clientSub: Subscription;
  private clientCompanySub: Subscription;

  @ViewChild('clientDropdownButton') clientDropdownButton?: ElementRef<HTMLButtonElement>;

  constructor(
    private router: Router,
    private activatedRoute: ActivatedRoute,
    private clientService: ClientService,
    private initializerService: InitializerService,
    private filterResetService: FilterResetService,
    private projectsStateService: ProjectsStateService,
    private dashboardStateService: DashboardStateService,
    private favoritesStateService: FavoritesStateService,
  ) {}

  ngOnInit(): void {
    // Subscribe to client company changes from initializer service
    this.clientCompanySub = this.initializerService.currentClientCompany$.subscribe((clientCompany) => {
      this.currentClientCompany = clientCompany;
      this.clientLogo = clientCompany?.logo?.path || null;
      console.log('🔄 Header: Client company updated', {
        name: clientCompany?.name,
        logo: clientCompany?.logo?.path,
      });
    });

    // Subscribe to client changes (for backward compatibility)
    this.clientSub = this.clientService.getSelectedClient().subscribe((client) => {
      this.currentClient = client;
      // Only update logo if we don't have a client company logo
      if (!this.clientLogo) {
        this.clientLogo = client?.image || client?.logo?.path || null;
      }
    });

    // On navigation, trigger fetch
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        map(() => this.getClientIdFromRoute(this.activatedRoute.root)),
      )
      .subscribe((clientId) => {
        if (clientId) {
          // Try to get from store, else fetch from backend
          const found = this.clientService.getClientById(clientId);
          if (!found) {
            this.clientService.fetchClientById(clientId).pipe(take(1)).subscribe();
          } else {
            // Ensure selected client is set
            this.clientService.getClientById(clientId);
          }
        } else {
          this.currentClient = null;
          // Don't clear clientLogo here as it might be set by client company
        }
      });
  }

  ngOnDestroy(): void {
    this.clientSub?.unsubscribe();
    this.clientCompanySub?.unsubscribe();
  }

  // Helper method to find clientId in the route tree
  private getClientIdFromRoute(route: ActivatedRoute): string | null {
    if (route.firstChild) {
      return this.getClientIdFromRoute(route.firstChild);
    }

    // Look for 'id' parameter (assuming your route is /clients/:id)
    if (route.snapshot.paramMap.has('id')) {
      return route.snapshot.paramMap.get('id');
    }

    // If you're using a different parameter name, update this accordingly
    if (route.snapshot.paramMap.has('clientId')) {
      return route.snapshot.paramMap.get('clientId');
    }

    return null;
  }

  private updateCurrentClient(clientId: string): void {
    this.currentClient = this.clientService.getClientById(clientId);
  }

  toggleSidebar(): void {
    this.sidebarToggle.emit();
  }

  onImageError(event: any): void {
    // Set fallback image when logo fails to load
    event.target.src = '/images/placeholder.png';
  }

  /**
   * Get all available client companies
   */
  getClientCompanies(): ClientCompany[] {
    return this.initializerService.getClientCompanies();
  }

  /**
   * Switch to a different client company
   */
  switchClientCompany(clientCompany: ClientCompany): void {
    if (this.currentClientCompany?.id === clientCompany.id) {
      return;
    }

    this.initializerService.setCurrentClientCompany(clientCompany);

    this.projectsStateService.clearCache();
    this.dashboardStateService.clearCache();
    this.favoritesStateService.clearCache();

    this.clientService
      .refreshAllAssignedProjects()
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.filterResetService.reset();

          const projectMatch = this.router.url.match(/\/projects\/([^/?]+)/);
          if (projectMatch?.[1]) {
            const projectId = projectMatch[1];
            const belongsToCompany = this.initializerService.getAllAssignedProjects().some((project) => project.id.toString() === projectId && project.clientCompany?.id === clientCompany.id);

            if (!belongsToCompany) {
              this.router.navigate(['/projects']);
            }
          }
        },
        error: () => {
          this.filterResetService.reset();
        },
      });
  }

  /**
   * Toggle the client dropdown menu
   */
  toggleClientDropdown(): void {
    this.showClientDropdown = !this.showClientDropdown;
    if (this.showClientDropdown) {
      this.updateClientDropdownPosition();
    }
  }

  @HostListener('window:resize')
  @HostListener('window:scroll')
  onViewportChange(): void {
    if (this.showClientDropdown) {
      this.updateClientDropdownPosition();
    }
  }

  private updateClientDropdownPosition(): void {
    const button = this.clientDropdownButton?.nativeElement;
    if (!button) {
      return;
    }

    const rect = button.getBoundingClientRect();
    this.clientDropdownStyle = {
      top: `${rect.bottom + 12}px`,
      right: `${Math.max(8, window.innerWidth - rect.right)}px`,
    };
  }

  /**
   * Close dropdown when clicking outside
   */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.client-dropdown')) {
      this.showClientDropdown = false;
    }
  }
}
