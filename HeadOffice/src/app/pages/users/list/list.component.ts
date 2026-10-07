import { Component, OnInit, ViewChild, ElementRef, HostListener, OnDestroy, ChangeDetectorRef, AfterViewInit, AfterViewChecked, Renderer2 } from '@angular/core';
import { Table } from 'primeng/table';
import { MultiSelect } from 'primeng/multiselect';
import { ActivatedRoute, Router, ParamMap, NavigationStart, NavigationEnd } from '@angular/router';
import { Location } from '@angular/common';
import { Subject, takeUntil, debounceTime, distinctUntilChanged, BehaviorSubject, combineLatest, take, filter, skip } from 'rxjs';
import { UsersService, User, UserQueryParams } from '../services/users.service';
import { UsersListStateService, StoredColumn, UsersListViewState } from './users-list-state.service';
import { FilterOption } from '@app/shared/components/mobile-filter-bottom-sheet/mobile-filter-bottom-sheet.component';

interface Column {
  field: string;
  header: string;
}

export enum UserListType {
  ALL = 'all',
  AKZENTE = 'akzente',
  CLIENT = 'client',
}

const COLUMN_FILTER_EMPTY_LABEL = '--';

@Component({
  selector: 'app-list',
  templateUrl: './list.component.html',
  styleUrls: ['./list.component.scss'],
  standalone: false,
})
export class ListComponent implements OnInit, OnDestroy, AfterViewInit, AfterViewChecked {
  private destroy$ = new Subject<void>();
  private isLoading$ = new BehaviorSubject<boolean>(false);

  cols!: Column[];
  selectedColumns!: Column[];
  dateRange: Date[] = [];
  dateRange2 = { start: null, end: null };

  @ViewChild('datePickerButton') datePickerButton: ElementRef;
  @ViewChild('datePickerContent') datePickerContent: ElementRef;
  @ViewChild('usersColumnFilterPopover') usersColumnFilterPopover: any;
  @ViewChild('usersTable') usersTable: Table;
  @ViewChild('usersPaginator') usersPaginator: any;
  @ViewChild('usersColumnsMultiSelect') usersColumnsMultiSelect?: MultiSelect;
  @ViewChild('usersFilterMultiSelect') usersFilterMultiSelect?: MultiSelect;
  @ViewChild('usersStickyToolbar') usersStickyToolbar?: ElementRef<HTMLElement>;
  @ViewChild('usersScrollContainer') usersScrollContainer?: ElementRef<HTMLElement>;
  isDatePickerOpen = false;
  usersStickyOffset = 0;

  myDate: Date | null = null;

  // User data properties
  users: User[] = [];
  loading = false;
  totalRecords = 0;
  currentPage = 1;
  pageSize = 10;
  hasNextPage = false;
  private initialLoadDone = false;
  private preFilterPage = 1;
  private wasFiltering = false;

  // Cached filtered users to prevent array reference change on every change detection
  filteredUsersCache: User[] = [];
  paginatedUsersCache: User[] = [];
  private lastFilterState: string = '';

  // Computed first index for pagination - stored as property for stability
  paginationFirst = 0;

  // Filtering and search - using BehaviorSubjects for better control
  private clientSearchSubject = new BehaviorSubject<string>('');
  private nameSearchSubject = new BehaviorSubject<string>('');
  private categorySearchSubject = new BehaviorSubject<string>('');

  // Public properties for template binding
  get clientSearch(): string {
    return this.clientSearchSubject.value;
  }
  get nameSearch(): string {
    return this.nameSearchSubject.value;
  }
  get categorySearch(): string {
    return this.categorySearchSubject.value;
  }

  get showUsersPaginator(): boolean {
    if (!this.filteredUsersCache || this.filteredUsersCache.length === 0) {
      return false;
    }
    const effectiveTotal = this.usersPaginatorTotalRecords;
    const effectiveHasNextPage = this.shouldUseLocalFilteredPaginationTotal() ? false : this.hasNextPage;
    return effectiveTotal > this.pageSize || this.currentPage > 1 || effectiveHasNextPage;
  }

  get usersPaginatorTotalRecords(): number {
    return this.shouldUseLocalFilteredPaginationTotal() ? this.filteredUsersCache.length : this.totalRecords;
  }

  private shouldUseLocalFilteredPaginationTotal(): boolean {
    return !!this.clientSearchSubject.value.trim() || !!this.nameSearchSubject.value.trim() || !!this.categorySearchSubject.value.trim() || this.hasUsersColumnFilters();
  }

  // Sorting properties
  sortField: string = '';
  sortOrder: number = 1; // 1 for ascending, -1 for descending

  // Column visibility
  usersVisibleColumns: { [key: string]: boolean } = {};
  usersOrderedColumns: Column[] = [];

  // Column filter properties
  usersColumnFilters: { [key: string]: string[] } = {
    firstName: [],
    lastName: [],
    email: [],
    type: [],
    customer: [],
  };

  // Track current filter field for popovers
  currentUsersFilterField: string = '';
  currentUsersFilterOptions: { label: string; value: string }[] = [];
  showColumnFilterModal = false;
  showUsersMobileFilter = false;
  usersMobileColumnOptions: { [field: string]: FilterOption[] } = {};
  usersCanFilterMap: { [field: string]: boolean } = {};
  showFilters = true;
  showMobileFilters = true;
  private activeUsersColumnFilterPopover: any = null;
  private columnFilterPopoverTimeout: any = null;
  private activeSettingsPopover: any = null;

  // Flag to prevent subscription from triggering during initial filter restoration
  private isRestoringFilters = false;

  private scrollListener: (() => void) | null = null;
  private paginatorClickListener: (() => void) | null = null;
  private paginatorHostElement: HTMLElement | null = null;
  private scrollPosition = 0;
  private routerSubscription: any;
  private paginationRestored = false; // Flag to track if pagination has been restored
  private previousUrl: string = ''; // Track previous URL for navigation detection
  private dataPrefetched = false; // Flag to track if data was prefetched

  private normalizeColumnFilterValue(value: string | null | undefined): string {
    const normalized = (value ?? '').toString().trim();
    return normalized === '-' ? '' : normalized;
  }

  private getColumnFilterOptionLabel(value: string): string {
    return value ? value : COLUMN_FILTER_EMPTY_LABEL;
  }

  private sortColumnFilterValues(values: string[]): string[] {
    return [...values].sort((a, b) => {
      const aEmpty = a === '';
      const bEmpty = b === '';
      if (aEmpty !== bEmpty) {
        return aEmpty ? 1 : -1;
      }
      return a.localeCompare(b, 'de', { sensitivity: 'base', numeric: true });
    });
  }

  private appendSelectedFilterValues(values: Set<string>, selectedValues?: string[]): void {
    (selectedValues || []).forEach((selected) => values.add(selected));
  }

  constructor(
    private usersService: UsersService,
    private route: ActivatedRoute,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private usersListStateService: UsersListStateService,
    private renderer: Renderer2,
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

          // Prefetch users data when navigating TO users list page FROM edit/add page
          // This ensures data is ready before the component loads
          const nextUrl = event.url;
          if ((nextUrl.includes('/users/list') || nextUrl === '/users') && (this.previousUrl.includes('/users/edit') || this.previousUrl.includes('/users/add'))) {
            // Prefetch data before component loads
            this.dataPrefetched = true;
            this.prefetchUsersData();
          } else {
            this.dataPrefetched = false;
          }

          // Save state when navigating away from users list page (to any other page)
          // Check if current URL is users list and new URL is different
          const currentUrl = this.router.url;
          if (currentUrl.includes('/users/list') || currentUrl === '/users') {
            if (!nextUrl.includes('/users/list') && nextUrl !== '/users') {
              // Save state immediately before navigation destroys the view
              this.persistViewState();
            }
          }
        } else if (event instanceof NavigationEnd) {
          // No-op: returning flow is handled in ngOnInit with cached restore first,
          // then background refresh. Avoid a second forced refresh that can reset scroll.
        }
      });
  }

  ngOnInit(): void {
    // Keep search subscriptions dormant while restoring state to avoid duplicate loads
    this.isRestoringFilters = true;

    this.loading = true;
    this.initializeColumns();
    this.restoreViewStateFromStore();
    this.setupSearchSubscriptions();

    // Set pagination first index immediately after restoring state
    // Ensure paginationFirst is always calculated from currentPage and pageSize for consistency
    this.paginationFirst = (this.currentPage - 1) * this.pageSize;
    this.paginationRestored = false; // Reset flag when component initializes

    // Check if data was prefetched (when returning from edit/add page)
    // When returning from edit/add, always load fresh data to show updates
    const cachedData = this.usersListStateService.getUsersDataSnapshot();

    if (this.dataPrefetched && cachedData && this.usersListStateService.isCacheValid()) {
      // Returning from edit/add: restore immediately from cache for stable scroll/filter UX
      this.users = cachedData.data || [];
      this.totalRecords = cachedData.totalCount || cachedData.data.length;
      this.hasNextPage = !!cachedData.hasNextPage;
      this.loading = false;
      this.initialLoadDone = true;

      this.updateFilteredUsersCache();
      this.paginationFirst = (this.currentPage - 1) * this.pageSize;

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (this.usersTable) {
            this.usersTable.first = this.paginationFirst;
            this.cdr.markForCheck();
          }
          this.restoreScrollPosition();
        });
      });

      // Refresh in background (no loader)
      this.loadUsers();
    } else if (this.dataPrefetched) {
      // If cache isn't available, fallback to fresh load.
      this.loadUsers();
    } else if (cachedData && this.usersListStateService.isCacheValid()) {
      // Normal navigation - show cached data immediately for better UX
      this.users = cachedData.data || [];
      this.totalRecords = cachedData.totalCount || cachedData.data.length;
      this.hasNextPage = !!cachedData.hasNextPage;
      this.loading = false;
      this.initialLoadDone = true;

      // Update filtered users cache with cached data
      this.updateFilteredUsersCache();

      // Ensure paginationFirst is recalculated after data is loaded
      this.paginationFirst = (this.currentPage - 1) * this.pageSize;

      // Use requestAnimationFrame to ensure table is ready
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (this.usersTable) {
            this.usersTable.first = this.paginationFirst;
            this.cdr.markForCheck();
          }
          this.restoreScrollPosition();
        });
      });

      // Load fresh data in background to update store
      this.loadUsers();
    } else {
      // No cached data, load fresh from API
      this.loadUsers();
    }

    // Allow future search changes to trigger loading
    this.isRestoringFilters = false;

    // Subscribe to data updates from state service to catch prefetch completions
    this.subscribeToDataUpdates();
  }

  /**
   * Subscribe to data updates from state service
   * This catches prefetch completions that happen after component initialization
   */
  private subscribeToDataUpdates(): void {
    this.usersListStateService.usersData$
      .pipe(
        takeUntil(this.destroy$),
        filter((data) => data !== null && this.dataPrefetched), // Only update if we're expecting prefetched data
      )
      .subscribe((data) => {
        if (data && this.dataPrefetched && this.loading) {
          // Fresh data arrived from prefetch, update the component
          this.users = data.data || [];
          this.totalRecords = data.totalCount || data.data.length;
          this.hasNextPage = !!data.hasNextPage;
          this.loading = false;
          this.initialLoadDone = true;
          this.updateFilteredUsersCache();
          this.paginationFirst = (this.currentPage - 1) * this.pageSize;

          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              if (this.usersTable) {
                this.usersTable.first = this.paginationFirst;
                this.cdr.markForCheck();
              }
              this.restoreScrollPosition();
            });
          });
        }
      });
  }

  /**
   * Check if data is fresh (recently updated)
   * Data is considered fresh if it was updated in the last 5 seconds
   */
  private isDataFresh(data: any): boolean {
    if (!data || !data.timestamp) {
      return false;
    }
    const age = Date.now() - data.timestamp;
    return age < 5000; // 5 seconds
  }

  ngAfterViewInit() {
    this.attachUsersScrollListener();
    this.attachUsersPaginatorListener();

    // Ensure pagination is properly restored after view initialization
    // Use requestAnimationFrame and multiple attempts to ensure PrimeNG table is fully initialized
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        // Recalculate paginationFirst to ensure it's correct
        this.paginationFirst = (this.currentPage - 1) * this.pageSize;
        if (this.usersTable && this.paginationFirst >= 0) {
          // Force update the table's first property
          this.usersTable.first = this.paginationFirst;
          this.cdr.markForCheck();
        }
      });
    });

    // Also try again after a delay to catch any late initialization
    setTimeout(() => {
      if (this.usersTable) {
        const expectedFirst = (this.currentPage - 1) * this.pageSize;
        if (this.usersTable.first !== expectedFirst) {
          this.paginationFirst = expectedFirst;
          this.usersTable.first = expectedFirst;
          this.cdr.markForCheck();
        }
      }
    }, 300);

    // Final attempt after even longer delay
    setTimeout(() => {
      if (this.usersTable) {
        const expectedFirst = (this.currentPage - 1) * this.pageSize;
        if (this.usersTable.first !== expectedFirst) {
          this.paginationFirst = expectedFirst;
          this.usersTable.first = expectedFirst;
          this.cdr.markForCheck();
          this.paginationRestored = true;
        }
      }
    }, 500);

    this.updateUsersStickyOffset();
    setTimeout(() => this.updateUsersStickyOffset(), 0);
    setTimeout(() => this.updateUsersStickyOffset(), 200);
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.updateUsersStickyOffset();
  }

  ngAfterViewChecked(): void {
    this.attachUsersPaginatorListener();

    // Check and fix pagination if it gets reset (only if not already restored)
    // Limit checks to avoid performance issues - only check a few times
    if (this.usersTable && !this.paginationRestored) {
      const expectedFirst = (this.currentPage - 1) * this.pageSize;
      if (this.usersTable.first !== expectedFirst && expectedFirst >= 0 && this.currentPage > 1) {
        // Only fix if we're not on page 1 (to avoid unnecessary corrections)
        this.paginationFirst = expectedFirst;
        this.usersTable.first = expectedFirst;
        this.cdr.markForCheck();
      } else if (this.usersTable.first === expectedFirst || this.currentPage === 1) {
        // Pagination is correct or we're on page 1, mark as restored
        this.paginationRestored = true;
      }
    }
  }

  ngOnDestroy(): void {
    // Remove listener
    if (this.scrollListener) {
      this.scrollListener();
    }
    if (this.paginatorClickListener) {
      this.paginatorClickListener();
    }
    this.paginatorHostElement = null;
    // Save current state before destroying - ensure pagination is saved
    // Update scroll position before saving
    this.scrollPosition = this.getCurrentUsersScrollPosition();
    this.persistViewState();
    // Unsubscribe from router events
    if (this.routerSubscription) {
      this.routerSubscription.unsubscribe();
    }
    this.destroy$.next();
    this.destroy$.complete();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;

    // Handle date picker closing
    if (this.isDatePickerOpen) {
      const buttonEl = this.datePickerButton?.nativeElement;
      const contentEl = this.datePickerContent?.nativeElement;

      if (buttonEl && contentEl) {
        if (!buttonEl.contains(target) && !contentEl.contains(target) && this.dateRange.length === 2) {
          this.closeDatePicker();
        }
      }
    }

    // Handle popover closing
    // Check if click is inside a popover panel
    const isClickInsidePopover = target.closest('.p-popover') !== null || target.closest('[data-pc-section="content"]') !== null;

    // Check if click is on a filter icon (SVG with filter icon)
    const isClickOnFilterIcon = target.closest('svg[stroke="currentColor"]') !== null && target.closest('svg[stroke="currentColor"]')?.closest('.cursor-pointer') !== null;

    // Check if click is on PrimeNG multiselect or dropdown
    const isClickOnPrimeComponent =
      target.closest('p-multiselect') !== null ||
      target.closest('p-dropdown') !== null ||
      target.closest('.p-multiselect') !== null ||
      target.closest('.p-dropdown') !== null ||
      target.closest('.p-multiselect-panel') !== null ||
      target.closest('.p-dropdown-panel') !== null;

    // If click is not inside popover, not on filter icon, and not on PrimeNG component, close all popovers
    if (!isClickInsidePopover && !isClickOnFilterIcon && !isClickOnPrimeComponent) {
      this.closeAllFilterPopovers();
    }
  }

  private initializeColumns(): void {
    this.cols = [
      { field: 'lastName', header: 'Nachname' },
      { field: 'email', header: 'E-Mail' },
      { field: 'type', header: 'Kategorie' },
      { field: 'customer', header: 'Kunde' },
    ];

    this.usersOrderedColumns = [...this.cols];
    this.initializeVisibleColumns();
    this.selectedColumns = this.cols;
  }

  private restoreViewStateFromStore(): void {
    const savedState = this.usersListStateService.getViewStateSnapshot();
    if (!savedState) {
      return;
    }

    // Restore search terms
    if (savedState.clientSearch) {
      this.clientSearchSubject.next(savedState.clientSearch);
    }
    if (savedState.nameSearch) {
      this.nameSearchSubject.next(savedState.nameSearch);
    }
    if (savedState.categorySearch) {
      this.categorySearchSubject.next(savedState.categorySearch);
    }

    if (savedState.showFilters !== undefined && savedState.showFilters !== null) {
      this.showFilters = savedState.showFilters;
      this.showMobileFilters = savedState.showFilters;
    }

    // Restore column filters
    if (savedState.usersColumnFilters) {
      this.usersColumnFilters = this.cloneFilters(savedState.usersColumnFilters);
    }

    // Restore date range
    if (savedState.dateRange) {
      this.dateRange2 = savedState.dateRange;
    }

    // Restore column visibility and order
    if (savedState.usersVisibleColumns) {
      this.usersVisibleColumns = { ...this.usersVisibleColumns, ...savedState.usersVisibleColumns };
    }

    if (Array.isArray(savedState.usersOrderedColumns) && savedState.usersOrderedColumns.length > 0) {
      this.usersOrderedColumns = this.hydrateOrderedColumns(savedState.usersOrderedColumns);
    }

    // Restore selected columns
    if (Array.isArray(savedState.selectedColumns) && savedState.selectedColumns.length > 0) {
      this.selectedColumns = this.hydrateOrderedColumns(savedState.selectedColumns);
    }

    // Restore sort states
    this.sortField = savedState.sortField ?? this.sortField;
    this.sortOrder = savedState.sortOrder ?? this.sortOrder;

    // Restore pagination
    if (savedState.currentPage !== undefined && savedState.currentPage !== null) {
      this.currentPage = savedState.currentPage;
    }
    if (savedState.pageSize !== undefined && savedState.pageSize !== null) {
      this.pageSize = savedState.pageSize;
    }
    // Restore paginationFirst directly if available, otherwise calculate from currentPage and pageSize
    if (savedState.paginationFirst !== undefined && savedState.paginationFirst !== null) {
      this.paginationFirst = savedState.paginationFirst;
    } else {
      // Fallback: calculate from currentPage and pageSize
      this.paginationFirst = (this.currentPage - 1) * this.pageSize;
    }

    // Restore scroll position
    this.scrollPosition = savedState.scrollPosition || 0;

    // Sync selected columns with visible columns
    this.syncVisibleColumnSelections();
  }

  private syncVisibleColumnSelections(): void {
    // Ensure ordered columns are initialized
    if (this.usersOrderedColumns.length === 0) {
      this.usersOrderedColumns = [...this.cols];
    }

    // Sync selected columns - filter based on visible columns
    this.selectedColumns = this.usersOrderedColumns.filter((col) => {
      // If visibility is explicitly set, use it; otherwise default to true
      return this.usersVisibleColumns[col.field] !== false;
    });

    // If no columns selected, select all visible columns
    if (!this.selectedColumns.length) {
      this.selectedColumns = [...this.usersOrderedColumns];
      this.selectedColumns.forEach((col) => {
        if (this.usersVisibleColumns[col.field] === undefined) {
          this.usersVisibleColumns[col.field] = true;
        }
      });
    }
  }

  private hydrateOrderedColumns(storedColumns: StoredColumn[]): Column[] {
    const columnMap = this.cols.reduce<Record<string, Column>>((acc, column) => {
      acc[column.field] = column;
      return acc;
    }, {});

    const ordered: Column[] = [];
    storedColumns.forEach((stored) => {
      const match = columnMap[stored.field];
      if (match) {
        ordered.push(match);
      }
    });

    // Add any missing columns that weren't in the stored order
    this.cols.forEach((col) => {
      if (!ordered.find((c) => c.field === col.field)) {
        ordered.push(col);
      }
    });

    return ordered;
  }

  private cloneFilters(filters: Record<string, string[]>): Record<string, string[]> {
    return Object.keys(filters || {}).reduce<Record<string, string[]>>((acc, key) => {
      acc[key] = [...(filters[key] || [])];
      return acc;
    }, {});
  }

  // Keep pagination numbers in sync with the rendered table before persisting state
  private syncPaginationFromTable(): void {
    this.paginationFirst = (this.currentPage - 1) * this.pageSize;
  }

  private persistViewState(): void {
    // Ensure we capture the paginator state exactly as the table has it
    this.syncPaginationFromTable();
    // Ensure paginationFirst is calculated correctly before saving
    this.paginationFirst = (this.currentPage - 1) * this.pageSize;

    const storedUsersOrderedColumns = this.usersOrderedColumns.map((col) => ({ field: col.field, header: col.header }));
    const storedSelectedColumns = this.selectedColumns?.map((col) => ({ field: col.field, header: col.header })) || [];

    this.scrollPosition = this.getCurrentUsersScrollPosition();
    const viewState: UsersListViewState = {
      clientSearch: this.clientSearchSubject.value,
      nameSearch: this.nameSearchSubject.value,
      categorySearch: this.categorySearchSubject.value,
      showFilters: this.showFilters,
      usersColumnFilters: this.cloneFilters(this.usersColumnFilters),
      dateRange: this.dateRange2,
      usersVisibleColumns: { ...this.usersVisibleColumns },
      usersOrderedColumns: storedUsersOrderedColumns,
      selectedColumns: storedSelectedColumns,
      sortField: this.sortField,
      sortOrder: this.sortOrder,
      currentPage: this.currentPage,
      pageSize: this.pageSize,
      paginationFirst: this.paginationFirst, // Save paginationFirst directly
      scrollPosition: this.scrollPosition,
    };

    this.usersListStateService.saveViewState(viewState);
  }

  private setupSearchSubscriptions(): void {
    // Name and category searches are backend-driven so pagination reflects the full result set.
    combineLatest([this.nameSearchSubject.pipe(distinctUntilChanged()), this.categorySearchSubject.pipe(distinctUntilChanged())])
      .pipe(
        skip(1), // Ignore the initial emission produced during state restoration
        debounceTime(150), // Reduced debounce for better responsiveness
        takeUntil(this.destroy$),
      )
      .subscribe(() => {
        if (this.isRestoringFilters) {
          return;
        }
        this.persistViewState();
        this.loadUsers();
      });

    // Customer search remains local because the backend totalCount is not adjusted
    // for post-loaded company relationship filtering.
    this.clientSearchSubject.pipe(skip(1), distinctUntilChanged(), debounceTime(150), takeUntil(this.destroy$)).subscribe(() => {
      if (this.isRestoringFilters) {
        return;
      }
      this.persistViewState();
      this.loadUsers();
    });
  }

  loadUsers(): void {
    // During initial load, always proceed even if prefetch is running
    // This ensures we don't get stuck waiting for prefetch that might fail
    if (this.isLoading$.value && this.initialLoadDone) {
      // Only skip if we've already loaded data before (not initial load)
      return;
    }

    this.isLoading$.next(true);
    this.loading = true;

    const queryParams = this.buildQueryParams();

    this.usersService
      .getUsers(queryParams)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.users = response.data;
          if (this.shouldUseLocalFilteredPaginationTotal()) {
            this.totalRecords = response.data.length;
            this.hasNextPage = false;
          } else {
            this.totalRecords = response.totalCount || response.data.length;
            this.hasNextPage = !!response.hasNextPage;
          }
          this.loading = false;
          this.isLoading$.next(false);

          // Mark initial load as done
          this.initialLoadDone = true;
          // Refresh filtered cache after new data arrives (applies all filters including local search filters)
          this.updateFilteredUsersCache();

          // Ensure paginationFirst is recalculated after data is loaded (in case currentPage/pageSize changed)
          this.paginationFirst = (this.currentPage - 1) * this.pageSize;

          // Save data to store
          this.usersListStateService.setUsersData(response);

          // Use requestAnimationFrame to ensure table is ready before setting pagination
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              if (this.usersTable) {
                this.usersTable.first = this.paginationFirst;
                this.cdr.markForCheck();
              }
              this.restoreScrollPosition();
            });
          });
        },
        error: (error) => {
          console.error('Error loading users:', error);
          this.loading = false;
          this.isLoading$.next(false);
          // Ensure initialLoadDone is set even on error to prevent infinite loading
          if (!this.initialLoadDone) {
            this.initialLoadDone = true;
            // Show empty state if we have no data
            if (this.users.length === 0) {
              this.users = [];
              this.totalRecords = 0;
              this.updateFilteredUsersCache();
            }
          }
          this.restoreScrollPosition();
        },
      });
  }

  /**
   * Prefetch users data before component loads
   * Called in NavigationStart to ensure data is ready when component initializes
   */
  private prefetchUsersData(): void {
    // Don't clear cache here - let the component decide based on what's available
    // If prefetch completes before component loads, great. If not, component will use cache or load fresh.

    // Get stored view state for sorting (component may not be initialized yet)
    const storedState = this.usersListStateService.getViewStateSnapshot();
    const sortField = storedState?.sortField || '';
    const sortOrder = storedState?.sortOrder || 1;

    const storedCurrentPage = storedState?.currentPage || 1;
    const storedPageSize = storedState?.pageSize || this.pageSize;

    const queryParams: UserQueryParams = {
      page: storedCurrentPage,
      limit: storedPageSize,
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

    // Fetch data and update store immediately (before component loads)
    this.usersService
      .getUsers(queryParams)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          // Update store immediately so data is available when component loads
          this.usersListStateService.setUsersData(response);
        },
        error: (error) => {
          console.error('Error prefetching users:', error);
          // Reset prefetch flag on error so component knows to load normally
          this.dataPrefetched = false;
        },
      });
  }

  /**
   * Refresh users list and update store
   * Called when returning from edit/add page after successful update
   */
  refreshUsersList(): void {
    // Only refresh if component is already initialized (not during initial load)
    if (!this.initialLoadDone) {
      return;
    }

    // Clear cache to force fresh data load
    this.usersListStateService.clearCache();

    // Reload users with current filters and pagination
    this.loadUsers();
  }

  private buildQueryParams(): UserQueryParams {
    const useLocalFilteredPagination = this.shouldUseLocalFilteredPaginationTotal();
    const params: UserQueryParams = {
      page: useLocalFilteredPagination ? 1 : this.currentPage,
      limit: useLocalFilteredPagination ? 10000 : this.pageSize,
    };

    // Add sorting if specified
    if (this.sortField) {
      params.sort = [
        {
          orderBy: this.sortField as keyof User,
          order: this.sortOrder === 1 ? 'ASC' : 'DESC',
        },
      ];
    }

    const filters: NonNullable<UserQueryParams['filters']> = {};
    if (this.nameSearchSubject.value.trim()) {
      filters.search = this.nameSearchSubject.value.trim();
    }
    if (this.categorySearchSubject.value.trim()) {
      filters.userTypeSearch = this.categorySearchSubject.value.trim();
    }
    if (Object.keys(filters).length > 0) {
      params.filters = filters;
    }

    return params;
  }

  // Search methods - only update the subjects, don't call loadUsers directly
  onClientSearchChange(value: string): void {
    this.clientSearchSubject.next(value);
    this.updateFilteredUsersCache();
    // Query params will be updated by the subscription
  }

  onNameSearchChange(value: string): void {
    this.nameSearchSubject.next(value);
    this.updateFilteredUsersCache();
    // Query params will be updated by the subscription
  }

  onCategorySearchChange(value: string): void {
    this.categorySearchSubject.next(value);
    this.updateFilteredUsersCache();
    // Query params will be updated by the subscription
  }

  clearClientSearch(): void {
    this.clientSearchSubject.next('');
    this.updateFilteredUsersCache();
  }

  clearNameSearch(): void {
    this.nameSearchSubject.next('');
    this.updateFilteredUsersCache();
  }

  clearCategorySearch(): void {
    this.categorySearchSubject.next('');
    this.updateFilteredUsersCache();
  }

  // Add method to clear all filters
  clearFilters(): void {
    this.clientSearchSubject.next('');
    this.nameSearchSubject.next('');
    this.categorySearchSubject.next('');
    this.dateRange2 = { start: null, end: null };
    // Clear column filters
    this.usersColumnFilters = {
      firstName: [],
      lastName: [],
      email: [],
      type: [],
      customer: [],
    };
    this.updateFilteredUsersCache();
    this.persistViewState();
    this.loadUsers();
  }

  toggleFiltersVisibility(): void {
    this.showMobileFilters = !this.showMobileFilters;
    this.showFilters = this.showMobileFilters;
    if (!this.showMobileFilters) {
      this.closeAllFilterPopovers();
      this.closeColumnFilterModal();
    }
    this.persistViewState();
    setTimeout(() => this.updateUsersStickyOffset(), 0);
  }

  private updateUsersStickyOffset(): void {
    const toolbarEl = this.usersStickyToolbar?.nativeElement;
    if (!toolbarEl) {
      return;
    }

    this.usersStickyOffset = Math.ceil(toolbarEl.getBoundingClientRect().height);
    this.cdr.markForCheck();
  }

  // Navigate to add user page while preserving filters
  navigateToAddUser(): void {
    this.router.navigate(['/users/add']);
  }

  // Navigate to edit user page while preserving filters
  navigateToEditUser(userId: number | string): void {
    // Save state explicitly before navigation to ensure pagination is preserved
    this.persistViewState();
    this.router.navigate(['/users/edit', userId]);
  }

  rememberUsersListStateBeforeNavigate(): void {
    this.persistViewState();
  }

  // Sorting is backend-driven so page results stay stable across pagination.
  onUserSort(field: string, event?: Event): void {
    event?.stopPropagation();

    if (this.sortField === field) {
      this.sortOrder = this.sortOrder * -1;
    } else {
      this.sortField = field;
      this.sortOrder = 1;
    }

    this.currentPage = 1;
    this.paginationFirst = 0;
    this.persistViewState();
    this.loadUsers();
  }

  // Handle pagination changes with a fresh backend fetch.
  onPageChange(event: any): void {
    this.currentPage = Math.floor(event.first / event.rows) + 1;
    this.pageSize = event.rows;
    this.paginationFirst = event.first;
    this.paginationRestored = true; // Mark as restored since user just changed it
    this.persistViewState();
    if (this.shouldUseLocalFilteredPaginationTotal()) {
      this.updateFilteredUsersCache();
      return;
    }
    this.loadUsers();
  }

  private restoreScrollPosition(): void {
    const target = this.scrollPosition || 0;
    if (target <= 0) {
      return;
    }

    let attempts = 0;
    const maxAttempts = 120;

    const tryRestore = () => {
      const container = this.usersScrollContainer?.nativeElement;
      if (container) {
        const needsRestore = Math.abs((container.scrollTop || 0) - target) > 2;
        if (needsRestore) {
          container.scrollTop = target;
          requestAnimationFrame(() => {
            container.scrollTop = target;
          });
        }

        // Keep trying for a short window to survive async layout/render passes.
        if (attempts < maxAttempts) {
          attempts++;
          setTimeout(tryRestore, 16);
        }
        return;
      }

      if (attempts < maxAttempts) {
        attempts++;
        setTimeout(tryRestore, 16);
      }
    };

    setTimeout(tryRestore, 0);
  }

  private attachUsersScrollListener(): void {
    if (this.scrollListener) {
      return;
    }

    const container = this.usersScrollContainer?.nativeElement;
    if (container) {
      this.scrollListener = this.renderer.listen(container, 'scroll', () => {
        this.scrollPosition = container.scrollTop || 0;
      });
      return;
    }

    // Fallback to window scrolling if container is not ready yet.
    this.scrollListener = this.renderer.listen('window', 'scroll', () => {
      this.scrollPosition = window.scrollY || document.documentElement.scrollTop;
    });
  }

  private attachUsersPaginatorListener(): void {
    const paginatorElement = this.usersPaginator?.el?.nativeElement as HTMLElement | undefined;
    if (!paginatorElement) {
      if (this.paginatorClickListener) {
        this.paginatorClickListener();
        this.paginatorClickListener = null;
      }
      this.paginatorHostElement = null;
      return;
    }

    if (this.paginatorHostElement === paginatorElement && this.paginatorClickListener) {
      return;
    }

    if (this.paginatorClickListener) {
      this.paginatorClickListener();
      this.paginatorClickListener = null;
    }

    this.paginatorHostElement = paginatorElement;

    // PrimeNG's standalone paginator can update its internal state without
    // reliably emitting onPage in this workspace, so mirror the staff fallback.
    this.paginatorClickListener = this.renderer.listen(paginatorElement, 'click', (event: Event) => {
      const target = (event.target as HTMLElement | null)?.closest('.p-paginator-page, .p-paginator-first, .p-paginator-prev, .p-paginator-next, .p-paginator-last') as HTMLElement | null;

      if (!target) {
        return;
      }

      setTimeout(() => {
        const newFirst = this.usersPaginator?.first ?? this.paginationFirst;
        const newRows = this.usersPaginator?.rows ?? this.pageSize;
        if (newFirst !== this.paginationFirst || newRows !== this.pageSize) {
          this.onPageChange({ first: newFirst, rows: newRows });
        }
      }, 50);
    });
  }

  private getCurrentUsersScrollPosition(): number {
    const container = this.usersScrollContainer?.nativeElement;
    if (container) {
      return container.scrollTop || 0;
    }
    return window.scrollY || document.documentElement.scrollTop;
  }

  // Column management methods
  initializeVisibleColumns(): void {
    this.cols.forEach((col) => {
      this.usersVisibleColumns[col.field] = true;
    });
  }

  getUsersVisibleColumns(): Column[] {
    return this.usersOrderedColumns.filter((col) => this.usersVisibleColumns[col.field]);
  }

  onUsersColReorder(event: any): void {
    if (event && typeof event.dragIndex === 'number' && typeof event.dropIndex === 'number') {
      const movedColumn = this.usersOrderedColumns[event.dragIndex];
      const newOrderedColumns = [...this.usersOrderedColumns];
      newOrderedColumns.splice(event.dragIndex, 1);
      newOrderedColumns.splice(event.dropIndex, 0, movedColumn);
      this.usersOrderedColumns = newOrderedColumns;
      this.persistViewState();
    }
  }

  onUsersColumnsChange(selectedColumns: Column[]): void {
    Object.keys(this.usersVisibleColumns).forEach((key) => {
      this.usersVisibleColumns[key] = false;
    });

    selectedColumns.forEach((col) => {
      this.usersVisibleColumns[col.field] = true;
    });

    this.selectedColumns = selectedColumns;
    this.persistViewState();
  }

  // Utility methods
  getUserDisplayValue(user: User, field: string): string {
    switch (field) {
      case 'role':
        return user.role?.name || '-';
      case 'status':
        return user.status?.name || '-';
      case 'type':
        return user.type?.name || '-';
      case 'fullName':
        return `${user.firstName || ''} ${user.lastName || ''}`.trim();
      default:
        return (user as any)[field] || '-';
    }
  }

  // Get tooltip value for truncated cells
  getTooltipValue(user: User, field: string): string {
    switch (field) {
      case 'lastName':
        return user.lastName || '';
      case 'email':
        return user.email || '';
      case 'type':
        return user.type?.name || '';
      case 'customer':
        return this.getUserClientCompanies(user);
      default:
        return this.getUserDisplayValue(user, field);
    }
  }

  getUserStatusSeverity(status: string): string {
    switch (status?.toLowerCase()) {
      case 'active':
        return 'success';
      case 'inactive':
        return 'danger';
      case 'pending':
        return 'warn';
      default:
        return 'info';
    }
  }

  /**
   * Get client companies for display in the table
   */
  getUserClientCompanies(user: User): string {
    // For akzente users, show favorite client companies
    if (user.type?.name === 'akzente' && user.clientCompanies) {
      return user.clientCompanies.map((company) => company.name).join(', ');
    }

    // For client users, show assigned client companies
    if (user.type?.name === 'client' && user.clientCompanies) {
      return user.clientCompanies.map((company) => company.name).join(', ');
    }

    // For other user types or empty arrays, return dash
    return '-';
  }

  // Date picker methods
  toggleDatePicker(): void {
    this.isDatePickerOpen = !this.isDatePickerOpen;
  }

  closeDatePicker(): void {
    this.isDatePickerOpen = false;
  }

  onDateRangeSelect(event: any): void {
    if (this.dateRange.length === 2) {
      setTimeout(() => this.closeDatePicker(), 200);
    }
  }

  onDateSelected(date: Date): void {
    this.myDate = date;
  }

  onRangeSelected(range: { start: Date | null; end: Date | null }): void {}

  // Column filter methods
  getUsersFilterOptions(field: string): { label: string; value: string }[] {
    const values = new Set<string>();
    const filteredUsers = this.getFilteredUsers(field);

    // Special handling for customer field - extract individual companies
    if (field === 'customer') {
      filteredUsers.forEach((user) => {
        if (user.clientCompanies && user.clientCompanies.length > 0) {
          user.clientCompanies.forEach((company) => {
            values.add(this.normalizeColumnFilterValue(company.name));
          });
        } else {
          values.add('');
        }
      });
      this.appendSelectedFilterValues(values, this.usersColumnFilters[field]);
      return this.sortColumnFilterValues(Array.from(values)).map((val) => ({
        label: this.getColumnFilterOptionLabel(val),
        value: val,
      }));
    }

    // Handle other fields normally
    filteredUsers.forEach((user) => {
      let value: string = '';
      switch (field) {
        case 'firstName':
          value = user.firstName || '';
          break;
        case 'lastName':
          value = user.lastName || '';
          break;
        case 'email':
          value = user.email || '';
          break;
        case 'type':
          value = user.type?.name || '';
          break;
        default:
          value = '';
      }
      values.add(this.normalizeColumnFilterValue(value));
    });
    this.appendSelectedFilterValues(values, this.usersColumnFilters[field]);
    return this.sortColumnFilterValues(Array.from(values)).map((val) => ({
      label: this.getColumnFilterOptionLabel(val),
      value: val,
    }));
  }

  canFilterUsersColumn(field: string): boolean {
    return this.getUsersFilterOptions(field).length > 0;
  }

  getUsersColumnFilterValue(field: string): string[] {
    const filter = this.usersColumnFilters[field];
    return filter && Array.isArray(filter) ? filter : [];
  }

  private showColumnFilterPopover(popoverRef: any, targetElement: HTMLElement, delay = 120): void {
    if (!popoverRef || !targetElement) {
      return;
    }

    if (this.columnFilterPopoverTimeout) {
      clearTimeout(this.columnFilterPopoverTimeout);
      this.columnFilterPopoverTimeout = null;
    }

    const positioningEvent = {
      currentTarget: targetElement,
      target: targetElement,
      preventDefault: () => {},
      stopPropagation: () => {},
    } as any;

    popoverRef.hide();
    this.activeUsersColumnFilterPopover = null;
    this.cdr.detectChanges();

    this.columnFilterPopoverTimeout = setTimeout(() => {
      popoverRef.show(positioningEvent);
      this.activeUsersColumnFilterPopover = popoverRef;

      // Immediately open the first dropdown/multiselect inside the popover so the user doesn't need a second click
      this.scheduleOpenFirstDropdown(popoverRef);

      this.cdr.detectChanges();
    }, delay);
  }

  private closeActiveColumnFilterPopover(except?: any): void {
    if (this.usersColumnFilterPopover && this.usersColumnFilterPopover !== except) {
      this.usersColumnFilterPopover.hide();
    }

    if (this.activeUsersColumnFilterPopover && this.activeUsersColumnFilterPopover !== except) {
      this.activeUsersColumnFilterPopover = null;
    }
  }

  onUsersColumnFilterPopoverClose(): void {
    if (this.usersColumnFilterPopover) {
      this.usersColumnFilterPopover.hide();
    }
    if (this.activeUsersColumnFilterPopover === this.usersColumnFilterPopover) {
      this.activeUsersColumnFilterPopover = null;
    }
  }

  private hideSettingsPopovers(except?: any): void {
    if (!except || (this.activeSettingsPopover && this.activeSettingsPopover !== except)) {
      if (this.activeSettingsPopover) {
        this.activeSettingsPopover.hide();
      }
      this.activeSettingsPopover = null;
    }
  }

  toggleSettingsPopover(popoverRef: any, event: Event): void {
    const targetElement = (event.currentTarget || event.target) as HTMLElement;
    if (!popoverRef || !targetElement) {
      return;
    }

    event.stopPropagation();

    if (this.activeSettingsPopover === popoverRef) {
      this.closeSettingsColumnsSelector();
      popoverRef.hide();
      this.activeSettingsPopover = null;
      return;
    }

    this.closeActiveColumnFilterPopover();
    this.hideSettingsPopovers(popoverRef);

    const positioningEvent = {
      currentTarget: targetElement,
      target: targetElement,
      preventDefault: () => {},
      stopPropagation: () => {},
    } as any;

    popoverRef.hide();

    setTimeout(() => {
      popoverRef.show(positioningEvent);
      this.activeSettingsPopover = popoverRef;

      // Immediately open the first dropdown/multiselect inside the popover so the user doesn't need a second click
      this.scheduleOpenFirstDropdown(popoverRef);
      this.openSettingsColumnsSelector();
    }, 120);
  }

  private scheduleOpenFirstDropdown(popoverRef: any): void {
    // Try a few times to catch the overlay once it is rendered
    [0, 50, 120].forEach((delay) => setTimeout(() => this.tryOpenFirstDropdown(popoverRef), delay));
  }

  private openSettingsColumnsSelector(): void {
    if (!this.usersColumnsMultiSelect || this.usersColumnsMultiSelect.overlayVisible) {
      return;
    }

    [0, 50, 120].forEach((delay) =>
      setTimeout(() => {
        if (!this.usersColumnsMultiSelect?.overlayVisible) {
          this.usersColumnsMultiSelect?.show();
        }
      }, delay),
    );
  }

  private closeSettingsColumnsSelector(): void {
    if (this.usersColumnsMultiSelect?.overlayVisible) {
      this.usersColumnsMultiSelect.hide();
    }
  }

  private tryOpenFirstDropdown(popoverRef: any): void {
    const overlay: HTMLElement | null = popoverRef?.overlay?.nativeElement ?? (document.querySelector('.p-popover') as HTMLElement | null);
    if (!overlay) return;

    const trigger = overlay.querySelector('.p-multiselect-trigger, .p-dropdown-trigger') as HTMLElement | null;
    if (trigger) {
      trigger.click();
      return;
    }

    // Fallback: click the first multiselect to open its panel
    const multi = overlay.querySelector('.p-multiselect') as HTMLElement | null;
    if (multi) {
      multi.click();
    }
  }

  onMultiSelectPanelShow(multiSelect?: MultiSelect): void {
    if (!multiSelect) {
      return;
    }

    requestAnimationFrame(() => this.syncMultiSelectPanelWidth(multiSelect));
  }

  private syncMultiSelectPanelWidth(multiSelect: MultiSelect): void {
    // PrimeNG's types don't expose container/overlay elements, so access via `any` and guard
    const triggerEl = (multiSelect as any)?.containerViewChild?.nativeElement as HTMLElement | null;
    const overlayEl = (multiSelect as any)?.overlayViewChild?.nativeElement as HTMLElement | null;

    if (!triggerEl || !overlayEl) {
      return;
    }

    const width = triggerEl.getBoundingClientRect().width;
    overlayEl.style.width = `${width}px`;
    overlayEl.style.minWidth = `${width}px`;
  }

  /**
   * Close all filter popovers
   */
  closeAllFilterPopovers(): void {
    this.closeActiveColumnFilterPopover();
    this.hideSettingsPopovers();
  }

  isMobileColumnFilter(): boolean {
    return typeof window !== 'undefined' && window.innerWidth < 1024;
  }

  openColumnFilterModal(): void {
    this.showColumnFilterModal = true;
    this.cdr.detectChanges();
  }

  closeColumnFilterModal(): void {
    this.showColumnFilterModal = false;
    this.activeUsersColumnFilterPopover = null;
    this.cdr.detectChanges();
  }

  getColumnFilterModalTitle(): string {
    return this.currentUsersFilterField ? this.getColumnHeader(this.currentUsersFilterField) : 'Filter';
  }

  /**
   * Open users column filter popover
   */
  openUsersColumnFilter(field: string, event: Event): void {
    event.stopPropagation();

    if (!this.canFilterUsersColumn(field)) {
      return;
    }

    // Store the actual DOM element for positioning - use currentTarget (the div wrapper)
    const targetElement = (event.currentTarget || event.target) as HTMLElement;

    if (!targetElement) {
      return;
    }

    // Close settings popover if open
    this.hideSettingsPopovers();

    // On mobile: open centered modal instead of popover
    if (this.isMobileColumnFilter()) {
      const isSameField = this.currentUsersFilterField === field;
      if (isSameField && this.showColumnFilterModal) {
        this.closeColumnFilterModal();
        return;
      }
      this.closeColumnFilterModal();
      this.currentUsersFilterField = field;
      if (!this.usersColumnFilters[field]) {
        this.usersColumnFilters[field] = [];
      }
      this.currentUsersFilterOptions = this.getUsersFilterOptions(field);
      this.openColumnFilterModal();
      return;
    }

    // Check if the same field is already open
    const isSameField = this.currentUsersFilterField === field;
    const isPopoverOpen = this.activeUsersColumnFilterPopover === this.usersColumnFilterPopover;

    // If clicking on the same field that's already open, just close it
    if (isSameField && isPopoverOpen) {
      this.closeActiveColumnFilterPopover();
      return;
    }

    this.closeActiveColumnFilterPopover();

    this.currentUsersFilterField = field;
    // Initialize filter values if not exists
    if (!this.usersColumnFilters[field]) {
      this.usersColumnFilters[field] = [];
    }

    // Calculate options once when opening
    this.currentUsersFilterOptions = this.getUsersFilterOptions(field);

    this.showColumnFilterPopover(this.usersColumnFilterPopover, targetElement, 120);
  }

  /**
   * Handle users column filter change
   */
  onUsersColumnFilterChange(): void {
    this.persistViewState();
    this.updateFilteredUsersCache();
  }

  /**
   * Clear filter for a specific column
   */
  onUsersColumnFilterCleared(): void {
    if (this.currentUsersFilterField) {
      this.usersColumnFilters[this.currentUsersFilterField] = [];
    }
    this.onUsersColumnFilterChange();
  }

  /**
   * Check if any column filters are active
   */
  hasUsersColumnFilters(): boolean {
    return Object.values(this.usersColumnFilters).some((filters) => filters && Array.isArray(filters) && filters.length > 0);
  }

  hasActiveUsersFilters(): boolean {
    return this.hasUsersColumnFilters() || !!this.clientSearch?.trim() || !!this.nameSearch?.trim() || !!this.categorySearch?.trim();
  }

  shouldShowUsersTable(): boolean {
    return this.users.length > 0 || this.hasActiveUsersFilters();
  }

  // Update cached filtered users - call this when users or filters change
  updateFilteredUsersCache(excludeField?: string): void {
    if (!this.isRestoringFilters) {
      const isFiltering = this.shouldUseLocalFilteredPaginationTotal();
      if (!this.wasFiltering && isFiltering) {
        this.preFilterPage = this.currentPage;
        this.currentPage = 1;
        this.paginationFirst = 0;
      } else if (this.wasFiltering && !isFiltering) {
        this.currentPage = this.preFilterPage;
        this.paginationFirst = (this.preFilterPage - 1) * this.pageSize;
      }
      this.wasFiltering = isFiltering;
    }
    const filtered = this.computeFilteredUsers(excludeField);
    this.filteredUsersCache = this.sortField ? this.applyUserSorting(filtered, this.sortField, this.sortOrder) : filtered;
    this.ensureValidCurrentPageForFilteredUsers();
    this.updateVisibleUsersForCurrentPage();
    this.refreshCurrentUsersFilterOptions();
    this.refreshUsersMobileFilterSheetState();
  }

  private ensureValidCurrentPageForFilteredUsers(): void {
    if (!this.shouldUseLocalFilteredPaginationTotal()) {
      return;
    }
    const totalPages = Math.max(1, Math.ceil(this.filteredUsersCache.length / this.pageSize));
    if (this.currentPage > totalPages) {
      this.currentPage = totalPages;
    }
    if (this.currentPage < 1) {
      this.currentPage = 1;
    }
    this.paginationFirst = (this.currentPage - 1) * this.pageSize;
  }

  private updateVisibleUsersForCurrentPage(): void {
    if (!this.shouldUseLocalFilteredPaginationTotal()) {
      this.paginatedUsersCache = this.filteredUsersCache;
      return;
    }
    const start = (this.currentPage - 1) * this.pageSize;
    this.paginatedUsersCache = this.filteredUsersCache.slice(start, start + this.pageSize);
  }

  private refreshCurrentUsersFilterOptions(): void {
    if (!this.currentUsersFilterField) {
      return;
    }

    this.currentUsersFilterOptions = this.getUsersFilterOptions(this.currentUsersFilterField);
  }

  // Internal method to compute filtered users
  private computeFilteredUsers(excludeField?: string): User[] {
    const clientSearch = this.clientSearchSubject.value.trim().toLowerCase();
    const nameSearch = this.nameSearchSubject.value.trim().toLowerCase();
    const categorySearch = this.categorySearchSubject.value.trim().toLowerCase();

    return this.users.filter((user) => {
      // Filter by clientSearch (Kundensuche) - search in client company names
      if (clientSearch) {
        const userClientNames = user.clientCompanies?.map((c) => c.name?.toLowerCase() || '').join(' ') || '';
        if (!userClientNames.includes(clientSearch)) {
          return false;
        }
      }

      // Filter by nameSearch (Namenssuche) - search in first name or last name only
      if (nameSearch) {
        const firstName = (user.firstName || '').toLowerCase();
        const lastName = (user.lastName || '').toLowerCase();
        const fullName = `${firstName} ${lastName}`.toLowerCase();

        if (!firstName.includes(nameSearch) && !lastName.includes(nameSearch) && !fullName.includes(nameSearch)) {
          return false;
        }
      }

      // Filter by categorySearch (Kategoriesuche) - filter by user type name
      if (categorySearch) {
        const userTypeName = (user.type?.name || '').toLowerCase();

        // Check if user type name matches the search term
        // Support searching for "akzente", "client", "kunde", etc.
        if (categorySearch.includes('akzente')) {
          if (!userTypeName.includes('akzente')) {
            return false;
          }
        } else if (categorySearch.includes('client') || categorySearch.includes('kunde')) {
          if (!userTypeName.includes('client')) {
            return false;
          }
        } else {
          // For any other search term, check if user type name contains it
          if (!userTypeName.includes(categorySearch)) {
            return false;
          }
        }
      }

      // Filter by firstName
      const firstNameFilter = this.usersColumnFilters['firstName'];
      if (
        excludeField !== 'firstName' &&
        firstNameFilter &&
        Array.isArray(firstNameFilter) &&
        firstNameFilter.length > 0 &&
        !firstNameFilter.includes(this.normalizeColumnFilterValue(user.firstName))
      ) {
        return false;
      }
      // Filter by lastName
      const lastNameFilter = this.usersColumnFilters['lastName'];
      if (excludeField !== 'lastName' && lastNameFilter && Array.isArray(lastNameFilter) && lastNameFilter.length > 0 && !lastNameFilter.includes(this.normalizeColumnFilterValue(user.lastName))) {
        return false;
      }
      // Filter by email
      const emailFilter = this.usersColumnFilters['email'];
      if (excludeField !== 'email' && emailFilter && Array.isArray(emailFilter) && emailFilter.length > 0 && !emailFilter.includes(this.normalizeColumnFilterValue(user.email))) {
        return false;
      }
      // Filter by type
      const typeFilter = this.usersColumnFilters['type'];
      if (excludeField !== 'type' && typeFilter && Array.isArray(typeFilter) && typeFilter.length > 0 && !typeFilter.includes(this.normalizeColumnFilterValue(user.type?.name))) {
        return false;
      }
      // Filter by customer - check if any of the user's customers match the filter
      const customerFilter = this.usersColumnFilters['customer'];
      if (excludeField !== 'customer' && customerFilter && Array.isArray(customerFilter) && customerFilter.length > 0) {
        // Get individual customer names from the user
        const userCustomers: string[] = [];
        if (user.clientCompanies && user.clientCompanies.length > 0) {
          user.clientCompanies.forEach((company) => {
            userCustomers.push(this.normalizeColumnFilterValue(company.name));
          });
        }
        if (userCustomers.length === 0) {
          userCustomers.push('');
        }
        // Check if any of the user's customers match the filter
        const hasMatchingCustomer = userCustomers.some((customer) => customerFilter.includes(this.normalizeColumnFilterValue(customer)));
        if (!hasMatchingCustomer) {
          return false;
        }
      }
      return true;
    });
  }

  private applyUserSorting(users: User[] = [], field: string, order: number): User[] {
    if (!field) {
      return [...users];
    }

    const sorted = [...users];
    sorted.sort((a, b) => {
      const valueA = this.getUserSortValue(a, field);
      const valueB = this.getUserSortValue(b, field);

      if (valueA === valueB) {
        return 0;
      }

      if (typeof valueA === 'number' && typeof valueB === 'number') {
        return valueA < valueB ? order * -1 : order;
      }

      const normalizedA = (valueA ?? '').toString().toLowerCase();
      const normalizedB = (valueB ?? '').toString().toLowerCase();
      return order * normalizedA.localeCompare(normalizedB, 'de', { sensitivity: 'base', numeric: true });
    });

    return sorted;
  }

  private getUserSortValue(user: User, field: string): string | number {
    switch (field) {
      case 'firstName':
        return user.firstName || '';
      case 'lastName':
        return user.lastName || '';
      case 'email':
        return user.email || '';
      case 'type':
        return user.type?.name || '';
      case 'customer':
        return this.getUserClientCompanies(user);
      default:
        return (user as any)?.[field] ?? '';
    }
  }

  // Keep for backwards compatibility with filter dropdown
  getFilteredUsers(excludeField?: string): User[] {
    if (excludeField) {
      // For filter dropdowns, compute fresh
      return this.computeFilteredUsers(excludeField);
    }
    return this.filteredUsersCache;
  }

  // Get column header for a field
  getColumnHeader(field: string): string {
    const col = this.cols.find((c) => c.field === field);
    return col ? col.header : field;
  }

  // Get placeholder text for filter
  getFilterPlaceholder(field: string): string {
    const header = this.getColumnHeader(field);
    return `Alle ${header}`;
  }

  openUsersMobileFilterSheet(): void {
    this.refreshUsersMobileFilterSheetState();
    this.showUsersMobileFilter = true;
  }

  private refreshUsersMobileFilterSheetState(): void {
    const nextOptions: { [field: string]: FilterOption[] } = {};
    const nextCanFilterMap: { [field: string]: boolean } = {};

    const columns = this.getUsersMobileFilterColumns();
    columns.forEach((col) => {
      const canFilter = this.canFilterUsersColumn(col.field);
      nextCanFilterMap[col.field] = canFilter;
      if (canFilter) {
        nextOptions[col.field] = this.getUsersFilterOptions(col.field);
      }
    });

    this.usersCanFilterMap = nextCanFilterMap;
    this.usersMobileColumnOptions = nextOptions;
  }

  onUsersMobileFilterChanged(event: { field: string; values: string[] }): void {
    this.usersColumnFilters[event.field] = event.values;
    this.onUsersColumnFilterChange();
  }

  onUsersMobileFilterCleared(): void {
    this.usersColumnFilters = {
      firstName: [],
      lastName: [],
      email: [],
      type: [],
      customer: [],
    };
    this.onUsersColumnFilterChange();
  }

  getTotalUsersActiveFilters(): number {
    return Object.values(this.usersColumnFilters).reduce((sum, arr) => sum + (arr?.length || 0), 0);
  }

  getUsersMobileFilterColumns(): { field: string; header: string }[] {
    const columns: { field: string; header: string }[] = [{ field: 'firstName', header: 'Vorname' }];

    this.getUsersVisibleColumns().forEach((col) => {
      if (!columns.some((existing) => existing.field === col.field)) {
        columns.push({ field: col.field, header: col.header });
      }
    });

    return columns;
  }
}
