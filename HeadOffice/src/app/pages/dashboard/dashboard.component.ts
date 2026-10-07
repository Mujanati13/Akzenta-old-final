import { Component, OnInit, ViewEncapsulation, ViewChild, HostListener, OnDestroy, AfterViewInit, Renderer2, ChangeDetectorRef, ElementRef } from '@angular/core';
import { Router, NavigationStart } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ImportsModule } from '@app/shared/imports';
import { AppIconComponent } from '../../shared/app-icon.component';
import { FavoriteToggleComponent } from '@app/shared/components/favorite-toggle/favorite-toggle.component';
import { SettingsButtonComponent } from '@app/components/settings-button/settings-button.component';
import { ClientsRoutingModule } from '../clients/clients-routing.module';
import { DashboardService, DashboardReport, DashboardClientCompany, DashboardData } from '@app/core/services/dashboard.service';
import { EuDatePipe } from '@app/shared/pipes/eu-date.pipe';
import { MerchandiserService, Merchandiser } from '@app/core/services/merchandiser.service';
import { Table } from 'primeng/table';
import { MenuItem } from 'primeng/api';

interface ReportCounts {
  newReports: number;
  ongoingReports: number;
  completedReports: number;
}

interface ClientCompanyWithCounts extends DashboardClientCompany {
  reportCounts?: ReportCounts;
  isMyClient?: boolean;
}

interface ClientCompanyAssignedAkzente extends DashboardClientCompany {
  reportCounts?: ReportCounts;
}
import { ReportService } from '@app/core/services/report.service';
import { ClientCompanyService } from '@app/core/services/client-company.service';
import { DashboardStateService, DashboardViewState, StoredColumn } from '@app/core/services/dashboard-state.service';
import { HotToastService } from '@ngxpert/hot-toast';
import { catchError, of, Subscription } from 'rxjs';
import { ReportStatusEnum } from '@app/@core/enums/status.enum';
import { categorizeReportForAkzente } from '@app/@core/utils/report-akzente-status.util';
import { ConfirmationDialogComponent } from '@app/shared/components/confirmation-dialog/confirmation-dialog.component';
import { ColumnFilterPopoverComponent } from '@app/shared/components/column-filter-popover/column-filter-popover.component';
import { ColumnFilterDialogComponent } from '@app/shared/components/column-filter-dialog/column-filter-dialog.component';
import { MobileFilterBottomSheetComponent, FilterOption } from '@app/shared/components/mobile-filter-bottom-sheet/mobile-filter-bottom-sheet.component';

interface Product {
  id?: string;
  code?: string;
  name?: string;
  description?: string;
  price?: number;
  quantity?: number;
  inventoryStatus?: string;
  category?: string;
  image?: string;
  rating?: number;
  isFavorite?: boolean; // Add this property
  client?: string;
}
type Column = StoredColumn;

const createDefaultColumnFilters = () => ({
  status: [] as string[],
  kunde: [] as string[],
  store: [] as string[],
  ort: [] as string[],
  besuchsdatum: [] as string[],
  vm: [] as string[],
});

type ColumnFilterState = ReturnType<typeof createDefaultColumnFilters>;

/** Label shown in column filter list for empty / missing cell values (matches `-` / missing status name in filter logic). */
const COLUMN_FILTER_EMPTY_LABEL = '---';

@Component({
  selector: 'app-dashboard',
  imports: [
    TranslateModule,
    ClientsRoutingModule,
    ImportsModule,
    AppIconComponent,
    FavoriteToggleComponent,
    SettingsButtonComponent,
    EuDatePipe,
    ConfirmationDialogComponent,
    ColumnFilterPopoverComponent,
    ColumnFilterDialogComponent,
    MobileFilterBottomSheetComponent,
  ],
  providers: [EuDatePipe],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
  encapsulation: ViewEncapsulation.None,
})
export class DashboardComponent implements OnInit, OnDestroy, AfterViewInit {
  // API data
  newReports: DashboardReport[] = [];
  rejectedReports: DashboardReport[] = [];
  clientCompaniesAssignedAkzente: ClientCompanyWithCounts[] = [];
  last4ClientCompanies: ClientCompanyWithCounts[] = [];
  totalClientCompaniesCount = 0;
  loading = true;
  error = false;
  isNewReportsOpen = true; // Added property for collapsing new reports
  isRejectedReportsOpen = true; // Added property for collapsing rejected reports
  myClientIds: Set<number> = new Set(); // Store IDs of "my clients"

  // Merchandiser selection
  merchandisers: Merchandiser[] = [];
  editingReportId: string | number | null = null;
  private originalMerchandiserByReportId = new Map<string | number, DashboardReport['merchandiser'] | null>();

  items: MenuItem[] = [];
  selectedReport: any;

  // Merchandiser confirmation state
  showMerchandiserConfirmation = false;
  pendingMerchandiserChange: { report: DashboardReport; merchandiser: Merchandiser } | null = null;
  merchandiserUpdateLoading = false;

  // Legacy properties for backward compatibility
  products!: Product[];
  newProducts: Product[] = [];
  overdueProducts: Product[] = [];
  selectedProduct!: Product;
  cols!: Column[];
  newProductsColumns!: Column[];
  overdueProductsColumns!: Column[];
  selectedColumns!: Column[];

  // Add these properties for sorting
  sortField: string = '';
  sortOrder: number = 1; // 1 for ascending, -1 for descending
  overdueSortField: string = '';
  overdueSortOrder: number = 1;

  // Add these properties to track visible columns
  newProductsVisibleColumns: { [key: string]: boolean } = {};
  overdueProductsVisibleColumns: { [key: string]: boolean } = {};

  // Add these properties to track column order
  newProductsOrderedColumns: Column[] = [];
  overdueProductsOrderedColumns: Column[] = [];

  // Filter properties for new reports table columns (using arrays for multiselect)
  newReportsColumnFilters: ColumnFilterState = createDefaultColumnFilters();

  // Filter properties for rejected reports table columns (using arrays for multiselect)
  rejectedReportsColumnFilters: ColumnFilterState = createDefaultColumnFilters();

  // Track current filter field for popovers
  currentNewReportsFilterField: string = '';
  currentRejectedReportsFilterField: string = '';

  // Mobile column filter modal (centered dialog on small screens)
  showColumnFilterModal = false;
  columnFilterModalType: 'newReports' | 'rejectedReports' | null = null;

  // Mobile filter bottom sheet
  showNewReportsMobileFilter = false;
  showRejectedReportsMobileFilter = false;
  newReportsMobileColumnOptions: { [field: string]: FilterOption[] } = {};
  rejectedReportsMobileColumnOptions: { [field: string]: FilterOption[] } = {};
  newReportsCanFilterMap: { [field: string]: boolean } = {};
  rejectedReportsCanFilterMap: { [field: string]: boolean } = {};

  // Cache for filter options to avoid recalculation during change detection
  currentNewReportsFilterOptions: { label: string; value: string; color?: string }[] = [];
  currentRejectedReportsFilterOptions: { label: string; value: string; color?: string }[] = [];

  // Page animation state
  contentAnimationReady = false;
  loadingAnimationDone = false;

  // ViewChild references for popovers
  @ViewChild('newReportsStatusFilterPopover') newReportsStatusFilterPopover: any;
  @ViewChild('newReportsColumnFilterPopover') newReportsColumnFilterPopover: any;
  @ViewChild('rejectedReportsStatusFilterPopover') rejectedReportsStatusFilterPopover: any;
  @ViewChild('rejectedReportsColumnFilterPopover') rejectedReportsColumnFilterPopover: any;
  @ViewChild('newProductsSettingsPopover') newProductsSettingsPopover: any;
  @ViewChild('overdueProductsSettingsPopover') overdueProductsSettingsPopover: any;
  @ViewChild('newReportsTable') newReportsTable!: Table;
  @ViewChild('rejectedReportsTable') rejectedReportsTable!: Table;
  @ViewChild('dashboardScrollRoot') dashboardScrollRoot?: ElementRef<HTMLElement>;

  private routerSubscription: Subscription | null = null;
  private nextUrl: string | null = null;

  private activeColumnFilterPopover: any = null;
  private activeSettingsPopover: any = null;
  private columnFilterPopoverTimeout: any = null;

  private scrollListener: (() => void) | null = null;
  private scrollContainerEl: HTMLElement | null = null;
  private scrollPosition = 0;
  private newReportsTableScrollPosition = 0;
  private newReportsTableScrollListener: (() => void) | null = null;
  private rejectedReportsTableScrollPosition = 0;
  private rejectedReportsTableScrollListener: (() => void) | null = null;

  constructor(
    private dashboardService: DashboardService,
    private reportService: ReportService,
    private clientCompanyService: ClientCompanyService,
    private merchandiserService: MerchandiserService,
    private dashboardStateService: DashboardStateService,
    private toast: HotToastService,
    private translate: TranslateService,
    private router: Router,
    private renderer: Renderer2,
    private euDatePipe: EuDatePipe,
    private cd: ChangeDetectorRef,
  ) {
    this.routerSubscription = this.router.events.subscribe((event) => {
      if (event instanceof NavigationStart) {
        this.nextUrl = event.url;
        if (this.shouldPersistStateForUrl(event.url)) {
          this.persistViewState();
        }
      }
    });
  }

  initContextMenu() {
    this.items = [
      {
        label: 'In neuem Tab öffnen',
        icon: 'pi pi-external-link',
        command: () => this.openReportInNewTab(this.selectedReport),
      },
    ];
  }

  ngOnInit() {
    this.initContextMenu();
    this.initializeColumns();
    // Restore state after initialization, but before setting default columns
    const savedState = this.dashboardStateService.getViewStateSnapshot();
    if (savedState) {
      this.restoreViewStateFromStore();
    } else {
      // Only set default columns if no saved state exists
      this.newProductsColumns = [...this.cols];
      this.overdueProductsColumns = [...this.cols];
    }

    const cachedData = this.dashboardStateService.getDashboardDataSnapshot();
    if (cachedData) {
      this.applyDashboardPayload(cachedData);
      this.loading = false;
      this.triggerContentAnimation();
    }
    this.loadDashboardData({ showLoader: !cachedData });
    this.loadMerchandisers();
  }

  ngAfterViewInit() {
    if (!this.loading) {
      this.restoreScrollPosition();
      this.restoreNewReportsTableScrollPosition();
      this.restoreRejectedReportsTableScrollPosition();
    }
  }

  ngOnDestroy() {
    if (this.scrollListener) {
      this.scrollListener();
    }
    if (this.newReportsTableScrollListener) {
      this.newReportsTableScrollListener();
    }
    if (this.rejectedReportsTableScrollListener) {
      this.rejectedReportsTableScrollListener();
    }

    if (this.routerSubscription) {
      this.routerSubscription.unsubscribe();
    }

    // Persist dashboard state when leaving for report pages, but not on logout.
    if (!this.nextUrl?.includes('/logout')) {
      this.persistViewState();
    }
  }

  private shouldPersistState(): boolean {
    if (!this.nextUrl) return false;
    return this.shouldPersistStateForUrl(this.nextUrl);
  }

  private shouldPersistStateForUrl(url: string | null | undefined): boolean {
    if (!url) return false;
    return (url.includes('/reports/') || url.includes('/edit-report/')) && url.includes('/projects/');
  }

  private attachScrollListener(): void {
    if (this.scrollListener) {
      return;
    }

    this.scrollContainerEl = this.resolveScrollContainer();
    const scrollTarget: any = this.scrollContainerEl || 'window';

    this.scrollListener = this.renderer.listen(scrollTarget, 'scroll', () => {
      this.scrollPosition = this.getCurrentScrollPosition();
    });
  }

  private restoreScrollPosition(): void {
    const target = this.scrollPosition || 0;

    let attempts = 0;
    const maxAttempts = 6;
    const tryRestore = () => {
      if (target > 0) {
        const container = this.scrollContainerEl || this.resolveScrollContainer();
        if (container) {
          this.scrollContainerEl = container;
          container.scrollTop = target;
        }
        window.scrollTo(0, target);
      }

      if (!this.scrollListener) {
        this.attachScrollListener();
      }

      if (target > 0 && attempts < maxAttempts) {
        attempts++;
        setTimeout(tryRestore, 50);
      }
    };

    setTimeout(tryRestore, 0);
  }

  private attachNewReportsTableScrollListener(element?: HTMLElement): void {
    // If listener already exists, don't attach again
    if (this.newReportsTableScrollListener) {
      return;
    }

    if (!element) {
      const tableEl = this.newReportsTable?.el?.nativeElement;
      if (!tableEl) return;
      element = tableEl.querySelector('.p-datatable-wrapper') || tableEl.querySelector('.p-datatable-scrollable-body') || tableEl.querySelector('.p-datatable-table-container');
    }

    if (element) {
      this.newReportsTableScrollListener = this.renderer.listen(element, 'scroll', (event) => {
        const target = event.target as HTMLElement;
        this.newReportsTableScrollPosition = target.scrollTop;
      });
    }
  }

  private restoreNewReportsTableScrollPosition(): void {
    let attempts = 0;
    const maxAttempts = 20; // Try for 2 seconds

    const checkAndRestore = () => {
      const tableEl = this.newReportsTable?.el?.nativeElement;

      // Find the scrollable element
      let scrollableBody: HTMLElement | null = null;

      if (tableEl) {
        scrollableBody = tableEl.querySelector('.p-datatable-wrapper') || tableEl.querySelector('.p-datatable-scrollable-body') || tableEl.querySelector('.p-datatable-table-container');

        // Fallback: look for any div with overflow-y auto/scroll if specific classes aren't found
        if (!scrollableBody) {
          const divs = tableEl.querySelectorAll('div');
          for (let i = 0; i < divs.length; i++) {
            const style = window.getComputedStyle(divs[i]);
            if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
              scrollableBody = divs[i];
              break;
            }
          }
        }
      }

      if (scrollableBody) {
        // Restore position
        if (this.newReportsTableScrollPosition > 0) {
          scrollableBody.scrollTop = this.newReportsTableScrollPosition;
        }

        // Attach listener
        this.attachNewReportsTableScrollListener(scrollableBody);
      } else if (attempts < maxAttempts) {
        attempts++;
        setTimeout(checkAndRestore, 100);
      }
    };

    // Start checking
    checkAndRestore();
  }

  private attachRejectedReportsTableScrollListener(element?: HTMLElement): void {
    // If listener already exists, don't attach again
    if (this.rejectedReportsTableScrollListener) {
      return;
    }

    if (!element) {
      const tableEl = this.rejectedReportsTable?.el?.nativeElement;
      if (!tableEl) return;
      element = tableEl.querySelector('.p-datatable-wrapper') || tableEl.querySelector('.p-datatable-scrollable-body') || tableEl.querySelector('.p-datatable-table-container');
    }

    if (element) {
      this.rejectedReportsTableScrollListener = this.renderer.listen(element, 'scroll', (event) => {
        const target = event.target as HTMLElement;
        this.rejectedReportsTableScrollPosition = target.scrollTop;
      });
    }
  }

  private restoreRejectedReportsTableScrollPosition(): void {
    let attempts = 0;
    const maxAttempts = 20; // Try for 2 seconds

    const checkAndRestore = () => {
      const tableEl = this.rejectedReportsTable?.el?.nativeElement;

      // Find the scrollable element
      let scrollableBody: HTMLElement | null = null;

      if (tableEl) {
        scrollableBody = tableEl.querySelector('.p-datatable-wrapper') || tableEl.querySelector('.p-datatable-scrollable-body') || tableEl.querySelector('.p-datatable-table-container');

        // Fallback: look for any div with overflow-y auto/scroll if specific classes aren't found
        if (!scrollableBody) {
          const divs = tableEl.querySelectorAll('div');
          for (let i = 0; i < divs.length; i++) {
            const style = window.getComputedStyle(divs[i]);
            if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
              scrollableBody = divs[i];
              break;
            }
          }
        }
      }

      if (scrollableBody) {
        // Restore position
        if (this.rejectedReportsTableScrollPosition > 0) {
          scrollableBody.scrollTop = this.rejectedReportsTableScrollPosition;
        }

        // Attach listener
        this.attachRejectedReportsTableScrollListener(scrollableBody);
      } else if (attempts < maxAttempts) {
        attempts++;
        setTimeout(checkAndRestore, 100);
      }
    };

    // Start checking
    checkAndRestore();
  }

  loadDashboardData(options: { showLoader?: boolean } = {}): void {
    const { showLoader = true } = options;

    if (showLoader) {
      this.loading = true;
    }
    this.error = false;

    this.dashboardService
      .getDashboardData()
      .pipe(
        catchError((error) => {
          console.error('Error loading dashboard data:', error);
          this.error = true;
          this.toast.error(this.translate.instant('ERRORS.DASHBOARD_LOAD_TOAST'), {
            position: 'bottom-right',
            duration: 4000,
          });
          return of(null);
        }),
      )
      .subscribe({
        next: (data) => {
          if (data) {
            this.applyDashboardPayload(data);
            this.dashboardStateService.setDashboardData(data);
          }
          this.loading = false;
          this.triggerContentAnimation();
          this.restoreScrollPosition();
          this.restoreNewReportsTableScrollPosition();
          this.restoreRejectedReportsTableScrollPosition();
        },
        error: () => {
          this.loading = false;
          this.triggerContentAnimation();
          this.restoreScrollPosition();
          this.restoreNewReportsTableScrollPosition();
          this.restoreRejectedReportsTableScrollPosition();
        },
      });
  }

  private applyDashboardPayload(data: DashboardData): void {
    this.newReports = data.newReports || [];
    this.rejectedReports = data.rejectedReports || [];
    this.clientCompaniesAssignedAkzente = data.clientCompaniesAssignedAkzente || [];
    this.applyDashboardClientCompanies((data.dashboardClientCompanies || []) as ClientCompanyWithCounts[], data.totalClientCompaniesCount);
  }

  private applyDashboardClientCompanies(companies: ClientCompanyWithCounts[] = [], totalCount?: number): void {
    this.last4ClientCompanies = companies;
    this.totalClientCompaniesCount = totalCount ?? companies.length;
    const myIds = companies.filter((client) => client?.isMyClient).map((client) => client.id);
    this.myClientIds = new Set(myIds);
  }

  loadLast4ClientCompanies(): void {
    // First load my client IDs
    this.clientCompanyService.getMyClientCompanies(1, 0).subscribe({
      next: (response) => {
        this.myClientIds = new Set(response.data.map((company) => company.id));
        // Then load all clients and sort
        this.loadAndSortClients();
      },
      error: (error) => {
        console.error('Error loading my client IDs:', error);
        // Continue even if my client IDs fail to load
        this.loadAndSortClients();
      },
    });
  }

  loadAndSortClients(): void {
    this.clientCompanyService.getClientCompanies(1, 0).subscribe({
      next: (response) => {
        const allClients = response.data || [];
        this.totalClientCompaniesCount = allClients.length;

        // Sort: "mein kunden" first, then by createdAt descending
        const sortedClients = [...allClients].sort((a, b) => {
          const aIsMyClient = this.myClientIds.has(a.id);
          const bIsMyClient = this.myClientIds.has(b.id);

          // "Mein kunden" come first
          if (aIsMyClient && !bIsMyClient) return -1;
          if (!aIsMyClient && bIsMyClient) return 1;

          // If both are "mein kunden" or both are not, sort by createdAt
          const dateA = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt).getTime();
          const dateB = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt).getTime();
          return dateB - dateA; // Descending order (newest first)
        });

        // Take the first 4
        const last4 = sortedClients.slice(0, 4);

        // Calculate report counts for each client
        const mappedClients = last4.map((client) => {
          const clientId = client.id;
          // Use status IDs to avoid mislabeling (e.g., 'Anfrage' not treated as 'new')
          const newReports = this.newReports.filter((report) => report.clientCompany?.id === clientId && categorizeReportForAkzente(Number(report.status?.id)) === 'new');
          const ongoingReports = this.newReports.filter((report) => report.clientCompany?.id === clientId && categorizeReportForAkzente(Number(report.status?.id)) === 'ongoing');
          const completedReports = this.newReports.filter((report) => report.clientCompany?.id === clientId && categorizeReportForAkzente(Number(report.status?.id)) === 'completed');

          // Map ClientCompany to ClientCompanyWithCounts format
          return {
            id: client.id,
            name: client.name,
            logo: client.logo
              ? {
                  id: client.logo.id || '',
                  path: client.logo.path,
                }
              : undefined,
            isFavorite: client.isFavorite || false,
            createdAt: client.createdAt instanceof Date ? client.createdAt.toISOString() : client.createdAt,
            updatedAt: client.updatedAt instanceof Date ? client.updatedAt.toISOString() : client.updatedAt,
            reportCounts: {
              newReports: newReports.length,
              ongoingReports: ongoingReports.length,
              completedReports: completedReports.length,
            },
          } as ClientCompanyWithCounts;
        });

        this.applyDashboardClientCompanies(mappedClients, this.totalClientCompaniesCount);
      },
      error: (error) => {
        console.error('Error loading client companies:', error);
      },
    });
  }

  isMyClient(clientId: number): boolean {
    return this.myClientIds.has(clientId);
  }

  initializeColumns(): void {
    this.cols = [
      { field: 'kunde', header: 'Kunde' },
      { field: 'store', header: 'Store' },
      { field: 'ort', header: 'Ort' },
      { field: 'besuchsdatum', header: 'Besuchsdatum' },
      { field: 'vm', header: 'VM' },
    ];

    // Initialize all columns as visible
    this.initializeVisibleColumns();

    // Initialize ordered columns (only if not already set)
    if (!this.newProductsOrderedColumns || this.newProductsOrderedColumns.length === 0) {
      this.newProductsOrderedColumns = [...this.cols];
    }
    if (!this.overdueProductsOrderedColumns || this.overdueProductsOrderedColumns.length === 0) {
      this.overdueProductsOrderedColumns = [...this.cols];
    }

    // Don't set default columns here - let restoreViewStateFromStore or ngOnInit handle it
    this.selectedColumns = this.cols;
  }

  private restoreViewStateFromStore(): void {
    const savedState = this.dashboardStateService.getViewStateSnapshot();
    if (!savedState) {
      return;
    }

    if (savedState.newReportsColumnFilters) {
      this.newReportsColumnFilters = this.cloneColumnFilters(savedState.newReportsColumnFilters);
    }

    if (savedState.rejectedReportsColumnFilters) {
      this.rejectedReportsColumnFilters = this.cloneColumnFilters(savedState.rejectedReportsColumnFilters);
    }

    this.sortField = savedState.sortField ?? this.sortField;
    this.sortOrder = savedState.sortOrder ?? this.sortOrder;
    this.overdueSortField = savedState.overdueSortField ?? this.overdueSortField;
    this.overdueSortOrder = savedState.overdueSortOrder ?? this.overdueSortOrder;

    if (savedState.newProductsVisibleColumns) {
      // Apply saved visible columns - ensure all columns are explicitly set
      this.cols.forEach((col) => {
        // If the column exists in saved state, use its value, otherwise default to false
        this.newProductsVisibleColumns[col.field] = savedState.newProductsVisibleColumns[col.field] === true;
      });
    }

    if (savedState.overdueProductsVisibleColumns) {
      // Apply saved visible columns - ensure all columns are explicitly set
      this.cols.forEach((col) => {
        // If the column exists in saved state, use its value, otherwise default to false
        this.overdueProductsVisibleColumns[col.field] = savedState.overdueProductsVisibleColumns[col.field] === true;
      });
    }

    if (Array.isArray(savedState.newProductsOrderedColumns) && savedState.newProductsOrderedColumns.length) {
      this.newProductsOrderedColumns = this.hydrateOrderedColumns(savedState.newProductsOrderedColumns);
    }

    if (Array.isArray(savedState.overdueProductsOrderedColumns) && savedState.overdueProductsOrderedColumns.length) {
      this.overdueProductsOrderedColumns = this.hydrateOrderedColumns(savedState.overdueProductsOrderedColumns);
    }

    this.scrollPosition = savedState.scrollPosition || 0;
    this.newReportsTableScrollPosition = savedState.newReportsTableScrollPosition || 0;
    this.rejectedReportsTableScrollPosition = savedState.rejectedReportsTableScrollPosition || 0;

    this.syncVisibleColumnSelections();
  }

  private syncVisibleColumnSelections(): void {
    // Only include columns that are explicitly set to true
    this.newProductsColumns = this.newProductsOrderedColumns.filter((col) => this.newProductsVisibleColumns[col.field] === true);
    if (!this.newProductsColumns.length) {
      // If no columns are selected, select all by default
      this.newProductsColumns = [...this.newProductsOrderedColumns];
      this.newProductsColumns.forEach((col) => (this.newProductsVisibleColumns[col.field] = true));
    }

    // Only include columns that are explicitly set to true
    this.overdueProductsColumns = this.overdueProductsOrderedColumns.filter((col) => this.overdueProductsVisibleColumns[col.field] === true);
    if (!this.overdueProductsColumns.length) {
      // If no columns are selected, select all by default
      this.overdueProductsColumns = [...this.overdueProductsOrderedColumns];
      this.overdueProductsColumns.forEach((col) => (this.overdueProductsVisibleColumns[col.field] = true));
    }
  }

  private hydrateOrderedColumns(storedColumns: StoredColumn[]): Column[] {
    const map = this.cols.reduce<Record<string, Column>>((acc, column) => {
      acc[column.field] = column;
      return acc;
    }, {});

    const ordered: Column[] = [];
    storedColumns.forEach((stored) => {
      const match = map[stored.field];
      if (match) {
        ordered.push(match);
      }
    });

    this.cols.forEach((column) => {
      if (!ordered.includes(column)) {
        ordered.push(column);
      }
    });

    return ordered;
  }

  private persistViewState(): void {
    this.scrollPosition = this.getCurrentScrollPosition();
    this.newReportsTableScrollPosition = this.getCurrentNewReportsTableScrollPosition();
    this.rejectedReportsTableScrollPosition = this.getCurrentRejectedReportsTableScrollPosition();

    // Ensure all columns are in the visible columns object (explicitly set to true or false)
    const completeNewProductsVisibleColumns: { [key: string]: boolean } = {};
    this.cols.forEach((col) => {
      completeNewProductsVisibleColumns[col.field] = this.newProductsVisibleColumns[col.field] === true;
    });

    const completeOverdueProductsVisibleColumns: { [key: string]: boolean } = {};
    this.cols.forEach((col) => {
      completeOverdueProductsVisibleColumns[col.field] = this.overdueProductsVisibleColumns[col.field] === true;
    });

    const viewState: DashboardViewState = {
      newReportsColumnFilters: this.cloneColumnFilters(this.newReportsColumnFilters),
      rejectedReportsColumnFilters: this.cloneColumnFilters(this.rejectedReportsColumnFilters),
      sortField: this.sortField,
      sortOrder: this.sortOrder,
      overdueSortField: this.overdueSortField,
      overdueSortOrder: this.overdueSortOrder,
      newProductsVisibleColumns: completeNewProductsVisibleColumns,
      overdueProductsVisibleColumns: completeOverdueProductsVisibleColumns,
      newProductsOrderedColumns: this.newProductsOrderedColumns.map((col) => ({ field: col.field, header: col.header })),
      overdueProductsOrderedColumns: this.overdueProductsOrderedColumns.map((col) => ({ field: col.field, header: col.header })),
      scrollPosition: this.scrollPosition,
      newReportsTableScrollPosition: this.newReportsTableScrollPosition,
      rejectedReportsTableScrollPosition: this.rejectedReportsTableScrollPosition,
    };

    this.dashboardStateService.saveViewState(viewState);
  }

  private getCurrentNewReportsTableScrollPosition(): number {
    const tableEl = this.newReportsTable?.el?.nativeElement;
    if (!tableEl) {
      return this.newReportsTableScrollPosition || 0;
    }
    const scrollableBody = tableEl.querySelector('.p-datatable-wrapper') || tableEl.querySelector('.p-datatable-scrollable-body') || tableEl.querySelector('.p-datatable-table-container');
    if (!scrollableBody) {
      return this.newReportsTableScrollPosition || 0;
    }
    return (scrollableBody as HTMLElement).scrollTop || 0;
  }

  private getCurrentRejectedReportsTableScrollPosition(): number {
    const tableEl = this.rejectedReportsTable?.el?.nativeElement;
    if (!tableEl) {
      return this.rejectedReportsTableScrollPosition || 0;
    }
    const scrollableBody = tableEl.querySelector('.p-datatable-wrapper') || tableEl.querySelector('.p-datatable-scrollable-body') || tableEl.querySelector('.p-datatable-table-container');
    if (!scrollableBody) {
      return this.rejectedReportsTableScrollPosition || 0;
    }
    return (scrollableBody as HTMLElement).scrollTop || 0;
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

  private resolveScrollContainer(): HTMLElement | null {
    const root = this.dashboardScrollRoot?.nativeElement;
    if (!root || typeof window === 'undefined') {
      return document.querySelector('main > div.overflow-y-auto') as HTMLElement | null;
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

    return (document.querySelector('main > div.overflow-y-auto') as HTMLElement | null) || null;
  }

  private cloneColumnFilters(filters?: Record<string, string[]>): ColumnFilterState {
    const clone = createDefaultColumnFilters();
    if (!filters) {
      return clone;
    }

    Object.keys(filters).forEach((key) => {
      clone[key] = [...(filters[key] || [])];
    });

    return clone;
  }

  private triggerContentAnimation(): void {
    this.contentAnimationReady = false;

    const activate = () => {
      this.contentAnimationReady = true;
      setTimeout(() => {
        this.loadingAnimationDone = true;
      }, 550);
    };

    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(() => window.requestAnimationFrame(activate));
    } else {
      setTimeout(activate, 0);
    }
  }

  getClientCardAnimationDelay(index: number): string {
    const baseDelay = 0.3;
    const increment = 0.06;
    return `${baseDelay + index * increment}s`;
  }

  addSampleDataForColumns() {
    // Add missing fields to match column definitions
    this.products.forEach((product, index) => {
      product['kunde'] = 'Kunde ' + product.id.substring(2);
      product['store'] = 'Store ' + product.id.substring(3);
      product['ort'] = ['Berlin', 'München', 'Hamburg', 'Köln', 'Frankfurt'][Math.floor(Math.random() * 5)];
      product['besuchsdatum'] = `${Math.floor(Math.random() * 28) + 1}.${Math.floor(Math.random() * 12) + 1}.2025`;
      product['vm'] = ['Schmidt', 'Müller', 'Fischer', 'Weber', 'Meyer'][Math.floor(Math.random() * 5)];
      product.isFavorite = index % 3 === 0; // Add random favorite status for demo
    });
  }

  // Helper methods for dashboard data
  getReportKunde(report: DashboardReport): string {
    return report.clientCompany?.name || '-';
  }

  getReportStore(report: DashboardReport): string {
    return report.branch?.name || '-';
  }

  getReportOrt(report: DashboardReport): string {
    const street = report.street || '';
    const zip = report.zipCode || '';
    return [street, zip].filter(Boolean).join(', ') || '-';
  }

  getReportBesuchsdatum(report: DashboardReport): string {
    return report.visitDate || '-';
  }

  getReportVM(report: DashboardReport): string {
    if (report.merchandiser?.user) {
      const user = report.merchandiser.user;
      return [user.firstName, user.lastName].filter(Boolean).join(' ') || '-';
    }
    return '-';
  }

  getReportVMEmail(report: DashboardReport): string {
    return report.merchandiser?.user?.email || '-';
  }

  getReportStatus(report: DashboardReport): string {
    return report.status?.name || '-';
  }

  loadMerchandisers() {
    this.merchandiserService.getMerchandisers(1, 1000).subscribe({
      next: (response) => {
        this.merchandisers = response.data;
      },
      error: (error) => {
        console.error('Error loading merchandisers:', error);
      },
    });
  }

  startEditingMerchandiser(event: Event, report: DashboardReport) {
    event.stopPropagation();
    if (report?.id !== undefined && report?.id !== null) {
      this.originalMerchandiserByReportId.set(report.id, report.merchandiser ?? null);
    }
    this.editingReportId = report.id;
  }

  cancelInlineEdit(event: Event, report?: DashboardReport) {
    event.stopPropagation();
    this.restoreOriginalMerchandiser(report);
    this.editingReportId = null;
  }

  onMerchandiserChange(event: any, report: DashboardReport) {
    const merchandiser = event.value;
    if (report && merchandiser) {
      this.pendingMerchandiserChange = { report, merchandiser };
      this.showMerchandiserConfirmation = true;
    }
  }

  confirmMerchandiserUpdate() {
    if (!this.pendingMerchandiserChange) return;

    const { report, merchandiser } = this.pendingMerchandiserChange;
    this.merchandiserUpdateLoading = true;

    this.reportService.updateReportWithFiles(report.id, { merchandiserId: merchandiser.id }, []).subscribe({
      next: (response) => {
        if (report?.id !== undefined && report?.id !== null) {
          this.originalMerchandiserByReportId.delete(report.id);
        }
        if ((response as any)?._emailSendFailed) {
          this.toast.warning('Merchandiser updated, but assignment email could not be sent. Please check email settings.', {
            duration: 6000,
          });
        } else {
          this.toast.success('Merchandiser updated successfully');
        }
        this.merchandiserUpdateLoading = false;
        this.showMerchandiserConfirmation = false;
        this.pendingMerchandiserChange = null;
        this.editingReportId = null;
        this.loadDashboardData({ showLoader: false });
      },
      error: (err) => {
        this.toast.error('Failed to update merchandiser');
        console.error(err);
        this.merchandiserUpdateLoading = false;
      },
    });
  }

  cancelMerchandiserUpdate() {
    this.restoreOriginalMerchandiser(this.pendingMerchandiserChange?.report || undefined);
    this.showMerchandiserConfirmation = false;
    this.pendingMerchandiserChange = null;
    // Optional: Reset editing state or reload specific row if needed to revert UI
    this.editingReportId = null;
  }

  private restoreOriginalMerchandiser(report?: DashboardReport): void {
    if (!report || report.id === undefined || report.id === null) {
      return;
    }
    if (!this.originalMerchandiserByReportId.has(report.id)) {
      return;
    }

    report.merchandiser = this.originalMerchandiserByReportId.get(report.id) ?? undefined;
    this.originalMerchandiserByReportId.delete(report.id);
  }

  getMerchandiserDisplayName(merchandiser: Merchandiser): string {
    if (merchandiser && merchandiser.user) {
      return [merchandiser.user.firstName, merchandiser.user.lastName].filter(Boolean).join(' ');
    }
    return '-';
  }

  // Handle favorite toggle for reports
  onFavoriteChanged(newStatus: boolean, report: DashboardReport): void {
    // Optimistically update the UI
    const previousStatus = report.isFavorite;
    report.isFavorite = newStatus;

    // Call backend to toggle favorite status
    this.reportService
      .toggleFavoriteStatus(report.id)
      .pipe(
        catchError((error) => {
          console.error('❌ Error toggling report favorite status:', error);

          // Revert the optimistic update on error
          report.isFavorite = previousStatus;

          this.toast.error('Fehler beim Aktualisieren der Favoriten', {
            position: 'bottom-right',
            duration: 4000,
          });

          return of(null);
        }),
      )
      .subscribe({
        next: (result) => {
          if (result) {
            // Update the status based on server response
            report.isFavorite = result.isFavorite;

            if (result.isFavorite) {
              this.toast.success('Einsatz zu Favoriten hinzugefügt', {
                position: 'bottom-right',
                duration: 2000,
              });
            } else {
              this.toast.info('Einsatz aus Favoriten entfernt', {
                position: 'bottom-right',
                duration: 2000,
              });
            }
          }
        },
      });
  }

  // Handle favorite toggle for client companies
  onCardFavoriteChanged(newStatus: boolean, client: ClientCompanyWithCounts): void {
    // Optimistically update the UI
    const previousStatus = client.isFavorite;
    client.isFavorite = newStatus;

    // Call backend to toggle favorite status
    this.clientCompanyService
      .toggleFavoriteStatus(client.id)
      .pipe(
        catchError((error) => {
          console.error('❌ Error toggling client favorite status:', error);

          // Revert the optimistic update on error
          client.isFavorite = previousStatus;

          this.toast.error('Fehler beim Aktualisieren der Favoriten', {
            position: 'bottom-right',
            duration: 4000,
          });

          return of(null);
        }),
      )
      .subscribe({
        next: (result) => {
          if (result) {
            // Update the status based on server response
            client.isFavorite = result.isFavorite;

            this.toast.success(result.message, {
              position: 'bottom-right',
              duration: 2000,
            });
          }
        },
      });
  }

  navigateToClient(event: Event, clientId: number | string): void {
    const target = event.target as HTMLElement;
    // Prevent navigation if clicking on interactive elements
    if (target.closest('a') || target.closest('button') || target.closest('app-favorite-toggle')) {
      return;
    }
    this.router.navigate(['/clients', clientId]);
  }

  navigateToReportDetails(report: DashboardReport): void {
    if (!report?.clientCompany?.id || !report?.project?.id || !report?.id) return;
    this.router.navigate(['/clients', report.clientCompany.id, 'projects', report.project.id, 'reports', report.id], {
      queryParams: { referrer: 'dashboard', reportStatus: report.status?.name || '' },
    });
  }

  // Add these methods for handling sort
  onSort(field: string): void {
    if (this.sortField === field) {
      this.sortOrder = this.sortOrder * -1;
    } else {
      this.sortField = field;
      this.sortOrder = 1;
    }

    this.persistViewState();
  }

  onOverdueSort(field: string): void {
    if (this.overdueSortField === field) {
      this.overdueSortOrder = this.overdueSortOrder * -1;
    } else {
      this.overdueSortField = field;
      this.overdueSortOrder = 1;
    }

    this.persistViewState();
  }

  // Initialize visible columns
  initializeVisibleColumns() {
    // Set all columns to visible by default
    this.cols.forEach((col) => {
      this.newProductsVisibleColumns[col.field] = true;
      this.overdueProductsVisibleColumns[col.field] = true;
    });
  }

  // Get visible columns for new products
  getNewProductsVisibleColumns(): Column[] {
    // Return ordered columns that are explicitly set to true
    return this.newProductsOrderedColumns.filter((col) => this.newProductsVisibleColumns[col.field] === true);
  }

  // Get visible columns for overdue products
  getOverdueProductsVisibleColumns(): Column[] {
    // Return ordered columns that are explicitly set to true
    return this.overdueProductsOrderedColumns.filter((col) => this.overdueProductsVisibleColumns[col.field] === true);
  }

  // Update visible columns when selection changes in multiselect
  onNewProductsColumnsChange(selectedColumns: Column[]) {
    // Reset all to false
    Object.keys(this.newProductsVisibleColumns).forEach((key) => {
      this.newProductsVisibleColumns[key] = false;
    });

    // Set selected columns to true
    selectedColumns.forEach((col) => {
      this.newProductsVisibleColumns[col.field] = true;
    });

    this.persistViewState();
  }

  // Update visible columns when selection changes in multiselect
  onOverdueProductsColumnsChange(selectedColumns: Column[]) {
    // Reset all to false
    Object.keys(this.overdueProductsVisibleColumns).forEach((key) => {
      this.overdueProductsVisibleColumns[key] = false;
    });

    // Set selected columns to true
    selectedColumns.forEach((col) => {
      this.overdueProductsVisibleColumns[col.field] = true;
    });

    this.persistViewState();
  }

  clearNewProductsColumns(event?: Event): void {
    event?.stopPropagation();
    this.newProductsColumns = [...this.cols];
    this.onNewProductsColumnsChange(this.newProductsColumns);
  }

  clearOverdueProductsColumns(event?: Event): void {
    event?.stopPropagation();
    this.overdueProductsColumns = [...this.cols];
    this.onOverdueProductsColumnsChange(this.overdueProductsColumns);
  }

  isAllNewProductsColumnsSelected(): boolean {
    return this.newProductsColumns.length === this.cols.length;
  }

  isAllOverdueProductsColumnsSelected(): boolean {
    return this.overdueProductsColumns.length === this.cols.length;
  }

  // Add event handlers for column reordering
  onNewProductsColReorder(event: any) {
    // The event structure from PrimeNG contains dragIndex and dropIndex
    if (event && typeof event.dragIndex === 'number' && typeof event.dropIndex === 'number') {
      // Get the column that was moved
      const movedColumn = this.newProductsOrderedColumns[event.dragIndex];

      // Create a new array without the moved column
      const newOrderedColumns = [...this.newProductsOrderedColumns];
      newOrderedColumns.splice(event.dragIndex, 1);

      // Insert the moved column at the drop index
      newOrderedColumns.splice(event.dropIndex, 0, movedColumn);

      // Update the ordered columns with the new order
      this.newProductsOrderedColumns = newOrderedColumns;
      this.persistViewState();
    }
  }

  onOverdueProductsColReorder(event: any) {
    if (event && typeof event.dragIndex === 'number' && typeof event.dropIndex === 'number') {
      // Get the column that was moved
      const movedColumn = this.overdueProductsOrderedColumns[event.dragIndex];

      // Create a new array without the moved column
      const newOrderedColumns = [...this.overdueProductsOrderedColumns];
      newOrderedColumns.splice(event.dragIndex, 1);

      // Insert the moved column at the drop index
      newOrderedColumns.splice(event.dropIndex, 0, movedColumn);

      // Update the ordered columns with the new order
      this.overdueProductsOrderedColumns = newOrderedColumns;
      this.persistViewState();
    }
  }

  openReportInNewTab(report: DashboardReport): void {
    if (!report) return;
    const urlTree = this.router.createUrlTree(['/clients', report.clientCompany?.id, 'projects', report.project?.id, 'reports', report.id], {
      queryParams: { referrer: 'dashboard', reportStatus: report.status?.name || '' },
    });
    const url = window.location.origin + urlTree.toString();
    window.open(url, '_blank');
  }

  openReportEditInNewTab(report: DashboardReport): void {
    const urlTree = this.router.createUrlTree(['/clients', report.clientCompany?.id, 'projects', report.project?.id, 'edit-report', report.id], { queryParams: { referrer: 'dashboard' } });
    const url = window.location.origin + urlTree.toString();
    window.open(url, '_blank');
  }

  openClientInNewTab(clientId: number, queryParams?: Record<string, any>): void {
    const urlTree = this.router.createUrlTree(['/clients', clientId], { queryParams: queryParams || {} });
    const url = window.location.origin + urlTree.toString();
    window.open(url, '_blank');
  }

  onReportContextMenu(event: MouseEvent, report: DashboardReport): boolean {
    event.preventDefault();
    event.stopPropagation();
    this.openReportInNewTab(report);
    return false;
  }

  onReportEditContextMenu(event: MouseEvent, report: DashboardReport): boolean {
    event.preventDefault();
    event.stopPropagation();
    this.openReportEditInNewTab(report);
    return false;
  }

  onClientContextMenu(event: MouseEvent, clientId: number, queryParams?: Record<string, any>): boolean {
    event.preventDefault();
    event.stopPropagation();
    this.openClientInNewTab(clientId, queryParams);
    return false;
  }

  onClientListContextMenu(event: MouseEvent): boolean {
    event.preventDefault();
    const urlTree = this.router.createUrlTree(['/clients', 'list']);
    const url = window.location.origin + urlTree.toString();
    window.open(url, '_blank');
    return false;
  }

  // Get filtered new reports based on column filters
  getFilteredNewReports(excludeField?: string, skipSort: boolean = false): DashboardReport[] {
    if (!this.newReports) {
      return [];
    }

    // Only treat reports with NEW status as "Neue Reports"
    const baseNewReports = this.newReports.filter((report) => categorizeReportForAkzente(Number(report.status?.id)) === 'new');

    const filtered = baseNewReports.filter((report) => {
      const statusFilter = this.newReportsColumnFilters['status'];
      if (excludeField !== 'status' && statusFilter && statusFilter.length > 0 && !statusFilter.includes(report.status?.name || '')) {
        return false;
      }
      const kundeFilter = this.newReportsColumnFilters['kunde'];
      if (excludeField !== 'kunde' && kundeFilter && kundeFilter.length > 0 && !kundeFilter.includes(this.getReportKunde(report))) {
        return false;
      }
      const storeFilter = this.newReportsColumnFilters['store'];
      if (excludeField !== 'store' && storeFilter && storeFilter.length > 0 && !storeFilter.includes(this.getReportStore(report))) {
        return false;
      }
      const ortFilter = this.newReportsColumnFilters['ort'];
      if (excludeField !== 'ort' && ortFilter && ortFilter.length > 0 && !ortFilter.includes(this.getReportOrt(report))) {
        return false;
      }
      const besuchsdatumFilter = this.newReportsColumnFilters['besuchsdatum'];
      if (excludeField !== 'besuchsdatum' && besuchsdatumFilter && besuchsdatumFilter.length > 0) {
        const reportDate = this.getReportBesuchsdatum(report);
        const formattedDate = reportDate === '-' ? '-' : this.euDatePipe.transform(reportDate);
        if (!besuchsdatumFilter.includes(formattedDate)) {
          return false;
        }
      }
      const vmFilter = this.newReportsColumnFilters['vm'];
      if (excludeField !== 'vm' && vmFilter && vmFilter.length > 0 && !vmFilter.includes(this.getReportVM(report))) {
        return false;
      }
      return true;
    });

    if (skipSort) {
      return filtered;
    }

    return this.applyReportSorting(filtered, this.sortField, this.sortOrder);
  }

  // Get filtered rejected reports based on column filters
  getFilteredRejectedReports(excludeField?: string, skipSort: boolean = false): DashboardReport[] {
    // Combine rejectedReports and newReports, then filter for DUE status only
    const allReports = [...(this.rejectedReports || []), ...(this.newReports || [])];

    // Reports waiting for Akzente review (submitted by merchandiser)
    const dueReports = allReports.filter((report) => Number(report.status?.id) === ReportStatusEnum.SUBMITTED);

    // Remove duplicates based on report id
    const uniqueDueReports = Array.from(new Map(dueReports.map((report) => [report.id, report])).values());

    const filtered = uniqueDueReports.filter((report) => {
      const statusFilter = this.rejectedReportsColumnFilters['status'];
      if (excludeField !== 'status' && statusFilter && statusFilter.length > 0 && !statusFilter.includes(report.status?.name || '')) {
        return false;
      }
      const kundeFilter = this.rejectedReportsColumnFilters['kunde'];
      if (excludeField !== 'kunde' && kundeFilter && kundeFilter.length > 0 && !kundeFilter.includes(this.getReportKunde(report))) {
        return false;
      }
      const storeFilter = this.rejectedReportsColumnFilters['store'];
      if (excludeField !== 'store' && storeFilter && storeFilter.length > 0 && !storeFilter.includes(this.getReportStore(report))) {
        return false;
      }
      const ortFilter = this.rejectedReportsColumnFilters['ort'];
      if (excludeField !== 'ort' && ortFilter && ortFilter.length > 0 && !ortFilter.includes(this.getReportOrt(report))) {
        return false;
      }
      const besuchsdatumFilter = this.rejectedReportsColumnFilters['besuchsdatum'];
      if (excludeField !== 'besuchsdatum' && besuchsdatumFilter && besuchsdatumFilter.length > 0) {
        const reportDate = this.getReportBesuchsdatum(report);
        const formattedDate = reportDate === '-' ? '-' : this.euDatePipe.transform(reportDate);
        if (!besuchsdatumFilter.includes(formattedDate)) {
          return false;
        }
      }
      const vmFilter = this.rejectedReportsColumnFilters['vm'];
      if (excludeField !== 'vm' && vmFilter && vmFilter.length > 0 && !vmFilter.includes(this.getReportVM(report))) {
        return false;
      }
      return true;
    });

    if (skipSort) {
      return filtered;
    }

    return this.applyReportSorting(filtered, this.overdueSortField, this.overdueSortOrder);
  }

  /** Raw filter value for a column (must match `getFilteredNewReports` / `getFilteredRejectedReports` comparisons). */
  private getReportColumnFilterValue(report: DashboardReport, field: string): string {
    switch (field) {
      case 'status':
        return report.status?.name || '';
      case 'kunde':
        return this.getReportKunde(report);
      case 'store':
        return this.getReportStore(report);
      case 'ort':
        return this.getReportOrt(report);
      case 'besuchsdatum': {
        const reportDate = this.getReportBesuchsdatum(report);
        return reportDate === '-' ? '-' : this.euDatePipe.transform(reportDate);
      }
      case 'vm':
        return this.getReportVM(report);
      default:
        return '';
    }
  }

  private isColumnFilterValueEmpty(field: string, value: string): boolean {
    if (field === 'status') {
      return value === '';
    }
    return value === '' || value === '-';
  }

  private columnFilterOptionLabel(field: string, value: string): string {
    return this.isColumnFilterValueEmpty(field, value) ? COLUMN_FILTER_EMPTY_LABEL : value;
  }

  private sortColumnFilterEntries(field: string, entries: [string, string][]): [string, string][] {
    return [...entries].sort((a, b) => {
      const aEmpty = this.isColumnFilterValueEmpty(field, a[0]);
      const bEmpty = this.isColumnFilterValueEmpty(field, b[0]);
      if (aEmpty !== bEmpty) {
        return aEmpty ? 1 : -1;
      }
      return a[0].localeCompare(b[0], 'de', { sensitivity: 'base', numeric: true });
    });
  }

  /**
   * Keep currently selected values visible in the filter list even when they are
   * temporarily absent from the option source due to other active filters.
   */
  private appendSelectedFilterValues(valuesMap: Map<string, string>, selectedValues: string[] | undefined): void {
    (selectedValues || []).forEach((selected) => {
      if (!valuesMap.has(selected)) {
        valuesMap.set(selected, '');
      }
    });
  }

  // Get unique values for filter dropdowns - New Reports
  getNewReportsFilterOptions(field: string): { label: string; value: string; color?: string }[] {
    const valuesMap = new Map<string, string>();
    const filteredReports = this.getFilteredNewReports(field);
    filteredReports.forEach((report) => {
      const value = this.getReportColumnFilterValue(report, field);
      if (field === 'status' && value && (report.status?.akzenteColor || report.status?.color)) {
        valuesMap.set(value, report.status.akzenteColor || report.status.color);
      } else if (!valuesMap.has(value)) {
        valuesMap.set(value, '');
      }
    });
    this.appendSelectedFilterValues(valuesMap, this.newReportsColumnFilters[field]);
    return this.sortColumnFilterEntries(field, Array.from(valuesMap.entries())).map(([val, color]) => ({
      label: this.columnFilterOptionLabel(field, val),
      value: val,
      color: color || undefined,
    }));
  }

  // Get unique values for filter dropdowns - Rejected Reports
  getRejectedReportsFilterOptions(field: string): { label: string; value: string; color?: string }[] {
    const valuesMap = new Map<string, string>();
    const filteredReports = this.getFilteredRejectedReports(field);
    filteredReports.forEach((report) => {
      const value = this.getReportColumnFilterValue(report, field);
      if (field === 'status' && value && (report.status?.akzenteColor || report.status?.color)) {
        valuesMap.set(value, report.status.akzenteColor || report.status.color);
      } else if (!valuesMap.has(value)) {
        valuesMap.set(value, '');
      }
    });
    this.appendSelectedFilterValues(valuesMap, this.rejectedReportsColumnFilters[field]);
    return this.sortColumnFilterEntries(field, Array.from(valuesMap.entries())).map(([val, color]) => ({
      label: this.columnFilterOptionLabel(field, val),
      value: val,
      color: color || undefined,
    }));
  }

  // Reset column filters for new reports
  resetNewReportsColumnFilters(): void {
    this.newReportsColumnFilters = createDefaultColumnFilters();
  }

  clearNewReportsFilters(event?: Event): void {
    event?.stopPropagation();
    this.resetNewReportsColumnFilters();
    this.closeAllFilterPopovers();
    this.persistViewState();
  }

  hasActiveNewReportsFilters(): boolean {
    return Object.values(this.newReportsColumnFilters).some((values) => Array.isArray(values) && values.length > 0);
  }

  // Reset column filters for rejected reports
  resetRejectedReportsColumnFilters(): void {
    this.rejectedReportsColumnFilters = createDefaultColumnFilters();
  }

  clearRejectedReportsFilters(event?: Event): void {
    event?.stopPropagation();
    this.resetRejectedReportsColumnFilters();
    this.closeAllFilterPopovers();
    this.persistViewState();
  }

  onNewReportsFiltersChanged(): void {
    this.persistViewState();
  }

  onRejectedReportsFiltersChanged(): void {
    this.persistViewState();
  }

  clearCurrentNewReportsColumnFilter(): void {
    if (this.currentNewReportsFilterField) {
      this.newReportsColumnFilters[this.currentNewReportsFilterField] = [];
      this.persistViewState();
    }
  }

  clearCurrentRejectedReportsColumnFilter(): void {
    if (this.currentRejectedReportsFilterField) {
      this.rejectedReportsColumnFilters[this.currentRejectedReportsFilterField] = [];
      this.persistViewState();
    }
  }

  hasActiveRejectedReportsFilters(): boolean {
    return Object.values(this.rejectedReportsColumnFilters).some((values) => Array.isArray(values) && values.length > 0);
  }

  hasActiveDashboardFilters(): boolean {
    return this.hasActiveNewReportsFilters() || this.hasActiveRejectedReportsFilters() || !!this.sortField || !!this.overdueSortField;
  }

  clearDashboardFilters(): void {
    this.resetNewReportsColumnFilters();
    this.resetRejectedReportsColumnFilters();
    this.sortField = '';
    this.sortOrder = 1;
    this.overdueSortField = '';
    this.overdueSortOrder = 1;
    this.closeAllFilterPopovers();
    this.persistViewState();
  }

  // Get filter value for a column (for checking if filter is active)
  getNewReportsColumnFilterValue(field: string): string[] {
    return this.newReportsColumnFilters[field] || [];
  }

  getRejectedReportsColumnFilterValue(field: string): string[] {
    return this.rejectedReportsColumnFilters[field] || [];
  }

  /**
   * Check if a column can be filtered (has options available)
   */
  private openFilterPopover(popover: any, targetElement: HTMLElement): void {
    if (!popover || !targetElement) {
      return;
    }

    const positioningEvent = {
      currentTarget: targetElement,
      target: targetElement,
      preventDefault: () => {},
      stopPropagation: () => {},
    } as any;

    popover.hide();

    setTimeout(() => {
      if (popover) {
        popover.show(positioningEvent);
      }
    }, 100);
  }

  /**
   * Close all filter popovers
   */
  closeAllFilterPopovers(): void {
    this.hideStatusFilterPopovers();

    if (this.newReportsColumnFilterPopover) {
      this.newReportsColumnFilterPopover.hide();
    }
    if (this.rejectedReportsColumnFilterPopover) {
      this.rejectedReportsColumnFilterPopover.hide();
    }

    this.closeActiveColumnFilterPopover();
    this.closeColumnFilterModal();

    this.hideSettingsPopovers();
  }

  private hideStatusFilterPopovers(): void {
    if (this.newReportsStatusFilterPopover) {
      this.newReportsStatusFilterPopover.hide();
    }
    if (this.rejectedReportsStatusFilterPopover) {
      this.rejectedReportsStatusFilterPopover.hide();
    }
  }

  private closeActiveColumnFilterPopover(except?: any): void {
    // Explicitly check all column popovers to ensure they are closed if not the exception
    if (this.newReportsColumnFilterPopover && this.newReportsColumnFilterPopover !== except) {
      this.newReportsColumnFilterPopover.hide();
    }
    if (this.rejectedReportsColumnFilterPopover && this.rejectedReportsColumnFilterPopover !== except) {
      this.rejectedReportsColumnFilterPopover.hide();
    }

    if (this.activeColumnFilterPopover && this.activeColumnFilterPopover !== except) {
      this.activeColumnFilterPopover = null;
    }
  }

  private hideSettingsPopovers(except?: any): void {
    if (this.newProductsSettingsPopover && this.newProductsSettingsPopover !== except) {
      this.newProductsSettingsPopover.hide();
    }
    if (this.overdueProductsSettingsPopover && this.overdueProductsSettingsPopover !== except) {
      this.overdueProductsSettingsPopover.hide();
    }
    if (!except || (this.activeSettingsPopover && this.activeSettingsPopover !== except)) {
      this.activeSettingsPopover = null;
    }
  }

  private ensureSettingsPopoverClasses(popoverRef: any): void {
    const overlay: HTMLElement | null = popoverRef?.overlay?.nativeElement ?? null;
    if (!overlay) {
      return;
    }

    overlay.classList.add('column-filter-popover', 'settings-popover');
  }

  private showColumnFilterPopover(popoverRef: any, targetElement: HTMLElement, delay = 200): void {
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
    this.activeColumnFilterPopover = null;
    this.cd.detectChanges();

    this.columnFilterPopoverTimeout = setTimeout(() => {
      popoverRef.show(positioningEvent);
      this.activeColumnFilterPopover = popoverRef;

      this.cd.detectChanges();
    }, delay);
  }

  toggleSettingsPopover(popoverRef: any, event: Event): void {
    const targetElement = (event.currentTarget || event.target) as HTMLElement;
    if (!popoverRef || !targetElement) {
      return;
    }

    event.stopPropagation();

    if (this.activeSettingsPopover === popoverRef) {
      // Close the whole settings popover on repeated clicks.
      popoverRef.hide();
      this.activeSettingsPopover = null;
      return;
    }

    this.hideStatusFilterPopovers();
    this.newReportsColumnFilterPopover?.hide();
    this.rejectedReportsColumnFilterPopover?.hide();
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

      // Some PrimeNG builds may not reliably apply styleClass to the runtime overlay.
      [0, 50, 120].forEach((delay) =>
        setTimeout(() => {
          this.ensureSettingsPopoverClasses(popoverRef);
        }, delay),
      );
    }, 120);
  }

  onSettingsPopoverClose(popoverRef: any, event?: Event): void {
    event?.stopPropagation();
    if (popoverRef) {
      popoverRef.hide();
      if (this.activeSettingsPopover === popoverRef) {
        this.activeSettingsPopover = null;
      }
    }
  }

  /**
   * Handle click outside to close popovers
   */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;

    // Check if click is inside a popover panel
    const isClickInsidePopover = target.closest('.p-popover') !== null || target.closest('[data-pc-section="content"]') !== null;

    // Check if click is on a filter icon (SVG with filter icon)
    const isClickOnFilterIcon = target.closest('.filter-icon-wrapper') !== null;

    // Check if click is on PrimeNG multiselect or dropdown
    const isClickOnPrimeComponent =
      target.closest('p-multiselect') !== null ||
      target.closest('p-dropdown') !== null ||
      target.closest('.p-multiselect') !== null ||
      target.closest('.p-dropdown') !== null ||
      target.closest('.p-multiselect-panel') !== null ||
      target.closest('.p-dropdown-panel') !== null ||
      target.closest('p-popover') !== null;

    // If click is not inside popover, not on filter icon, and not on PrimeNG component, close all popovers
    if (!isClickInsidePopover && !isClickOnFilterIcon && !isClickOnPrimeComponent) {
      this.closeAllFilterPopovers();
    }
  }
  /** True when viewport is below lg (1024px) – use modal for column filter instead of popover */
  isMobileColumnFilter(): boolean {
    return typeof window !== 'undefined' && window.innerWidth < 1024;
  }

  openColumnFilterModal(): void {
    this.showColumnFilterModal = true;
    this.cd.detectChanges();
  }

  closeColumnFilterModal(): void {
    this.showColumnFilterModal = false;
    this.columnFilterModalType = null;
    this.activeColumnFilterPopover = null;
    this.cd.detectChanges();
  }

  getActiveModalFilterCount(): number {
    if (this.columnFilterModalType === 'newReports') {
      return this.getNewReportsColumnFilterValue(this.currentNewReportsFilterField)?.length || 0;
    }
    if (this.columnFilterModalType === 'rejectedReports') {
      return this.getRejectedReportsColumnFilterValue(this.currentRejectedReportsFilterField)?.length || 0;
    }
    return 0;
  }

  clearCurrentModalColumnFilter(): void {
    if (this.columnFilterModalType === 'newReports') {
      this.clearCurrentNewReportsColumnFilter();
    } else if (this.columnFilterModalType === 'rejectedReports') {
      this.clearCurrentRejectedReportsColumnFilter();
    }
  }

  getColumnFilterModalTitle(): string {
    if (this.columnFilterModalType === 'newReports' && this.currentNewReportsFilterField) {
      return this.getColumnHeader(this.currentNewReportsFilterField);
    }
    if (this.columnFilterModalType === 'rejectedReports' && this.currentRejectedReportsFilterField) {
      return this.getColumnHeader(this.currentRejectedReportsFilterField);
    }
    return 'Filter';
  }

  // Open filter popover for a specific column
  openNewReportsColumnFilter(field: string, event: Event): void {
    event.stopPropagation();

    if (!this.canFilterNewReportsColumn(field)) {
      return;
    }

    // Store the actual DOM element for positioning - use currentTarget (the div wrapper)
    const targetElement = (event.currentTarget || event.target) as HTMLElement;

    if (!targetElement) {
      return;
    }

    // Close settings popover if open
    this.hideSettingsPopovers();
    this.hideStatusFilterPopovers();

    // On mobile: open centered modal instead of popover
    if (this.isMobileColumnFilter()) {
      const isSameField = this.currentNewReportsFilterField === field;
      if (isSameField && this.showColumnFilterModal && this.columnFilterModalType === 'newReports') {
        this.closeColumnFilterModal();
        return;
      }
      this.closeColumnFilterModal();
      this.currentNewReportsFilterField = field;
      this.currentNewReportsFilterOptions = this.getNewReportsFilterOptions(field);
      this.columnFilterModalType = 'newReports';
      this.openColumnFilterModal();
      return;
    }

    // Desktop: popover
    const isSameField = this.currentNewReportsFilterField === field;
    const isPopoverOpen = this.activeColumnFilterPopover === this.newReportsColumnFilterPopover;

    if (isSameField && isPopoverOpen) {
      this.closeActiveColumnFilterPopover();
      return;
    }

    this.closeActiveColumnFilterPopover();
    this.currentNewReportsFilterField = field;
    this.currentNewReportsFilterOptions = this.getNewReportsFilterOptions(field);
    this.cd.detectChanges();
    this.showColumnFilterPopover(this.newReportsColumnFilterPopover, targetElement, 120);
  }

  openRejectedReportsColumnFilter(field: string, event: Event): void {
    event.stopPropagation();

    if (!this.canFilterRejectedReportsColumn(field)) {
      return;
    }

    const targetElement = (event.currentTarget || event.target) as HTMLElement;

    if (!targetElement) {
      return;
    }

    this.hideSettingsPopovers();
    this.hideStatusFilterPopovers();

    // On mobile: open centered modal instead of popover
    if (this.isMobileColumnFilter()) {
      const isSameField = this.currentRejectedReportsFilterField === field;
      if (isSameField && this.showColumnFilterModal && this.columnFilterModalType === 'rejectedReports') {
        this.closeColumnFilterModal();
        return;
      }
      this.closeColumnFilterModal();
      this.currentRejectedReportsFilterField = field;
      this.currentRejectedReportsFilterOptions = this.getRejectedReportsFilterOptions(field);
      this.columnFilterModalType = 'rejectedReports';
      this.openColumnFilterModal();
      return;
    }

    // Desktop: popover
    const isSameField = this.currentRejectedReportsFilterField === field;
    const isPopoverOpen = this.activeColumnFilterPopover === this.rejectedReportsColumnFilterPopover;

    if (isSameField && isPopoverOpen) {
      this.closeActiveColumnFilterPopover();
      return;
    }

    this.closeActiveColumnFilterPopover();
    this.currentRejectedReportsFilterField = field;
    this.currentRejectedReportsFilterOptions = this.getRejectedReportsFilterOptions(field);
    this.cd.detectChanges();
    this.showColumnFilterPopover(this.rejectedReportsColumnFilterPopover, targetElement, 120);
  }

  /**
   * Handle new reports filter popover close
   */
  onNewReportsFilterPopoverClose(): void {
    if (this.newReportsColumnFilterPopover) {
      this.newReportsColumnFilterPopover.hide();
    }
    if (this.activeColumnFilterPopover === this.newReportsColumnFilterPopover) {
      this.activeColumnFilterPopover = null;
    }
  }

  /**
   * Handle rejected reports filter popover close
   */
  onRejectedReportsFilterPopoverClose(): void {
    if (this.rejectedReportsColumnFilterPopover) {
      this.rejectedReportsColumnFilterPopover.hide();
    }
    if (this.activeColumnFilterPopover === this.rejectedReportsColumnFilterPopover) {
      this.activeColumnFilterPopover = null;
    }
  }

  // Check if any column filters are active
  hasNewReportsColumnFilters(): boolean {
    return Object.values(this.newReportsColumnFilters).some((filters) => filters.length > 0);
  }

  hasRejectedReportsColumnFilters(): boolean {
    return Object.values(this.rejectedReportsColumnFilters).some((filters) => filters.length > 0);
  }

  shouldShowNewReportsTable(): boolean {
    return this.getBaseNewReports().length > 0 || this.hasNewReportsColumnFilters();
  }

  shouldShowRejectedReportsTable(): boolean {
    return this.getBaseRejectedReports().length > 0 || this.hasRejectedReportsColumnFilters();
  }

  private getBaseNewReports(): DashboardReport[] {
    return (this.newReports || []).filter((report) => categorizeReportForAkzente(Number(report.status?.id)) === 'new');
  }

  private getBaseRejectedReports(): DashboardReport[] {
    const allReports = [...(this.rejectedReports || []), ...(this.newReports || [])];
    const dueReports = allReports.filter((report) => Number(report.status?.id) === ReportStatusEnum.SUBMITTED);
    return Array.from(new Map(dueReports.map((report) => [report.id, report])).values());
  }

  // Get column header for a field
  getColumnHeader(field: string): string {
    const col = this.cols.find((c) => c.field === field);
    return col ? col.header : field;
  }

  /** Tooltip for table column filter icon: shows column name and optional count when filtering. */
  getColumnFilterTooltip(header: string, selectedCount: number): string {
    if (selectedCount > 0) {
      return `Filter: ${header} (${selectedCount} ausgewählt)`;
    }
    return `Filter: ${header}`;
  }

  getClientReportCount(client: ClientCompanyWithCounts, key: keyof ReportCounts): number {
    return client.reportCounts?.[key] ?? 0;
  }

  hasClientReports(client: ClientCompanyWithCounts, key: keyof ReportCounts): boolean {
    return this.getClientReportCount(client, key) > 0;
  }

  onClientReportLinkClick(event: Event, client: ClientCompanyWithCounts, key: keyof ReportCounts): void {
    if (!this.hasClientReports(client, key)) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  private applyReportSorting(reports: DashboardReport[], field: string, order: number): DashboardReport[] {
    if (!field) {
      return reports;
    }

    const sorted = [...reports];
    sorted.sort((a, b) => {
      const valueA = this.getReportSortValue(a, field);
      const valueB = this.getReportSortValue(b, field);

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

  private getReportSortValue(report: DashboardReport, field: string): string | number {
    switch (field) {
      case 'inventoryStatus':
      case 'status':
        return this.getReportStatus(report);
      case 'kunde':
        return this.getReportKunde(report);
      case 'store':
        return this.getReportStore(report);
      case 'ort':
        return this.getReportOrt(report);
      case 'vm':
        return this.getReportVM(report);
      case 'besuchsdatum':
        return report.visitDate ? new Date(report.visitDate).getTime() : 0;
      default:
        return (report as any)[field] ?? '';
    }
  }

  // Get tooltip value for report field
  getReportTooltipValue(report: DashboardReport, field: string): string {
    switch (field) {
      case 'kunde':
        return this.getReportKunde(report);
      case 'store':
        return this.getReportStore(report);
      case 'ort':
        return this.getReportOrt(report);
      case 'besuchsdatum':
        return this.getReportBesuchsdatum(report) === '-' ? '--.--.----' : this.getReportBesuchsdatum(report) || '';
      case 'vm':
        return this.getReportVM(report);
      default:
        return (report as any)[field]?.toString() || '-';
    }
  }

  private checkFilterOptionsAvailability(reports: DashboardReport[], field: string): boolean {
    if (!reports.length) {
      return false;
    }
    return reports.some((report) => !this.isColumnFilterValueEmpty(field, this.getReportColumnFilterValue(report, field)));
  }

  openMobileFilterSheet(tableType: 'newReports' | 'rejectedReports'): void {
    if (tableType === 'newReports') {
      const cols = this.getNewProductsVisibleColumns();
      this.newReportsMobileColumnOptions = {};
      this.newReportsCanFilterMap = {};
      cols.forEach((col) => {
        this.newReportsCanFilterMap[col.field] = this.canFilterNewReportsColumn(col.field);
        if (this.newReportsCanFilterMap[col.field]) {
          this.newReportsMobileColumnOptions[col.field] = this.getNewReportsFilterOptions(col.field);
        }
      });
      // also add 'status' if it's not in cols (since status is hardcoded in table)
      this.newReportsCanFilterMap['status'] = this.canFilterNewReportsColumn('status');
      if (this.newReportsCanFilterMap['status']) {
        this.newReportsMobileColumnOptions['status'] = this.getNewReportsFilterOptions('status');
      }

      this.showNewReportsMobileFilter = true;
    } else {
      const cols = this.getOverdueProductsVisibleColumns();
      this.rejectedReportsMobileColumnOptions = {};
      this.rejectedReportsCanFilterMap = {};
      cols.forEach((col) => {
        this.rejectedReportsCanFilterMap[col.field] = this.canFilterRejectedReportsColumn(col.field);
        if (this.rejectedReportsCanFilterMap[col.field]) {
          this.rejectedReportsMobileColumnOptions[col.field] = this.getRejectedReportsFilterOptions(col.field);
        }
      });
      // also add 'status'
      this.rejectedReportsCanFilterMap['status'] = this.canFilterRejectedReportsColumn('status');
      if (this.rejectedReportsCanFilterMap['status']) {
        this.rejectedReportsMobileColumnOptions['status'] = this.getRejectedReportsFilterOptions('status');
      }

      this.showRejectedReportsMobileFilter = true;
    }
  }

  onMobileFilterChanged(tableType: 'newReports' | 'rejectedReports', event: { field: string; values: string[] }): void {
    if (tableType === 'newReports') {
      (this.newReportsColumnFilters as any)[event.field] = event.values;
      this.onNewReportsFiltersChanged();
    } else {
      (this.rejectedReportsColumnFilters as any)[event.field] = event.values;
      this.onRejectedReportsFiltersChanged();
    }
  }

  onMobileFilterCleared(tableType: 'newReports' | 'rejectedReports'): void {
    if (tableType === 'newReports') {
      this.newReportsColumnFilters = createDefaultColumnFilters();
      this.onNewReportsFiltersChanged();
    } else {
      this.rejectedReportsColumnFilters = createDefaultColumnFilters();
      this.onRejectedReportsFiltersChanged();
    }
  }

  getTotalNewReportsActiveFilters(): number {
    return Object.values(this.newReportsColumnFilters).reduce((sum, arr) => sum + ((arr as any[])?.length || 0), 0);
  }

  getTotalRejectedReportsActiveFilters(): number {
    return Object.values(this.rejectedReportsColumnFilters).reduce((sum, arr) => sum + ((arr as any[])?.length || 0), 0);
  }

  getMobileFilterColumns(tableType: 'newReports' | 'rejectedReports'): { field: string; header: string }[] {
    if (tableType === 'newReports') {
      return [...this.getNewProductsVisibleColumns()];
    } else {
      return [...this.getOverdueProductsVisibleColumns()];
    }
  }

  // Check if a field can be filtered in new reports
  canFilterNewReportsColumn(field: string): boolean {
    const filterableFields = ['status', 'kunde', 'store', 'ort', 'besuchsdatum', 'vm'];
    if (!filterableFields.includes(field)) {
      return false;
    }

    if (this.getNewReportsColumnFilterValue(field).length > 0) {
      return true;
    }

    return this.checkFilterOptionsAvailability(this.getFilteredNewReports(field, true), field);
  }

  // Check if a field can be filtered in rejected reports
  canFilterRejectedReportsColumn(field: string): boolean {
    const filterableFields = ['status', 'kunde', 'store', 'ort', 'besuchsdatum', 'vm'];
    if (!filterableFields.includes(field)) {
      return false;
    }

    if (this.getRejectedReportsColumnFilterValue(field).length > 0) {
      return true;
    }

    return this.checkFilterOptionsAvailability(this.getFilteredRejectedReports(field, true), field);
  }
}
