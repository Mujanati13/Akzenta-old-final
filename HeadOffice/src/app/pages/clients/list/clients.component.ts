import { Component, inject, OnInit, OnDestroy, Renderer2, AfterViewInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { Location } from '@angular/common';
import { HotToastService } from '@ngxpert/hot-toast';
import { ClientCompanyService, ClientCompany, InfinityPaginationResponse } from '@app/core/services/client-company.service';
import { ClientService } from '@app/@core/services/client.service'; // Add this import
import { finalize, catchError, of, take } from 'rxjs';
import { ClientsStateService } from './clients-state.service';

interface ReportCounts {
  newReports: number;
  ongoingReports: number;
  completedReports: number;
}

interface City {
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

interface CardItem {
  id: number;
  isFavorite: boolean;
  isMyClient: boolean;
  name: string;
  city: string; // Keep for backward compatibility
  cities: City[]; // Add cities array from backend
  image: string;
  logo?: {
    id: string;
    path: string;
  } | null;
  createdAt: Date;
  updatedAt: Date;
  reportCounts?: ReportCounts;
}

@Component({
  selector: 'app-clients',
  templateUrl: './clients.component.html',
  styleUrl: './clients.component.scss',
  standalone: false,
})
export class ClientsComponent implements OnInit, OnDestroy, AfterViewInit {
  showMobileFilters = false;
  isLoading = true;
  cards: CardItem[] = [];
  allCards: CardItem[] = []; // Store original list
  searchTerm: string = '';
  showOnlyFavorites: boolean = false;
  activeFilter: 'all' | 'my-clients' = 'my-clients'; // Default to 'my-clients'

  // Check if can go back (has navigation history)
  canGoBack: boolean = false;

  // Pagination properties
  currentPage = 1;
  pageSize = 50; // Fetch maximum allowed items per request (backend limit is 50)
  hasNextPage = false;
  isLoadingMore = false;
  private dataLoaded = false; // Track if initial data has been loaded
  private scrollListener: (() => void) | null = null;
  private scrollPosition = 0;
  private highlightId: number | null = null;
  private initialLoadTriggered = false;

  private readonly _toast = inject(HotToastService);

  constructor(
    private clientCompanyService: ClientCompanyService,
    private clientService: ClientService,
    private clientsStateService: ClientsStateService,
    private router: Router,
    private route: ActivatedRoute,
    private renderer: Renderer2,
    private location: Location,
  ) {
    // Check if we have navigation history
    const navigation = this.router.getCurrentNavigation();
    this.canGoBack = !!navigation?.previousNavigation;
  }

  ngOnInit() {
    // Try to restore from cached state first to show data immediately
    const cachedState = this.clientsStateService.getState();

    if (cachedState && this.clientsStateService.isCacheValid()) {
      this.activeFilter = cachedState.activeFilter;
      this.searchTerm = cachedState.searchTerm;
      this.showOnlyFavorites = cachedState.showOnlyFavorites;
      this.currentPage = cachedState.currentPage;
      this.scrollPosition = cachedState.scrollPosition || 0;
      this.hasNextPage = cachedState.hasNextPage;

      // Restore state if available (for immediate display) when cards are still in memory.
      if (cachedState.allCards && cachedState.allCards.length > 0) {
        this.allCards = cachedState.allCards;
        this.dataLoaded = true;

        // Apply filters to restore the correct view immediately
        this.applyFilters();
      }
    }

    // Always load fresh data from server when entering the page (background update)
    this.isLoading = true;

    this.route.queryParams.subscribe((params) => {
      const filterParam = params['filter'];
      const searchParam = params['search'];
      const highlightId = params['highlightId'];

      // Restore search term (overrides cache if different)
      this.searchTerm = searchParam || '';

      // Restore filter state (overrides cache if different)
      if (filterParam === 'all') {
        this.activeFilter = 'all';
      } else {
        this.activeFilter = 'my-clients';
      }

      if (highlightId) {
        this.highlightId = Number(highlightId);
      }

      if (!this.initialLoadTriggered) {
        this.initialLoadTriggered = true;
        // Load all clients from database (force reload)
        this.loadClientCompanies(true);
      } else {
        // Just re-apply filters if data is already loaded
        this.applyFilters();

        // Handle highlight if present
        if (this.highlightId) {
          setTimeout(() => this.scrollToCard(this.highlightId!), 500);
        }
      }
    });
  }

  ngAfterViewInit() {
    // Restore scroll position if we have one
    if (this.scrollPosition > 0) {
      // Use a small timeout to ensure DOM is rendered
      setTimeout(() => {
        window.scrollTo(0, this.scrollPosition);
      }, 100);
    }

    // Listen to window scroll
    this.scrollListener = this.renderer.listen('window', 'scroll', () => {
      this.scrollPosition = window.scrollY || document.documentElement.scrollTop;
    });
  }

  ngOnDestroy() {
    // Remove listener
    if (this.scrollListener) {
      this.scrollListener();
    }
    // Save current state when leaving the page
    this.saveCurrentState();
  }

  navigateBack(): void {
    if (this.canGoBack) {
      this.location.back();
    }
  }

  /**
   * Save current state to the state service
   */
  private saveCurrentState(): void {
    this.clientsStateService.saveState({
      allCards: this.allCards,
      activeFilter: this.activeFilter,
      searchTerm: this.searchTerm,
      showOnlyFavorites: this.showOnlyFavorites,
      currentPage: this.currentPage,
      hasNextPage: this.hasNextPage,
      scrollPosition: this.scrollPosition,
    });
  }

  /**
   * Update URL params to reflect current filter state
   */
  private updateUrlParams(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        filter: this.activeFilter,
        search: this.searchTerm || null,
      },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  /**
   * Load client companies from the backend
   * @param forceReload - If true, forces a reload even if data already exists
   */
  loadClientCompanies(forceReload: boolean = false): void {
    // Optimization: Skip API call if data already exists and we're on page 1
    if (!forceReload && this.currentPage === 1 && this.dataLoaded && this.allCards.length > 0) {
      this.isLoading = false;
      this.applyFilters();
      return;
    }

    this.isLoading = true;

    this.clientCompanyService
      .getClientCompanies(this.currentPage, this.pageSize)
      .pipe(
        finalize(() => {
          this.isLoading = false;
        }),
        catchError((error) => {
          console.error('❌ Error loading client companies:', error);

          this._toast.error('Fehler beim Laden der Kunden', {
            position: 'bottom-right',
            duration: 4000,
          });

          // Return empty response to continue with empty state
          return of({ data: [], hasNextPage: false } as InfinityPaginationResponse<ClientCompany>);
        }),
      )
      .subscribe({
        next: (response: InfinityPaginationResponse<ClientCompany>) => {
          // Transform backend data to CardItem format
          const transformedCards = this.transformToCardItems(response.data);

          if (this.currentPage === 1) {
            // First load - replace all cards
            this.cards = transformedCards;
            this.allCards = [...transformedCards];
            this.dataLoaded = true; // Mark data as loaded

            // Update sidebar with fresh data (only on first load, not pagination)
            this.clientService.updateSidebarClients(response.data);
          } else {
            // Pagination - append to existing cards
            this.cards = [...this.cards, ...transformedCards];
            this.allCards = [...this.allCards, ...transformedCards];
          }

          this.hasNextPage = response.hasNextPage;

          // Apply current filters
          this.applyFilters();

          // Save state after successful load
          this.saveCurrentState();

          // Scroll to highlighted card if present
          if (this.highlightId) {
            setTimeout(() => this.scrollToCard(this.highlightId!), 500);
          }
        },
      });
  }

  /**
   * Scroll to a specific card by ID
   */
  private scrollToCard(id: number): void {
    const element = document.getElementById(`client-card-${id}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });

      // Add a temporary highlight effect
      this.renderer.addClass(element, 'ring-4');
      this.renderer.addClass(element, 'ring-primary-500');
      this.renderer.addClass(element, 'ring-opacity-50');

      setTimeout(() => {
        this.renderer.removeClass(element, 'ring-4');
        this.renderer.removeClass(element, 'ring-primary-500');
        this.renderer.removeClass(element, 'ring-opacity-50');

        // Clear the highlight ID from URL without reloading
        this.highlightId = null;
        const queryParams = { ...this.route.snapshot.queryParams };
        delete queryParams['highlightId'];
        this.router.navigate([], {
          relativeTo: this.route,
          queryParams,
          queryParamsHandling: 'merge',
          replaceUrl: true,
        });
      }, 3000);
    }
  }

  /**
   * Transform ClientCompany data to CardItem format
   */
  private transformToCardItems(companies: ClientCompany[]): CardItem[] {
    return companies.map((company) => {
      // Get cities from backend response
      const cities = (company as any).cities || [];

      // Use first city name as primary city for backward compatibility
      const primaryCity = cities.length > 0 ? cities[0].name : 'Unknown';

      return {
        id: company.id,
        isFavorite: company.isFavorite || false, // Use the real favorite status from backend
        isMyClient: (company as any).isMyClient ?? false,
        name: company.name,
        city: primaryCity, // Primary city for backward compatibility
        cities: cities, // Full cities array from backend
        image: company.logo?.path || '/images/projects/default-company.png', // Fallback image
        logo: company.logo,
        createdAt: company.createdAt,
        updatedAt: company.updatedAt,
        reportCounts: (company as any).reportCounts, // Include report counts from API response
      };
    });
  }

  /**
   * Load more client companies (pagination)
   * Always loads all clients, then filters client-side
   */
  loadMore(): void {
    if (this.isLoadingMore || !this.hasNextPage) {
      return;
    }

    this.isLoadingMore = true;
    this.currentPage++;

    // Always load all clients (not filtered), then filter client-side
    this.clientCompanyService
      .getClientCompanies(this.currentPage, this.pageSize)
      .pipe(
        finalize(() => {
          this.isLoadingMore = false;
        }),
        catchError((error) => {
          console.error('❌ Error loading more client companies:', error);

          this._toast.error('Fehler beim Laden weiterer Kunden', {
            position: 'bottom-right',
            duration: 4000,
          });

          // Reset page counter on error
          this.currentPage--;

          return of({ data: [], hasNextPage: false } as InfinityPaginationResponse<ClientCompany>);
        }),
      )
      .subscribe({
        next: (response: InfinityPaginationResponse<ClientCompany>) => {
          const transformedCards = this.transformToCardItems(response.data);

          // Append new cards to allCards
          this.allCards = [...this.allCards, ...transformedCards];
          this.hasNextPage = response.hasNextPage;

          // Apply current filters to include new items (client-side filtering)
          this.applyFilters();
        },
      });
  }

  /**
   * Refresh the client companies list
   */
  refreshClients(): void {
    this.currentPage = 1;
    this.hasNextPage = false;
    this.cards = [];
    this.allCards = [];
    this.dataLoaded = false; // Reset data loaded flag
    this.loadClientCompanies(true); // Force reload - This will automatically update the sidebar too
  }

  /**
   * Handle favorite toggle with backend call
   */
  onFavoriteChanged(newStatus: boolean, item: CardItem): void {
    // Optimistically update the UI
    const previousStatus = item.isFavorite;
    item.isFavorite = newStatus;

    // Also update in the original list
    const originalItem = this.allCards.find((card) => card.id === item.id);
    if (originalItem) {
      originalItem.isFavorite = newStatus;
    }

    // If in favorites mode and item is unfavorited, re-apply filter
    if (this.showOnlyFavorites && !newStatus) {
      this.applyFilters();
    }

    // Call backend to toggle favorite status
    this.clientCompanyService
      .toggleFavoriteStatus(item.id)
      .pipe(
        catchError((error) => {
          console.error('❌ Error toggling favorite status:', error);

          // Revert the optimistic update on error
          item.isFavorite = previousStatus;
          if (originalItem) {
            originalItem.isFavorite = previousStatus;
          }

          // Re-apply filters to show correct state
          if (this.showOnlyFavorites) {
            this.applyFilters();
          }

          this._toast.error('Fehler beim Aktualisieren des Favoritenstatus');

          return of(null);
        }),
      )
      .subscribe({
        next: (result) => {
          if (result) {
            // Update the status based on server response
            item.isFavorite = result.isFavorite;
            if (originalItem) {
              originalItem.isFavorite = result.isFavorite;
            }

            if (result.isFavorite) {
              this._toast.success('Kunde zu Favoriten hinzugefügt');
            } else {
              this._toast.info('Kunde aus Favoriten entfernt');
            }
          }
        },
      });
  }

  // Filter methods
  showAllClients() {
    this.activeFilter = 'all';
    this.showOnlyFavorites = false;
    // Update URL to remember filter state (preserve search term)
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { filter: 'all', search: this.searchTerm || null },
      queryParamsHandling: 'merge',
    });
    // Apply client-side filtering (no API call)
    this.applyFilters();
    // Save state
    this.saveCurrentState();
  }

  toggleMyClientsFilter() {
    this.activeFilter = 'my-clients';
    this.showOnlyFavorites = false;
    // Update URL to remember filter state (preserve search term)
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { filter: 'my-clients', search: this.searchTerm || null },
      queryParamsHandling: 'merge',
    });
    // Apply client-side filtering (no API call)
    this.applyFilters();
    // Save state
    this.saveCurrentState();
  }

  onSearchInput(event: any) {
    this.searchTerm = event.target.value;
    // Update URL to remember search term
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { search: this.searchTerm || null },
      queryParamsHandling: 'merge',
    });
    this.applyFilters();
    // Save state
    this.saveCurrentState();
  }

  clearSearch(): void {
    this.searchTerm = '';
    // Update URL to clear search term
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { search: null },
      queryParamsHandling: 'merge',
    });
    this.applyFilters();
    // Save state
    this.saveCurrentState();
  }

  private applyFilters() {
    let filteredCards = [...this.allCards];

    // Apply "my clients" filter (client-side)
    if (this.activeFilter === 'my-clients') {
      filteredCards = filteredCards.filter((card) => card.isMyClient);
    }

    // Apply favorites filter
    if (this.showOnlyFavorites) {
      filteredCards = filteredCards.filter((card) => card.isFavorite);
    }

    // Apply search filter
    if (this.searchTerm.trim()) {
      const searchLower = this.searchTerm.toLowerCase();
      filteredCards = filteredCards.filter((card) => {
        // Search in name, primary city, and all cities in the cities array
        const matchesName = card.name.toLowerCase().includes(searchLower);
        const matchesPrimaryCity = card.city.toLowerCase().includes(searchLower);
        const matchesId = card.id.toString().includes(searchLower);

        // Search through all cities in the cities array
        const matchesCities = card.cities.some((city) => city.name.toLowerCase().includes(searchLower));

        return matchesName || matchesPrimaryCity || matchesId || matchesCities;
      });
    }

    this.cards = filteredCards;
  }

  private resetFilters() {
    this.cards = [...this.allCards];
  }

  /**
   * Check if any filters are currently active (anything other than default 'my-clients')
   */
  hasActiveFilters(): boolean {
    return this.searchTerm.trim().length > 0 || this.showOnlyFavorites;
  }

  getActiveFilterCount(): number {
    let count = 0;
    if (this.searchTerm && this.searchTerm.trim().length > 0) count++;
    if (this.activeFilter === 'all') count++;
    if (this.showOnlyFavorites) count++;
    return count;
  }

  /**
   * Clear all filters and reset to default state (my-clients)
   */
  clearFilters(): void {
    this.searchTerm = '';
    this.showOnlyFavorites = false;
    this.currentPage = 1;
    // Don't clear allCards - just reapply filters to existing data
    // Only reload if we don't have data yet
    if (!this.dataLoaded || this.allCards.length === 0) {
      this.allCards = [];
      this.cards = [];
      this.dataLoaded = false;
      this.loadClientCompanies(true);
    } else {
      // Just reapply filters to existing data (no API call)
      this.applyFilters();
    }
    // Update URL to clear search state while leaving current client scope untouched
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { search: null },
      queryParamsHandling: 'merge',
    });
    // Save state
    this.saveCurrentState();
  }

  userClicked() {
    this._toast.show('User clicked');
  }

  /**
   * Navigate to client detail page
   */
  navigateToClient(clientId: number, newTab: boolean = false): void {
    const queryParams = { ...this.route.snapshot.queryParams };

    if (newTab) {
      const urlTree = this.router.createUrlTree(['/clients', clientId], { queryParams });
      const url = window.location.origin + urlTree.toString();
      window.open(url, '_blank');
    } else {
      this.router.navigate(['/clients', clientId], { queryParams });
    }
  }

  /**
   * Navigate to client edit page
   */
  navigateToClientEdit(clientId: number, newTab: boolean = false): void {
    const queryParams = { ...this.route.snapshot.queryParams };

    if (newTab) {
      const urlTree = this.router.createUrlTree(['/clients', clientId, 'edit'], { queryParams });
      const url = window.location.origin + urlTree.toString();
      window.open(url, '_blank');
    } else {
      this.router.navigate(['/clients', clientId, 'edit'], { queryParams });
    }
  }

  /**
   * Navigate to client reports filtered by status
   */
  navigateToClientReports(clientId: number, status: 'new' | 'ongoing' | 'completed', newTab: boolean = false): void {
    const queryParams = {
      ...this.route.snapshot.queryParams,
      status: status,
    };

    if (newTab) {
      const urlTree = this.router.createUrlTree(['/clients', clientId], { queryParams });
      const url = window.location.origin + urlTree.toString();
      window.open(url, '_blank');
    } else {
      this.router.navigate(['/clients', clientId], { queryParams });
    }
  }

  openClientInNewTab(clientId: number): void {
    this.navigateToClient(clientId, true);
  }

  openClientEditInNewTab(clientId: number): void {
    this.navigateToClientEdit(clientId, true);
  }

  openClientReportsInNewTab(clientId: number, status: 'new' | 'ongoing' | 'completed'): void {
    this.navigateToClientReports(clientId, status, true);
  }

  onFavoriteContextMenu(event: MouseEvent, clientId: number): boolean {
    event.preventDefault();
    event.stopPropagation();
    this.openClientInNewTab(clientId);
    return false;
  }

  /**
   * Navigate to add client page, preserving current filter state
   */
  navigateToAddClient(): void {
    const queryParams = { ...this.route.snapshot.queryParams };
    this.router.navigate(['/clients/add'], { queryParams });
  }

  /**
   * Track by function for cards to ensure proper animation on filter change
   */
  trackByCard = (index: number, item: CardItem): string => {
    // Include activeFilter in the key to force re-render (and thus re-animation) when filter changes
    return `${item.id}-${this.activeFilter}`;
  };
}
