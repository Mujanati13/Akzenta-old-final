import { Component, OnInit, inject, ViewChild, OnDestroy, AfterViewInit, Renderer2, ElementRef } from '@angular/core';
import { HttpClient, HttpContext } from '@angular/common/http';
import { Router, NavigationStart, NavigationEnd } from '@angular/router';
import { Location } from '@angular/common';
import { HotToastService } from '@ngxpert/hot-toast';
import { Merchandiser, MerchandiserSearchParams, MerchandiserService } from '@app/core/services/merchandiser.service';
import { SKIP_API_PREFIX, SKIP_AUTH_CHECK } from '@app/@core/interceptors/api-prefix.interceptor';
import { catchError, of, Observable, filter, takeUntil, Subject } from 'rxjs';
import { map } from 'rxjs/operators';
import { StaffTableComponent } from '../components/staff-table/staff-table.component';
import { StaffStateService } from './staff-state.service';
import { environment } from '../../../../environments/environment';

interface Column {
  field: string;
  header: string;
}

interface Staff {
  id?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  address?: string;
  postalCode?: string;
  city?: string;
  country?: string;
  distance?: string;
  qualifications?: string[];
  dateOfBirth?: string;
  status?: string;
  portrait?: {
    id?: string;
    path?: string;
  };
  isFavorite?: boolean;
  location?: { lat: number; lng: number };
  clientCompanies?: { id: number; name: string }[];
}

@Component({
  selector: 'app-staff',
  standalone: false,
  templateUrl: './staff.component.html',
  styleUrls: ['./staff.component.scss'],
})
export class StaffComponent implements OnInit, OnDestroy, AfterViewInit {
  staffData: Staff[] = [];
  allStaffData: Staff[] = []; // Store all loaded data for client-side filtering
  viewMode: 'table' | 'map' | 'grid' = 'table';
  expandedRows = {};
  cols: Column[] = [];
  selectedColumns: Column[] = [];

  // Add loading and error states
  loading = false;
  error: string | null = null;

  // Add pagination
  currentPage = 1;
  pageSize = 50;
  totalItems = 0;
  first = 0; // For PrimeNG paginator
  hasNextPage = false;

  // Add search parameters with required fields
  searchParams: MerchandiserSearchParams = {
    name: '',
    location: '',
    qualifications: '',
    status: '',
    clientAssignment: '',
    customFilter: '',
    page: 1,
    // Don't set limit by default - will be set based on view mode
  };

  showMobileFilters = true;
  showStaffMobileTopFilterSheet = false;

  readonly emptyMobileFilterValues: { [field: string]: string[] } = {};
  readonly emptyMobileColumnOptions: { [field: string]: { label: string; value: string }[] } = {};
  readonly emptyMobileCanFilterMap: { [field: string]: boolean } = {};

  // Filter options with checkboxes
  filters = {
    firstName: '',
    lastName: '',
    address: '',
    country: '',
    distance: '',
    qualifications: {} as Record<string, boolean>,
    status: {} as Record<string, boolean>,
  };

  // Job types for qualification dropdown
  jobTypes: { id: number; name: string }[] = [];
  selectedQualification: string[] = [];

  // Statuses for status dropdown
  statuses: { id: number; name: string }[] = [];
  selectedStatus: string | null = null;

  private searchTimeout: any;
  private readonly _toast = inject(HotToastService);

  // Store reference location coordinates for distance calculation
  // Default: Frankfurt am Main (50.1109° N, 8.6821° E)
  private readonly defaultReferenceLocation: { lat: number; lng: number } = { lat: 50.1109, lng: 8.6821 };
  private referenceLocation: { lat: number; lng: number } | null = null;
  private searchRadiusKm = 50;
  private lastGeocodedLocationQuery: string | null = null;

  private scrollListener: (() => void) | null = null;
  private scrollPosition = 0;
  private destroy$ = new Subject<void>();
  private previousUrl: string = ''; // Track previous URL for navigation detection
  private dataPrefetched = false; // Flag to track if data was prefetched
  private routerSubscription: any;
  private initialLoadDone = false; // Flag to track if initial load is done

  staffColumnFilters: { [key: string]: string[] } = {
    firstName: [],
    lastName: [],
    email: [],
    phone: [],
    address: [],
    city: [],
    distance: [],
    qualifications: [],
    status: [],
  };

  // Variant selector for reset button (1-8)
  resetButtonVariant = 1;

  gridFilters = {
    firstName: '',
    lastName: '',
    address: '',
    country: '',
    distance: '',
    qualifications: {} as Record<string, boolean>,
    status: {} as Record<string, boolean>,
  };

  mapFilters = {
    qualifications: {} as Record<string, boolean>,
    status: {} as Record<string, boolean>,
  };

  @ViewChild('staffTable') staffTableComponent?: StaffTableComponent;
  @ViewChild('staffScrollRoot') staffScrollRoot?: ElementRef<HTMLElement>;
  private scrollContainerEl: HTMLElement | null = null;

  constructor(
    private merchandiserService: MerchandiserService,
    private http: HttpClient,
    private staffStateService: StaffStateService,
    private renderer: Renderer2,
    private router: Router,
    private location: Location,
  ) {
    // Subscribe to router events to save state when navigating away and prefetch data when returning
    this.routerSubscription = this.router.events
      .pipe(
        filter((event) => event instanceof NavigationStart || event instanceof NavigationEnd),
        takeUntil(this.destroy$),
      )
      .subscribe((event) => {
        if (event instanceof NavigationStart) {
          // Save the current URL as previous before navigation
          this.previousUrl = this.router.url;

          // Prefetch staff data when navigating TO staff list page FROM edit/detail page
          // This ensures data is ready before the component loads
          const nextUrl = event.url;
          if ((nextUrl === '/staff' || nextUrl.startsWith('/staff?')) && this.previousUrl.includes('/staff/') && (this.previousUrl.includes('/edit') || this.previousUrl.match(/\/staff\/\d+$/))) {
            // Prefetch data before component loads
            this.dataPrefetched = true;
            this.prefetchStaffData();
          } else {
            this.dataPrefetched = false;
          }

          // Save state when navigating away from staff list page (to any other page)
          // Check if current URL is staff list and new URL is different
          const currentUrl = this.router.url;
          if (currentUrl === '/staff' || currentUrl.startsWith('/staff?')) {
            if (!nextUrl.includes('/staff') || (nextUrl.includes('/staff/') && !nextUrl.startsWith('/staff?'))) {
              // Save state immediately before navigation destroys the view
              this.saveCurrentState();
            }
          }
        } else if (event instanceof NavigationEnd) {
          // No-op: return flow is handled in ngOnInit via cached restore first,
          // then background refresh. Avoid forced refresh here to prevent
          // mobile scroll/filter state from being reset right after restore.
        }
      });
  }

  ngOnInit() {
    this.initializeColumns();
    this.loadFilterOptions();

    // Try to restore from cached state first (like dashboard pattern)
    const cachedData = this.staffStateService.getStaffDataSnapshot();

    // Always restore view mode/pagination selections when available, even if data cache is empty
    if (cachedData) {
      if (cachedData.viewMode) {
        this.viewMode = cachedData.viewMode;
      }
      if (typeof cachedData.pageSize === 'number') {
        this.pageSize = cachedData.pageSize;
      }
      if (typeof cachedData.currentPage === 'number') {
        this.currentPage = cachedData.currentPage;
      }
      if (typeof cachedData.first === 'number') {
        this.first = cachedData.first;
      }
      if (cachedData.selectedQualification !== undefined) {
        const cached = cachedData.selectedQualification;
        this.selectedQualification = Array.isArray(cached) ? cached : (cached ? String(cached).split(',').map((s) => s.trim()).filter(Boolean) : []);
      }
      if (cachedData.selectedStatus !== undefined) {
        this.selectedStatus = cachedData.selectedStatus;
      }
      if (cachedData.staffColumnFilters) {
        this.staffColumnFilters = { ...cachedData.staffColumnFilters };
      }
      if (cachedData.gridFilters) {
        this.gridFilters = {
          ...this.gridFilters,
          ...cachedData.gridFilters,
          qualifications: { ...this.gridFilters.qualifications, ...cachedData.gridFilters.qualifications },
          status: { ...this.gridFilters.status, ...cachedData.gridFilters.status },
        };
      }
      if (cachedData.mapFilters) {
        this.mapFilters = {
          qualifications: { ...this.mapFilters.qualifications, ...cachedData.mapFilters.qualifications },
          status: { ...this.mapFilters.status, ...cachedData.mapFilters.status },
        };
      }
      if (cachedData.searchParams) {
        this.searchParams = { ...this.searchParams, ...cachedData.searchParams };
      }
      if (cachedData.showMobileFilters !== undefined && cachedData.showMobileFilters !== null) {
        this.showMobileFilters = cachedData.showMobileFilters;
      }
      if (cachedData.referenceLocation) {
        this.referenceLocation = { ...cachedData.referenceLocation };
      }
      if (cachedData.searchParams?.location?.trim()) {
        const parsed = this.parseLocationQuery(cachedData.searchParams.location);
        this.searchRadiusKm = parsed.radiusKm;
        if (this.referenceLocation) {
          this.lastGeocodedLocationQuery = cachedData.searchParams.location.trim();
        }
      }
    }

    // Check if data was prefetched (when returning from edit/detail page)
    // When returning from edit/detail, check if prefetched data is ready, otherwise load fresh
    if (this.dataPrefetched) {
      // Check if prefetched data is already available in state service
      const prefetchedData = this.staffStateService.getStaffDataSnapshot();
      if (prefetchedData && prefetchedData.allStaffData && prefetchedData.allStaffData.length > 0) {
        // Prefetched data is ready - use it immediately
        this.allStaffData = [...prefetchedData.allStaffData];
        this.totalItems = prefetchedData.totalItems || prefetchedData.allStaffData.length;
        this.hasNextPage = false;

        // Restore filters and view mode from prefetched data
        if (prefetchedData.searchParams) {
          this.searchParams = { ...this.searchParams, ...prefetchedData.searchParams };
          if (this.searchParams.qualifications) this.selectedQualification = this.searchParams.qualifications.split(',').map((s) => s.trim()).filter(Boolean);
          if (this.searchParams.status) this.selectedStatus = this.searchParams.status;
        }
        if (prefetchedData.viewMode) {
          this.viewMode = prefetchedData.viewMode;
        }
        if (prefetchedData.scrollPosition) {
          this.scrollPosition = prefetchedData.scrollPosition;
        }
        if (prefetchedData.staffColumnFilters) {
          this.staffColumnFilters = { ...this.staffColumnFilters, ...prefetchedData.staffColumnFilters };
        }

        this.loading = false;
        this.initialLoadDone = true;
        this.applyClientSideFilters();
        this.restoreScrollPosition();
      } else {
        // Prefetch not complete yet - show loading and wait for prefetch via subscription
        // The subscription will update the component when prefetch completes
        this.loading = true;

        // Fallback: If prefetch doesn't complete within 2 seconds, load fresh data
        setTimeout(() => {
          if (this.loading && this.dataPrefetched) {
            // Prefetch took too long, load fresh data as fallback
            this.staffStateService.clearCache();
            if (this.searchParams.location?.trim()) {
              this.onSearch();
            } else {
              this.loadStaffData({ showLoader: true });
            }
          }
        }, 2000);
      }
    } else if (cachedData && cachedData.allStaffData && cachedData.allStaffData.length > 0 && this.staffStateService.isCacheValid()) {
      this.allStaffData = [...cachedData.allStaffData];
      this.totalItems = cachedData.totalItems || cachedData.allStaffData.length;
      this.hasNextPage = false;

      // Restore filters and view mode from cache
      if (cachedData.searchParams) {
        this.searchParams = { ...this.searchParams, ...cachedData.searchParams };
        // Restore dropdowns
        if (this.searchParams.qualifications) this.selectedQualification = this.searchParams.qualifications.split(',').map((s) => s.trim()).filter(Boolean);
        if (this.searchParams.status) this.selectedStatus = this.searchParams.status;
      }
      if (cachedData.viewMode) {
        this.viewMode = cachedData.viewMode;
      }

      if (cachedData.scrollPosition) {
        this.scrollPosition = cachedData.scrollPosition;
      }

      this.loading = false;
      this.initialLoadDone = true;

      // Apply filters to show correct data immediately
      this.applyClientSideFilters();
      this.restoreScrollPosition();

      // Load fresh data in background (without showing loader)
      setTimeout(() => {
        this.loadStaffData({ showLoader: false });
      }, 100);
    } else {
      // No valid cache, load from server with loader
      this.loading = true;
      // If location is restored from query params, trigger search to calculate distances
      if (this.searchParams.location?.trim()) {
        this.onSearch();
      } else {
        this.loadStaffData({ showLoader: true });
      }
    }

    // Subscribe to data updates from state service to catch prefetch completions
    this.subscribeToDataUpdates();
  }

  /**
   * Subscribe to data updates from state service
   * This catches prefetch completions that happen after component initialization
   */
  private subscribeToDataUpdates(): void {
    this.staffStateService.staffData$
      .pipe(
        takeUntil(this.destroy$),
        filter((data) => data !== null && this.dataPrefetched), // Only update if we're expecting prefetched data
      )
      .subscribe((data) => {
        if (data && this.dataPrefetched && this.loading) {
          // Fresh data arrived from prefetch, update the component
          this.allStaffData = data.allStaffData || [];
          this.totalItems = data.totalItems || data.allStaffData.length;
          this.hasNextPage = false;

          // Restore filters and view mode from prefetched data
          if (data.searchParams) {
            this.searchParams = { ...this.searchParams, ...data.searchParams };
        if (this.searchParams.qualifications) this.selectedQualification = this.searchParams.qualifications.split(',').map((s) => s.trim()).filter(Boolean);
            if (this.searchParams.status) this.selectedStatus = this.searchParams.status;
          }
          if (data.viewMode) {
            this.viewMode = data.viewMode;
          }
          if (data.staffColumnFilters) {
            this.staffColumnFilters = { ...this.staffColumnFilters, ...data.staffColumnFilters };
          }
          if (data.scrollPosition) {
            this.scrollPosition = data.scrollPosition;
          }

          this.loading = false;
          this.initialLoadDone = true;
          this.applyClientSideFilters();
          this.restoreScrollPosition();
        }
      });
  }

  ngAfterViewInit() {
    this.scrollContainerEl = this.resolveScrollContainer();
    this.restoreScrollPosition();

    // Listen to the actual scrolling element used by this page.
    const scrollTarget: any = this.scrollContainerEl || 'window';
    this.scrollListener = this.renderer.listen(scrollTarget, 'scroll', () => {
      this.scrollPosition = this.getCurrentScrollPosition();
    });
  }

  /**
   * Prefetch staff data before component loads
   * Called in NavigationStart to ensure data is ready when component initializes
   */
  private prefetchStaffData(): void {
    // Get stored state for search params (component may not be initialized yet)
    // Note: We get state before clearing cache to preserve filters/search params
    const storedState = this.staffStateService.getStaffDataSnapshot();
    const searchParams = storedState?.searchParams || {
      name: '',
      location: '',
      qualifications: '',
      status: '',
      clientAssignment: '',
      customFilter: '',
      page: 1,
    };
    const viewMode = storedState?.viewMode || 'table';
    const scrollPosition = storedState?.scrollPosition || 0;
    const referenceLocation = storedState?.referenceLocation || null;
    const staffColumnFilters = storedState?.staffColumnFilters || {};
    const gridFilters = storedState?.gridFilters;
    const mapFilters = storedState?.mapFilters;
    const pageSize = storedState?.pageSize;
    const currentPage = storedState?.currentPage;
    const first = storedState?.first;
    const selectedQualification = storedState?.selectedQualification;
    const selectedStatus = storedState?.selectedStatus;

    // Clear old cache to ensure we fetch fresh data
    this.staffStateService.clearCache();

    const loadParams = this.buildApiSearchParams();

    // Fetch data and update store immediately (before component loads)
    this.merchandiserService
      .searchMerchandisers(loadParams)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          // Update store immediately with fresh data and preserved state
          const allStaffData = this.mapMerchandisersToStaff(response.data || []);
          this.staffStateService.saveState({
            allStaffData: allStaffData,
            totalItems: response.totalCount || allStaffData.length,
            searchParams: searchParams,
            viewMode: viewMode,
            scrollPosition: scrollPosition,
            referenceLocation: referenceLocation,
            staffColumnFilters: staffColumnFilters,
            gridFilters: gridFilters,
            mapFilters: mapFilters,
            pageSize: pageSize,
            currentPage: currentPage,
            first: first,
            selectedQualification: selectedQualification,
            selectedStatus: selectedStatus,
          });
        },
        error: (error) => {
          console.error('Error prefetching staff:', error);
          // Reset prefetch flag on error so component knows to load normally
          this.dataPrefetched = false;
        },
      });
  }

  /**
   * Refresh staff list and update store
   * Called when returning from edit/detail page after successful update
   */
  refreshStaffList(): void {
    // Only refresh if component is already initialized (not during initial load)
    if (!this.initialLoadDone) {
      return;
    }

    // Reload staff with current filters from backend so data is fresh
    this.loading = true;
    this.fetchStaffData({ showLoader: true });
  }

  ngOnDestroy() {
    // Remove listener
    if (this.scrollListener) {
      this.scrollListener();
    }

    // Save state
    this.saveCurrentState();

    // Unsubscribe from router events
    if (this.routerSubscription) {
      this.routerSubscription.unsubscribe();
    }

    this.destroy$.next();
    this.destroy$.complete();
  }

  private saveCurrentState() {
    this.scrollPosition = this.getCurrentScrollPosition();
    this.staffStateService.saveState({
      allStaffData: this.allStaffData,
      totalItems: this.totalItems,
      searchParams: this.searchParams,
      showMobileFilters: this.showMobileFilters,
      viewMode: this.viewMode,
      scrollPosition: this.scrollPosition,
      pageSize: this.pageSize,
      currentPage: this.currentPage,
      first: this.first,
      selectedQualification: this.selectedQualification,
      selectedStatus: this.selectedStatus,
      staffColumnFilters: this.staffColumnFilters,
      gridFilters: this.gridFilters,
      mapFilters: this.mapFilters,
      referenceLocation: this.referenceLocation,
    });
  }

  private getCurrentScrollPosition(): number {
    const container = this.scrollContainerEl || this.resolveScrollContainer();
    if (container) {
      this.scrollContainerEl = container;
      const containerTop = container.scrollTop || 0;
      const windowTop = typeof window !== 'undefined' ? window.scrollY || document.documentElement.scrollTop || 0 : 0;
      return Math.max(containerTop, windowTop);
    }
    if (typeof window === 'undefined') {
      return 0;
    }
    return window.scrollY || document.documentElement.scrollTop || 0;
  }

  private restoreScrollPosition(): void {
    const target = this.scrollPosition || 0;
    if (target <= 0 || typeof window === 'undefined') {
      return;
    }

    let attempts = 0;
    const maxAttempts = 120;
    const tryRestore = () => {
      const current = this.getCurrentScrollPosition();
      if (Math.abs(current - target) > 2) {
        const container = this.scrollContainerEl || this.resolveScrollContainer();
        if (container) {
          this.scrollContainerEl = container;
          container.scrollTop = target;
          requestAnimationFrame(() => {
            container.scrollTop = target;
          });
        }
        window.scrollTo(0, target);
        requestAnimationFrame(() => {
          window.scrollTo(0, target);
        });
      }

      if (attempts < maxAttempts) {
        attempts++;
        setTimeout(tryRestore, 16);
      }
    };

    setTimeout(tryRestore, 0);
  }

  private resolveScrollContainer(): HTMLElement | null {
    const root = this.staffScrollRoot?.nativeElement;
    if (!root || typeof window === 'undefined') {
      return null;
    }

    const rootStyles = window.getComputedStyle(root);
    const rootOverflowY = rootStyles.overflowY;
    if (rootOverflowY === 'auto' || rootOverflowY === 'scroll' || rootOverflowY === 'overlay') {
      return root;
    }

    let current: HTMLElement | null = root.parentElement;
    while (current) {
      const styles = window.getComputedStyle(current);
      const overflowY = styles.overflowY;
      const isScrollable = overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay';
      if (isScrollable) {
        return current;
      }
      current = current.parentElement;
    }

    return null;
  }

  rememberStaffListStateBeforeNavigate(): void {
    this.saveCurrentState();
  }

  toggleFiltersVisibility(): void {
    this.showMobileFilters = !this.showMobileFilters;
    this.saveCurrentState();
  }

  openStaffMobileTopFilterSheet(): void {
    this.showStaffMobileTopFilterSheet = true;
  }

  getTopSearchActiveFiltersCount(): number {
    let count = 0;
    if (this.searchParams.name?.trim()) count++;
    if (this.searchParams.location?.trim()) count++;
    if (this.searchParams.qualifications?.trim()) count++;
    if (this.searchParams.status?.trim()) count++;
    if (this.searchParams.clientAssignment?.trim()) count++;
    if (this.searchParams.customFilter?.trim()) count++;
    return count;
  }

  clearTopSearchFilters(): void {
    this.searchParams = {
      ...this.searchParams,
      name: '',
      location: '',
      qualifications: '',
      status: '',
      clientAssignment: '',
      customFilter: '',
    };

    this.selectedQualification = [];
    this.selectedStatus = null;
    this.referenceLocation = null;
    this.lastGeocodedLocationQuery = null;
    this.first = 0;
    this.currentPage = 1;

    this.onSearch();

    this.saveCurrentState();
  }

  onStaffMobileTopFiltersCleared(): void {
    this.clearTopSearchFilters();
  }

  private loadFilterOptions() {
    this.merchandiserService.getFilterOptions().subscribe({
      next: (response) => {
        // Store job types for dropdown
        this.jobTypes = response.jobTypes || [];

        // Store statuses for dropdown
        this.statuses = response.statuses || [];

        // Initialize selected qualification from searchParams if it exists
        if (this.searchParams.qualifications) {
          this.selectedQualification = this.searchParams.qualifications.split(',').map((s) => s.trim()).filter(Boolean);
        }

        // Initialize selected status from searchParams if it exists
        if (this.searchParams.status) {
          this.selectedStatus = this.searchParams.status;
        }

        // Populate qualifications checkboxes
        this.filters.qualifications = {};
        response.jobTypes.forEach((jt) => {
          this.filters.qualifications[jt.name] = false;
        });

        // Populate status checkboxes
        this.filters.status = {};
        response.statuses.forEach((s) => {
          this.filters.status[s.name] = false;
        });

        this.debug('filter options loaded', {
          qualifications: Object.keys(this.filters.qualifications),
          statuses: Object.keys(this.filters.status),
          jobTypes: this.jobTypes.length,
          statusesCount: this.statuses.length,
        });
      },
      error: (error) => {
        console.error('❌ Error loading filter options:', error);
        // Don't show error to user, just continue without filters
      },
    });
  }

  setViewMode(mode: 'table' | 'map' | 'grid') {
    if (this.viewMode === mode) {
      return;
    }

    this.viewMode = mode;
    this.debug('viewMode changed', { mode });
    this.applyClientSideFilters();
    this.saveCurrentState();
  }

  private initializeColumns() {
    this.cols = [
      { field: 'lastName', header: 'Nachname' },
      { field: 'email', header: 'E-Mail' },
      { field: 'phone', header: 'Telefon' },
      { field: 'address', header: 'Adresse' },
      { field: 'city', header: 'Stadt' },
      { field: 'distance', header: 'Entfernung' },
      { field: 'qualifications', header: 'Qualifikation' },
      { field: 'status', header: 'Status' },
    ];
    // Exclude status column from initial selection
    this.selectedColumns = this.cols.filter((col) => col.field !== 'status');
  }

  private buildApiSearchParams(): MerchandiserSearchParams {
    // Always fetch the full dataset; all search filters are applied client-side so
    // list, map, and gallery stay in sync and join-pagination cannot truncate results.
    return {
      name: '',
      location: '',
      qualifications: '',
      status: '',
      clientAssignment: '',
      customFilter: '',
      page: 1,
      limit: 0,
    };
  }

  private parseLocationQuery(query: string): { place: string; radiusKm: number } {
    const trimmed = query.trim();
    if (!trimmed) {
      return { place: '', radiusKm: 50 };
    }

    // Just a number with optional "km" (e.g. "50", "50km") → radius only, no city
    const radiusOnly = trimmed.match(/^(\d+)\s*(km)?$/i);
    if (radiusOnly) {
      return { place: '', radiusKm: parseInt(radiusOnly[1], 10) };
    }

    const suffixMatch = trimmed.match(/^(.+?)\s+(\d+)\s*(km)?$/i);
    if (suffixMatch) {
      return { place: suffixMatch[1].trim(), radiusKm: parseInt(suffixMatch[2], 10) };
    }

    const prefixMatch = trimmed.match(/^(\d+)\s*(km)?\s+(.+)$/i);
    if (prefixMatch) {
      return { place: prefixMatch[3].trim(), radiusKm: parseInt(prefixMatch[1], 10) };
    }

    return { place: trimmed, radiusKm: 50 };
  }

  private loadStaffData(options: { showLoader?: boolean } = {}) {
    this.fetchStaffData(options);
  }

  private fetchStaffData(options: { showLoader?: boolean } = {}) {
    const { showLoader = true } = options;

    if (showLoader) {
      this.loading = true;
    }
    this.error = null;

    const loadParams = this.buildApiSearchParams();
    this.debug('fetchStaffData start', { params: loadParams, viewMode: this.viewMode, showLoader });

    this.merchandiserService.searchMerchandisers(loadParams).subscribe({
      next: (response) => {
        const data = response.data || [];
        this.allStaffData = this.mapMerchandisersToStaff(data);
        this.applyClientSideFilters();

        this.staffStateService.saveState({
          allStaffData: this.allStaffData,
          totalItems: this.totalItems,
          searchParams: this.searchParams,
          viewMode: this.viewMode,
        });

        this.loading = false;
        this.initialLoadDone = true;
      },
      error: (error) => {
        console.error('❌ Error loading merchandisers:', error);
        this.error = 'Fehler beim Laden der Merchandiser-Daten';
        this.loading = false;
        this.staffData = [];
        this.allStaffData = [];
        this.totalItems = 0;
        this.hasNextPage = false;
      },
    });
  }

  // Client-side filtering function
  private filterStaffData(): Staff[] {
    let filtered = [...this.allStaffData];

    // Filter by name
    if (this.searchParams.name?.trim()) {
      const nameTerm = this.searchParams.name.toLowerCase().trim();
      filtered = filtered.filter(
        (staff) =>
          staff.firstName?.toLowerCase().includes(nameTerm) ||
          staff.lastName?.toLowerCase().includes(nameTerm) ||
          `${staff.firstName} ${staff.lastName}`.toLowerCase().includes(nameTerm) ||
          staff.email?.toLowerCase().includes(nameTerm),
      );
    }

    // Location/radius search
    if (this.searchParams.location?.trim()) {
      const locationTerm = this.searchParams.location.toLowerCase().trim();
      const hasRadius = /\d+\s*km/i.test(locationTerm) || /^\d+$/.test(locationTerm);

      if (hasRadius) {
        // Radius mode: filter by distance from Frankfurt (or geocoded location)
        const ref = this.referenceLocation || this.defaultReferenceLocation;
        // Pure number input (e.g. "100") → no city name to match
        const placeTerm = /^\d+$/.test(locationTerm) ? '' : locationTerm.replace(/^\d+\s*(km)?\s+/i, '').replace(/\s+\d+\s*(km)?$/i, '').trim();

        filtered = filtered
          .map((staff) => {
            const hasLocation = !!staff.location;
            const distance = hasLocation
              ? this.calculateHaversineDistance(ref, staff.location!)
              : '-- km';
            return { ...staff, distance };
          })
          .filter((staff) => {
            const distKm = this.parseDistanceToKm(staff.distance || '-- km');
            if (distKm <= this.searchRadiusKm) return true;
            if (placeTerm && staff.city?.toLowerCase().includes(placeTerm)) return true;
            return false;
          })
          .sort((a, b) => {
            const distanceA = this.parseDistanceToKm(a.distance || '999999 km');
            const distanceB = this.parseDistanceToKm(b.distance || '999999 km');
            return distanceA - distanceB;
          });
      } else {
        // City name mode: text match only on city name
        const placeTerm = locationTerm;
        filtered = filtered.filter(
          (staff) => staff.city?.toLowerCase().includes(placeTerm),
        );
      }
    }

    // Filter by qualifications (comma-separated multi-select)
    if (this.searchParams.qualifications?.trim()) {
      const qualTerms = this.searchParams.qualifications.split(',').map((q) => q.trim().toLowerCase()).filter(Boolean);
      if (qualTerms.length > 0) {
        filtered = filtered.filter((staff) =>
          qualTerms.some((term) => staff.qualifications?.some((q: string) => q.toLowerCase().includes(term))),
        );
      }
    }

    // Filter by status
    if (this.searchParams.status?.trim()) {
      filtered = filtered.filter((staff) => staff.status?.toLowerCase() === this.searchParams.status.toLowerCase());
    }

    // Filter by client assignment
    if (this.searchParams.clientAssignment?.trim()) {
      const clientTerm = this.searchParams.clientAssignment.toLowerCase().trim();
      filtered = filtered.filter((staff) => staff.clientCompanies?.some((cc: any) => cc.name?.toLowerCase().includes(clientTerm)));
    }

    // Filter by custom filter (search in multiple fields)
    if (this.searchParams.customFilter?.trim()) {
      const customTerm = this.searchParams.customFilter.toLowerCase().trim();
      filtered = filtered.filter(
        (staff) =>
          staff.firstName?.toLowerCase().includes(customTerm) ||
          staff.lastName?.toLowerCase().includes(customTerm) ||
          staff.email?.toLowerCase().includes(customTerm) ||
          staff.phone?.toLowerCase().includes(customTerm) ||
          staff.address?.toLowerCase().includes(customTerm) ||
          staff.city?.toLowerCase().includes(customTerm) ||
          staff.country?.toLowerCase().includes(customTerm) ||
          staff.qualifications?.some((q: string) => q.toLowerCase().includes(customTerm)) ||
          staff.status?.toLowerCase().includes(customTerm),
      );
    }

    return filtered;
  }

  onSearch(options: { reloadData?: boolean } = {}) {
    const { reloadData = false } = options;
    this.currentPage = 1;
    this.first = 0;

    const locationQuery = this.searchParams.location?.trim() || '';

    if (locationQuery) {
      const { place, radiusKm } = this.parseLocationQuery(locationQuery);
      this.searchRadiusKm = radiusKm;

      if (this.lastGeocodedLocationQuery !== locationQuery) {
        // Skip geocoding when there's no city name (e.g. "50km" → radius only)
        if (!place) {
          this.referenceLocation = null;
          this.lastGeocodedLocationQuery = locationQuery;
          if (reloadData || !this.allStaffData.length) {
            this.fetchStaffData({ showLoader: true });
          } else {
            this.applyClientSideFilters();
            this.loading = false;
          }
        } else {
          this.loading = true;
          this.geocodeLocation(place).subscribe({
            next: (coords) => {
              if (coords) {
                this.referenceLocation = coords;
                this.lastGeocodedLocationQuery = locationQuery;
              } else {
                // Geocoding failed — fall back to Frankfurt for radius, text for city name
                this.referenceLocation = null;
                this.lastGeocodedLocationQuery = locationQuery;
              }
              if (reloadData || !this.allStaffData.length) {
                this.fetchStaffData({ showLoader: true });
              } else {
                this.applyClientSideFilters();
                this.loading = false;
              }
            },
            error: (error) => {
              console.error('Error geocoding location:', error);
              this.referenceLocation = null;
              this.lastGeocodedLocationQuery = locationQuery;
              if (reloadData || !this.allStaffData.length) {
                this.fetchStaffData({ showLoader: true });
              } else {
                this.applyClientSideFilters();
                this.loading = false;
              }
            },
          });
        }
        return;
      }

      if (reloadData || !this.allStaffData.length) {
        this.fetchStaffData({ showLoader: true });
      } else {
        this.applyClientSideFilters();
      }
      return;
    }

    this.referenceLocation = null;
    this.lastGeocodedLocationQuery = null;

    if (reloadData || !this.allStaffData.length) {
      this.fetchStaffData({ showLoader: true });
    } else {
      this.applyClientSideFilters();
    }
  }

  private applyClientSideFilters() {
    if (!this.allStaffData || this.allStaffData.length === 0) {
      this.staffData = [];
      this.totalItems = 0;
      this.hasNextPage = false;
      return;
    }

    const filtered = this.filterStaffData();
    this.totalItems = filtered.length;
    this.hasNextPage = false;
    this.staffData = filtered;

    this.debug('applyClientSideFilters', {
      viewMode: this.viewMode,
      allStaffDataCount: this.allStaffData.length,
      filteredCount: filtered.length,
      pageSize: this.pageSize,
      staffDataCount: this.staffData.length,
    });
  }

  private debug(label: string, payload?: any) {
    if (typeof window === 'undefined') {
      return;
    }
    const storeKey = '__staffListDebug';
    const entry = {
      label,
      payload,
      timestamp: new Date().toISOString(),
    };
    (window as any)[storeKey] = (window as any)[storeKey] || [];
    (window as any)[storeKey].push(entry);
  }

  onPageChange(event: { first: number; rows: number }): void {
    this.first = event.first;
    this.pageSize = event.rows;
    this.currentPage = Math.floor(event.first / event.rows) + 1;
    this.debug('parent onPageChange', {
      event,
      viewMode: this.viewMode,
      first: this.first,
      rows: this.pageSize,
      currentPage: this.currentPage,
    });

    this.applyClientSideFilters();
    this.saveCurrentState();
  }

  onColumnFiltersChange(filters: { [key: string]: string[] }): void {
    this.staffColumnFilters = { ...filters };
    this.saveCurrentState();
  }

  onGridFiltersChange(filters: typeof this.gridFilters): void {
    this.gridFilters = {
      ...this.gridFilters,
      ...filters,
      qualifications: { ...this.gridFilters.qualifications, ...filters.qualifications },
      status: { ...this.gridFilters.status, ...filters.status },
    };
    this.saveCurrentState();
  }

  onMapFiltersChange(filters: typeof this.mapFilters): void {
    this.mapFilters = {
      qualifications: { ...filters.qualifications },
      status: { ...filters.status },
    };
    this.saveCurrentState();
  }

  onSearchInputChange(field: keyof Pick<MerchandiserSearchParams, 'name' | 'location' | 'clientAssignment' | 'customFilter'>, event: Event) {
    const target = event.target as HTMLInputElement;
    this.searchParams[field] = target.value;

    // Reset pagination when filter changes
    this.first = 0;
    this.currentPage = 1;

    // For location search, we need geocoding for new locations
    if (field === 'location') {
      const locationValue = this.searchParams.location?.trim() || '';

      if (!locationValue) {
        this.referenceLocation = null;
        this.lastGeocodedLocationQuery = null;
        this.onSearch();
      } else {
        clearTimeout(this.searchTimeout);
        this.searchTimeout = setTimeout(() => {
          this.onSearch();
        }, 500);
      }
    } else {
      clearTimeout(this.searchTimeout);
      this.searchTimeout = setTimeout(() => {
        this.onSearch();
      }, 300);
    }
  }

  onQualificationChange(event: any): void {
    const selected: string[] = event.value || [];
    this.selectedQualification = selected;
    this.searchParams.qualifications = selected.join(', ');

    // Reset pagination
    this.first = 0;
    this.currentPage = 1;

    this.onSearch();
  }

  onQualificationModelChange(value: string[] | null): void {
    if (!value || value.length === 0) {
      this.selectedQualification = [];
      this.searchParams.qualifications = '';
      this.onSearch();
    }
  }

  onStatusModelChange(value: string | null): void {
    // This handles the case when the clear button is clicked
    // ngModelChange fires when the model value changes, including when cleared
    if (value === null || value === undefined || value === '') {
      this.selectedStatus = null;
      this.searchParams.status = '';

      this.onSearch();
    }
  }

  onStatusChange(event: any): void {
    const selectedStatus = event.value;
    this.selectedStatus = selectedStatus;
    this.searchParams.status = selectedStatus || '';

    // Reset pagination
    this.first = 0;
    this.currentPage = 1;

    this.onSearch();
  }

  clearQualification(): void {
    this.selectedQualification = [];
    this.searchParams.qualifications = '';
    this.onSearch();
  }

  clearNameSearch(): void {
    this.searchParams.name = '';
    this.onSearch();
  }

  clearLocationSearch(): void {
    this.searchParams.location = '';
    this.referenceLocation = null;
    this.lastGeocodedLocationQuery = null;
    this.onSearch();
  }

  clearClientAssignment(): void {
    this.searchParams.clientAssignment = '';
    this.onSearch();
  }

  clearCustomFilter(): void {
    this.searchParams.customFilter = '';
    this.onSearch();
  }

  clearStatus(): void {
    this.selectedStatus = null;
    this.searchParams.status = '';
    this.onSearch();
  }

  /**
   * Handle favorite toggle with backend call (similar to clients component)
   */
  onFavoriteChanged(event: { newStatus: boolean; staff: any }): void {
    const { newStatus, staff } = event;
    this.debug('toggle favorite start', { id: staff.id, newStatus });

    // Optimistically update the UI
    const previousStatus = staff.isFavorite;
    staff.isFavorite = newStatus;

    // Call backend to toggle favorite status
    this.merchandiserService
      .toggleFavoriteStatus(parseInt(staff.id))
      .pipe(
        catchError((error) => {
          console.error('❌ Error toggling favorite status:', error);

          // Revert the optimistic update on error
          staff.isFavorite = previousStatus;

          this._toast.error('Fehler beim Aktualisieren der Favoriten', {
            position: 'bottom-right',
            duration: 4000,
          });

          return of(null);
        }),
      )
      .subscribe({
        next: (result) => {
          if (result) {
            this.debug('toggle favorite success', result);

            // Update the status based on server response (in case of any discrepancy)
            staff.isFavorite = result.isFavorite;

            if (result.isFavorite) {
              this._toast.success('Personal zu Favoriten hinzugefügt', {
                position: 'bottom-right',
                duration: 2000,
              });
            } else {
              this._toast.info('Personal aus Favoriten entfernt', {
                position: 'bottom-right',
                duration: 2000,
              });
            }
          }
        },
      });
  }

  private hasSearchCriteria(): boolean {
    const { page, limit, ...searchFields } = this.searchParams;
    return Object.values(searchFields).some((value) => value && value.toString().trim().length > 0);
  }

  private mapMerchandisersToStaff(merchandisers: any[]): Staff[] {
    return merchandisers.map((merchandiser) => ({
      id: merchandiser.id.toString(),
      firstName: merchandiser.user?.firstName || '',
      lastName: merchandiser.user?.lastName || '',
      email: merchandiser.user?.email || '', // Now available in the API response
      phone: merchandiser.user?.phone || '',
      address: merchandiser.street || '',
      postalCode: merchandiser.zipCode || '',
      city: merchandiser.city?.name || merchandiser.cityName || '', // City from relation or profile fallback
      country: merchandiser.city?.country?.name?.de || merchandiser.nationality || '',
      distance: this.calculateDistance(merchandiser.city?.coordinates), // Calculate from coordinates
      qualifications: merchandiser.jobTypes?.map((job) => job.name) || [],
      portrait: merchandiser.portrait,
      dateOfBirth: this.formatDate(merchandiser.birthday),
      status: merchandiser.status?.name || '', // Default status if not available
      isFavorite: merchandiser.isFavorite || false, // Add favorite status from API
      location: this.extractLocation(merchandiser.city?.coordinates), // Extract from coordinates array
      clientCompanies: merchandiser.clientCompanies || [], // Map client companies
    }));
  }

  private extractLocation(coordinates: number[]): { lat: number; lng: number } | undefined {
    if (coordinates && coordinates.length >= 2) {
      const lat = coordinates[0];
      const lng = coordinates[1];
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) {
        return undefined;
      }
      return { lat, lng };
    }
    return undefined;
  }

  /**
   * Geocode location name to coordinates using Mapbox Geocoding API.
   */
  private geocodeLocation(locationName: string): Observable<{ lat: number; lng: number } | null> {
    const encodedQuery = encodeURIComponent(locationName);
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedQuery}.json?access_token=${environment.mapboxToken}&limit=1&country=DE&language=de`;
    const context = new HttpContext().set(SKIP_API_PREFIX, true).set(SKIP_AUTH_CHECK, true);

    return this.http.get<{ features?: { center: [number, number] }[] }>(url, { context }).pipe(
      map((data) => {
        if (data?.features?.length) {
          const [lng, lat] = data.features[0].center;
          return { lat, lng };
        }
        return null;
      }),
      catchError((error) => {
        console.error('Geocoding error:', error);
        return of(null);
      }),
    );
  }

  /**
   * Calculate haversine distance between two coordinates (air distance)
   * Returns distance in kilometers as a formatted string
   */
  private calculateHaversineDistance(point1: { lat: number; lng: number }, point2?: { lat: number; lng: number }): string {
    if (!point2) {
      return '-- km';
    }

    const R = 6371; // Earth's radius in kilometers
    const dLat = this.degreesToRadians(point2.lat - point1.lat);
    const dLng = this.degreesToRadians(point2.lng - point1.lng);

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(this.degreesToRadians(point1.lat)) * Math.cos(this.degreesToRadians(point2.lat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    // Always format distance in kilometers
    if (distance >= 10) {
      return `${Math.round(distance)} km`;
    }

    if (distance >= 1) {
      return `${distance.toFixed(1)} km`;
    }

    // Distances under 1 km are shown with two decimal places in km
    return `${distance.toFixed(2)} km`;
  }

  /**
   * Convert degrees to radians
   */
  private degreesToRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Parse distance string to numeric value in kilometers for sorting
   */
  private parseDistanceToKm(distanceString: string): number {
    if (distanceString === '-- km' || !distanceString) {
      return 999999; // Large number for sorting
    }

    // Extract number from strings like "123 km" or "123 m"
    const match = distanceString.match(/([\d.]+)\s*(km|m)/);
    if (match) {
      const value = parseFloat(match[1]);
      const unit = match[2];
      return unit === 'km' ? value : value / 1000; // Convert meters to km
    }

    return 999999;
  }

  /**
   * Calculate distance using reference location if available
   */
  private calculateDistance(coordinates?: number[]): string {
    if (!coordinates || coordinates.length < 2) {
      return '-- km';
    }

    const staffLocation = this.extractLocation(coordinates);
    const ref = this.referenceLocation || this.defaultReferenceLocation;
    if (ref && staffLocation) {
      return this.calculateHaversineDistance(ref, staffLocation);
    }

    return '-- km';
  }

  private formatDate(dateString: string): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('de-DE');
  }

  /**
   * Check if there are any active filters
   */
  hasActiveFilters(): boolean {
    // Check search params
    const hasSearchFilters =
      (this.searchParams.name && this.searchParams.name.trim().length > 0) ||
      (this.searchParams.location && this.searchParams.location.trim().length > 0) ||
      (this.searchParams.qualifications && this.searchParams.qualifications.trim().length > 0) ||
      (this.searchParams.status && this.searchParams.status.trim().length > 0) ||
      (this.searchParams.clientAssignment && this.searchParams.clientAssignment.trim().length > 0) ||
      (this.searchParams.customFilter && this.searchParams.customFilter.trim().length > 0);

    // Check column filters in table component
    const hasColumnFilters = this.staffTableComponent?.hasStaffColumnFilters() || false;

    // Check grid filters
    let hasGridFilters = false;
    if (this.viewMode === 'grid') {
      hasGridFilters =
        !!this.gridFilters.firstName ||
        !!this.gridFilters.lastName ||
        !!this.gridFilters.address ||
        !!this.gridFilters.country ||
        !!this.gridFilters.distance ||
        Object.values(this.gridFilters.qualifications).some((v) => v) ||
        Object.values(this.gridFilters.status).some((v) => v);
    }

    // Check map filters
    let hasMapFilters = false;
    if (this.viewMode === 'map') {
      hasMapFilters = Object.values(this.mapFilters.qualifications).some((v) => v) || Object.values(this.mapFilters.status).some((v) => v);
    }

    return hasSearchFilters || hasColumnFilters || hasGridFilters || hasMapFilters;
  }

  /**
   * Clear all filters
   */
  clearFilters(): void {
    // Clear search params
    this.searchParams = {
      name: '',
      location: '',
      qualifications: '',
      status: '',
      clientAssignment: '',
      customFilter: '',
      page: 1,
      limit: this.pageSize,
    };

    // Reset pagination
    this.first = 0;
    this.currentPage = 1;

    // Clear dropdown selections
    this.selectedQualification = [];
    this.selectedStatus = null;

    // Clear reference location
    this.referenceLocation = null;
    this.lastGeocodedLocationQuery = null;

    // Clear column filters in table component
    if (this.staffTableComponent) {
      this.staffTableComponent.clearColumnFilters();
    }

    // Clear grid filters
    this.gridFilters = {
      firstName: '',
      lastName: '',
      address: '',
      country: '',
      distance: '',
      qualifications: {},
      status: {},
    };

    // Clear map filters
    this.mapFilters = {
      qualifications: {},
      status: {},
    };

    // Reload data from server to ensure fresh list
    this.onSearch({ reloadData: true });

    // Save the cleared state to cache so it persists on navigation
    this.saveCurrentState();
  }

  /**
   * Cycle through reset button variants (1-8) for UI selection
   */
  nextResetButtonVariant(): void {
    this.resetButtonVariant = this.resetButtonVariant >= 8 ? 1 : this.resetButtonVariant + 1;
  }
}
