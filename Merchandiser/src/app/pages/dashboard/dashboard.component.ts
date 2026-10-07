import { Component, OnInit, OnDestroy, ViewEncapsulation, ViewChild, ChangeDetectorRef } from '@angular/core';
import { Location } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { ImportsModule } from '@app/shared/imports';
import { ClientCompanyService } from '@app/@core/services/client-company.service';
import { AppIconComponent } from '../../shared/app-icon.component';
import { FavoriteToggleComponent } from '@app/shared/components/favorite-toggle/favorite-toggle.component';
import { ColumnFilterPopoverComponent } from '@app/shared/components/column-filter-popover/column-filter-popover.component';
import { ClientsRoutingModule } from '../clients/clients-routing.module';
import { DashboardService, UpcomingProject } from '@app/@core/services/dashboard.service';
import { Report, ReportService } from '@app/@core/services/report.service';
import { AssignedReport } from '@app/@core/services/assigned-reports.service';
import { EuDatePipe } from '@app/shared/pipes/eu-date.pipe';
import { DashboardStateService } from './dashboard-state.service';
import { catchError, of, timeout } from 'rxjs';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { FilterResetService } from '@core/services/filter-reset.service';

interface ReportDisplay {
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
  isFavorite?: boolean;
  client?: string;
  kunde?: string;
  store?: string;
  ort?: string;
  besuchsdatum?: string;
  branch?: any;
  project?: any;
}

interface Column {
  field: string;
  header: string;
}
@Component({
  selector: 'app-dashboard',
  imports: [TranslateModule, ClientsRoutingModule, ImportsModule, AppIconComponent, FavoriteToggleComponent, EuDatePipe, ColumnFilterPopoverComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
  encapsulation: ViewEncapsulation.None,
})
export class DashboardComponent implements OnInit, OnDestroy {
  // Data properties
  upcomingProjects: UpcomingProject[] = [];
  upcomingProjectsCount: number = 0;
  newRequests: AssignedReport[] = [];
  newRequestsCount: number = 0;
  overdueReports: Report[] = [];

  // UI State
  loading: boolean = true;
  error: boolean = false;

  // Track in-flight API call to avoid accidental double fetches while still allowing initial load
  private requestInFlight = false;

  private destroy$ = new Subject<void>();

  // Table columns
  cols!: Column[];
  overdueReportsColumns!: Column[];

  // Sorting
  overdueSortField: string = '';
  overdueSortOrder: number = 1;

  // Column visibility and ordering
  overdueReportsVisibleColumns: { [key: string]: boolean } = {};
  overdueReportsOrderedColumns: Column[] = [];

  // Column filter properties
  overdueReportsColumnFilters: { [key: string]: string[] } = {
    kunde: [],
    store: [],
    ort: [],
    besuchsdatum: [],
  };

  // Track current filter field for popovers
  currentOverdueReportsFilterField: string = '';
  // Cached options
  currentOverdueReportsColumnOptions: { label: string; value: string }[] = [];

  @ViewChild('overdueReportsColumnFilterPopover') overdueReportsColumnFilterPopover!: ColumnFilterPopoverComponent;
  @ViewChild('overdueReportsPopover') overdueReportsPopover: any;
  private activeFilterPopover: ColumnFilterPopoverComponent | null = null;
  private activeSettingsPopover: any = null;
  private columnFilterPopoverTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private dashboardService: DashboardService,
    private reportService: ReportService,
    private dashboardStateService: DashboardStateService,
    private filterResetService: FilterResetService,
    private router: Router,
    private clientCompanyService: ClientCompanyService,
    private location: Location,
    private cd: ChangeDetectorRef,
  ) {}

  goBack(): void {
    this.location.back();
  }

  navigateToClientFirstProject(clientCompanyId: number | undefined): void {
    if (!clientCompanyId) return;

    this.clientCompanyService
      .getProjectsByClientCompany(clientCompanyId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response && response.projects && response.projects.length > 0) {
            const firstProject = response.projects[0];
            this.router.navigate(['/clients', clientCompanyId, 'projects', firstProject.id]);
          } else {
            this.router.navigate(['/clients', clientCompanyId]);
          }
        },
        error: (err) => {
          console.error(err);
          this.router.navigate(['/clients', clientCompanyId]);
        },
      });
  }

  ngOnDestroy(): void {
    if (this.columnFilterPopoverTimeout) {
      clearTimeout(this.columnFilterPopoverTimeout);
      this.columnFilterPopoverTimeout = null;
    }
    this.closeActiveColumnFilterPopover();
    this.destroy$.next();
    this.destroy$.complete();
  }

  ngOnInit() {
    this.filterResetService.reset$.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.dashboardStateService.clearCache();
      this.overdueReportsColumnFilters = {
        kunde: [],
        store: [],
        ort: [],
        besuchsdatum: [],
      };
      this.overdueSortField = '';
      this.overdueSortOrder = 1;
      this.loadDashboardData({ showLoader: true });
    });

    // Initialize columns first
    this.cols = [
      { field: 'kunde', header: 'Kunde' },
      { field: 'store', header: 'Store' },
      { field: 'ort', header: 'Ort' },
      { field: 'besuchsdatum', header: 'Besuchsdatum' },
    ];

    // Initialize column visibility and ordering
    this.initializeVisibleColumns();
    this.overdueReportsOrderedColumns = [...this.cols];
    this.overdueReportsColumns = [...this.cols];

    // Ensure filter arrays are initialized (safety check)
    if (!this.overdueReportsColumnFilters || !Array.isArray(this.overdueReportsColumnFilters['kunde'])) {
      this.overdueReportsColumnFilters = {
        kunde: [],
        store: [],
        ort: [],
        besuchsdatum: [],
      };
    }

    // Try to restore from cache first
    const cachedData = this.dashboardStateService.getDashboardDataSnapshot();
    if (cachedData && this.dashboardStateService.isCacheValid() && cachedData.upcomingProjects && cachedData.newRequests && cachedData.overdueReports) {
      console.log('✅ Restoring dashboard data from cache');
      this.applyDashboardData(cachedData);
      this.loading = false; // Ensure loader is not shown when data is from cache

      // Load fresh data in background (without showing loader)
      // Use setTimeout to ensure the cache data is displayed first
      setTimeout(() => {
        this.loadDashboardData({ showLoader: false });
      }, 100);
    } else {
      // No valid cache, load from server with loader
      console.log('🔄 No cache found or cache invalid, loading dashboard data from server');
      this.loadDashboardData({ showLoader: true });
    }

    console.log('🚀 Dashboard initialization started');
  }

  /**
   * Load all dashboard data from the API
   */
  loadDashboardData(options: { showLoader?: boolean } = { showLoader: true }): void {
    // Prevent duplicate calls only when a request is already in flight
    if (this.requestInFlight) {
      console.log('📦 DashboardComponent: Request already in flight, skipping duplicate call');
      return;
    }

    console.log('📦 DashboardComponent: Loading dashboard data from API', options.showLoader ? '(with loader)' : '(background refresh)');

    this.requestInFlight = true;
    if (options.showLoader) {
      this.loading = true;
    }
    this.error = false;

    // Safety timeout: Force loading to false after 35 seconds if request hangs
    let safetyTimeout: ReturnType<typeof setTimeout> | null = setTimeout(() => {
      if (this.loading) {
        console.warn('⚠️ DashboardComponent: Request timeout - forcing loading to false');
        this.loading = false;
        this.error = true;
        safetyTimeout = null;
      }
    }, 35000);

    const clearSafetyTimeout = () => {
      if (safetyTimeout) {
        clearTimeout(safetyTimeout);
        safetyTimeout = null;
      }
    };

    this.dashboardService
      .getDashboardData()
      .pipe(
        takeUntil(this.destroy$),
        timeout(30000), // 30 second timeout to prevent infinite loading
        catchError((error) => {
          console.error('❌ Error loading dashboard data:', error);
          clearSafetyTimeout();
          this.error = true;
          this.loading = false; // Always set loading to false on error

          // Set empty data to prevent UI issues
          this.upcomingProjects = [];
          this.upcomingProjectsCount = 0;
          this.newRequests = [];
          this.newRequestsCount = 0;
          this.overdueReports = [];

          return of({
            upcomingProjects: [],
            upcomingProjectsCount: 0,
            newRequestsCount: 0,
            newRequests: [],
            overdueReports: [],
          });
        }),
      )
      .subscribe({
        next: (data) => {
          console.log('✅ DashboardComponent: Dashboard data loaded:', data);
          clearSafetyTimeout();
          this.applyDashboardData(data);

          // Save to store
          this.dashboardStateService.setDashboardData({
            upcomingProjects: this.upcomingProjects,
            upcomingProjectsCount: this.upcomingProjectsCount,
            newRequests: this.newRequests,
            newRequestsCount: this.newRequestsCount,
            overdueReports: this.overdueReports,
          });

          // Always set loading to false after data is loaded
          this.loading = false;
        },
        error: (error) => {
          console.error('❌ DashboardComponent: Subscription error:', error);
          clearSafetyTimeout();
          this.error = true;
          this.loading = false;
          this.requestInFlight = false;
          // Ensure data is set even on error
          this.upcomingProjects = [];
          this.upcomingProjectsCount = 0;
          this.newRequests = [];
          this.newRequestsCount = 0;
          this.overdueReports = [];
        },
        complete: () => {
          clearSafetyTimeout();
          this.requestInFlight = false;
          this.loading = false;
        },
      });
  }

  /**
   * Defensive normalization to avoid rendering requests as upcoming projects.
   * Some API responses may contain overlapping entries in both lists.
   */
  private applyDashboardData(data: {
    upcomingProjects?: UpcomingProject[];
    upcomingProjectsCount?: number;
    newRequests?: AssignedReport[];
    newRequestsCount?: number;
    overdueReports?: Report[];
  }): void {
    const newRequests = data.newRequests || [];
    const requestIds = new Set(newRequests.map((request) => Number(request?.id)).filter((id) => Number.isFinite(id) && id > 0));

    this.newRequests = newRequests;
    // API returns a preview list (top 3) plus the full total count.
    this.newRequestsCount = data.newRequestsCount ?? this.newRequests.length;
    this.overdueReports = data.overdueReports || [];
    this.upcomingProjects = (data.upcomingProjects || []).filter((project) => !requestIds.has(Number(project?.id)));
    this.upcomingProjectsCount = data.upcomingProjectsCount ?? this.upcomingProjects.length;
  }

  /**
   * Transform Report objects to ReportDisplay interface for table display
   */
  transformReportsToReportDisplay(reports: Report[]): ReportDisplay[] {
    return reports.map((report) => ({
      id: report.id?.toString(),
      name: report.title || report.description,
      description: report.description,
      inventoryStatus: report.status?.merchandiserName || report.status?.name || 'FÄLLIG',
      kunde: report.branch?.client?.name || report.project?.name || '-',
      store: report.branch?.name || '-',
      ort: this.formatReportAddress(report) || report.branch?.name || '-',
      besuchsdatum: report.plannedOn ? this.dashboardService.formatDateShort(report.plannedOn) : '-',
      isFavorite: report.isFavorite || false,
      branch: report.branch,
      project: report.project,
    }));
  }

  /**
   * Format date to German format for display
   */
  formatDate(dateString: string): string {
    return this.dashboardService.formatDateGerman(dateString);
  }

  getReportBesuchsdatum(report: Report): string {
    return report.plannedOn ? this.dashboardService.formatDateShort(report.plannedOn) : '-';
  }

  getReportKunde(report: Report): string {
    return report.branch?.client?.name || report.project?.name || '-';
  }

  getReportStore(report: Report): string {
    return report.branch?.name || '-';
  }

  getReportOrt(report: Report): string {
    const address = this.formatReportAddress(report);
    return address || report.branch?.name || '-';
  }

  /**
   * Generate formatted address string for a report
   * Format: STREET + HOUSE NUMBER, ZIP CODE, CITY, COUNTRY
   */
  formatReportAddress(report: Report): string {
    if (!report) return '';

    // Street + House Number (already combined in report.street)
    const street = report.street || '';

    // ZIP Code
    const zip = report.zipCode || '';

    // City
    let city = '';
    if (report.branch) {
      if ((report.branch as any).city && (report.branch as any).city.name) {
        city = (report.branch as any).city.name;
      } else {
        city = report.branch.name || '';
      }
    }

    // Country
    let country = '';
    if (report.branch && (report.branch as any).city && (report.branch as any).city.country) {
      const countryObj = (report.branch as any).city.country;
      country = countryObj.name?.de || countryObj.name || '';
    }

    // Format: STREET + HOUSE NUMBER, ZIP CODE, CITY, COUNTRY
    const parts = [street, zip, city, country].filter(Boolean);
    return parts.join(', ');
  }

  getStatusStyle(status: string): { bg: string; text: string } {
    switch (status) {
      case 'NEU':
        return { bg: 'bg-[#00709B]', text: 'NEU' };
      case 'FÄLLIG':
        return { bg: 'bg-[#D10003]', text: 'FÄLLIG' };
      case 'PLAN':
        return { bg: 'bg-[#CCAF08]', text: 'PLAN' };
      case 'OK':
        return { bg: 'bg-[#6FCC08]', text: 'OK' };
      case 'ANFRAGE':
        return { bg: 'bg-[#00A8E9]', text: 'ANFRAGE' };
      case 'OFFEN':
        return { bg: 'bg-[#CCAF08]', text: 'OFFEN' };
      default:
        return { bg: 'bg-gray-400', text: status };
    }
  }

  /**
   * Handle favorite toggle for reports
   */
  onFavoriteChanged(newStatus: boolean, report: Report): void {
    report.isFavorite = newStatus;

    // Update on backend
    if (report.id) {
      this.reportService
        .toggleFavoriteStatus(report.id)
        .pipe(
          catchError((error) => {
            console.error('Error toggling favorite status:', error);
            // Revert on error
            report.isFavorite = !newStatus;
            return of(null);
          }),
        )
        .subscribe((response) => {
          if (response) {
            console.log('✅ Favorite status updated:', response.message);
          }
        });
    }
  }

  /**
   * Handle sorting for overdue reports
   */

  onOverdueSort(field: string): void {
    if (this.overdueSortField === field) {
      // If clicking on the same field, toggle the sort order
      this.overdueSortOrder = this.overdueSortOrder * -1;
    } else {
      // New sort field, default to ascending
      this.overdueSortField = field;
      this.overdueSortOrder = 1;
    }

    // Apply sorting
    this.sortReports(this.overdueReports, field, this.overdueSortOrder);
  }

  private sortReports(reports: Report[], field: string, order: number): void {
    reports.sort((a, b) => {
      const valueA = this.getReportField(a, field);
      const valueB = this.getReportField(b, field);

      if (valueA === valueB) {
        return 0;
      }

      // Handle string case-insensitive comparison
      if (typeof valueA === 'string' && typeof valueB === 'string') {
        return order * valueA.localeCompare(valueB);
      }

      // Handle numeric comparison
      if (valueA < valueB) {
        return order * -1;
      }
      return order;
    });
  }

  private getReportField(report: Report, field: string): any {
    // Handle special fields that need transformation
    if (field === 'kunde') {
      return this.getReportKunde(report);
    }
    if (field === 'store') {
      return this.getReportStore(report);
    }
    if (field === 'ort') {
      return this.getReportOrt(report);
    }
    if (field === 'besuchsdatum') {
      return report.plannedOn;
    }
    if (field === 'status') {
      return report.status?.name || '';
    }
    // Handle other properties
    const value = (report as any)[field];
    return value !== undefined && value !== null ? value : '';
  }

  /**
   * Initialize visible columns
   */
  initializeVisibleColumns() {
    // Set all columns to visible by default
    this.cols.forEach((col) => {
      this.overdueReportsVisibleColumns[col.field] = true;
    });
  }

  // Get visible columns for overdue reports
  getOverdueReportsVisibleColumns(): Column[] {
    // Return ordered columns that are visible
    return this.overdueReportsOrderedColumns.filter((col) => this.overdueReportsVisibleColumns[col.field]);
  }

  // Update visible columns when selection changes in multiselect
  onOverdueReportsColumnsChange(selectedColumns: Column[]) {
    // Reset all to false
    Object.keys(this.overdueReportsVisibleColumns).forEach((key) => {
      this.overdueReportsVisibleColumns[key] = false;
    });

    // Set selected columns to true
    selectedColumns.forEach((col) => {
      this.overdueReportsVisibleColumns[col.field] = true;
    });
  }

  clearOverdueReportsColumns(event?: Event): void {
    event?.stopPropagation();
    this.overdueReportsColumns = [...this.cols];
    this.onOverdueReportsColumnsChange(this.overdueReportsColumns);
  }

  isAllOverdueReportsColumnsSelected(): boolean {
    return (this.overdueReportsColumns?.length || 0) === (this.cols?.length || 0);
  }

  /**
   * Handle column reordering for overdue reports table
   */

  onOverdueReportsColReorder(event: any) {
    if (event && typeof event.dragIndex === 'number' && typeof event.dropIndex === 'number') {
      // Get the column that was moved
      const movedColumn = this.overdueReportsOrderedColumns[event.dragIndex];

      // Create a new array without the moved column
      const newOrderedColumns = [...this.overdueReportsOrderedColumns];
      newOrderedColumns.splice(event.dragIndex, 1);

      // Insert the moved column at the drop index
      newOrderedColumns.splice(event.dropIndex, 0, movedColumn);

      // Update the ordered columns with the new order
      this.overdueReportsOrderedColumns = newOrderedColumns;
    }
  }

  getUniqueValuesForOverdueReportsColumn(field: string): { label: string; value: string }[] {
    const values = new Set<string>();
    const filteredReports = this.getFilteredOverdueReports(field);
    filteredReports.forEach((report) => {
      let value: string = '';
      switch (field) {
        case 'kunde':
          value = this.getReportKunde(report);
          break;
        case 'store':
          value = this.getReportStore(report);
          break;
        case 'ort':
          value = this.getReportOrt(report);
          break;
        case 'besuchsdatum':
          value = this.getReportBesuchsdatum(report);
          break;
      }
      if (value && value !== '-') {
        values.add(value);
      }
    });
    return Array.from(values)
      .sort()
      .map((val) => ({ label: val, value: val }));
  }

  // Column filter methods
  getOverdueReportsFilterOptions(field: string): string[] {
    const values = new Set<string>();
    const filteredReports = this.getFilteredOverdueReports(field);
    filteredReports.forEach((report) => {
      let value: string = '';
      switch (field) {
        case 'kunde':
          value = this.getReportKunde(report);
          break;
        case 'store':
          value = this.getReportStore(report);
          break;
        case 'ort':
          value = this.getReportOrt(report);
          break;
        case 'besuchsdatum':
          value = this.getReportBesuchsdatum(report);
          break;
      }
      if (value && value !== '-') {
        values.add(value);
      }
    });
    return Array.from(values).sort();
  }

  getOverdueReportsColumnFilterValue(field: string): string[] {
    const filter = this.overdueReportsColumnFilters[field];
    return filter && Array.isArray(filter) ? filter : [];
  }

  canFilterOverdueReportsColumn(field: string): boolean {
    const filterableFields = ['kunde', 'store', 'ort', 'besuchsdatum'];
    if (!filterableFields.includes(field)) {
      return false;
    }

    if (this.getOverdueReportsColumnFilterValue(field).length > 0) {
      return true;
    }

    return this.getOverdueReportsFilterOptions(field).length > 0;
  }

  getColumnFilterTooltip(header: string, selectedCount: number): string {
    if (selectedCount > 0) {
      return `Filter: ${header} (${selectedCount} ausgewählt)`;
    }
    return `Filter: ${header}`;
  }

  /**
   * Handle settings popover toggle - ensure only one popover is open at a time
   */
  toggleSettingsPopover(event: Event): void {
    const targetElement = (event.currentTarget || event.target) as HTMLElement;
    if (!this.overdueReportsPopover || !targetElement) {
      return;
    }

    event.stopPropagation();
    this.closeActiveColumnFilterPopover();

    if (this.activeSettingsPopover === this.overdueReportsPopover) {
      this.overdueReportsPopover.hide();
      this.activeSettingsPopover = null;
      return;
    }

    const positioningEvent = {
      currentTarget: targetElement,
      target: targetElement,
      preventDefault: () => {},
      stopPropagation: () => {},
    } as any;

    this.overdueReportsPopover.hide();
    setTimeout(() => {
      this.overdueReportsPopover.show(positioningEvent);
      this.activeSettingsPopover = this.overdueReportsPopover;
    }, 120);
  }

  /**
   * Handle settings popover close
   */
  onSettingsPopoverClose(event?: Event): void {
    event?.stopPropagation();
    if (this.overdueReportsPopover) {
      this.overdueReportsPopover.hide();
    }
    this.activeSettingsPopover = null;
  }

  openOverdueReportsColumnFilter(field: string, event: Event): void {
    event.stopPropagation();

    if (!this.canFilterOverdueReportsColumn(field)) {
      return;
    }

    const targetElement = (event.currentTarget || event.target) as HTMLElement;

    if (!targetElement) {
      return;
    }

    if (this.activeSettingsPopover) {
      this.activeSettingsPopover.hide();
      this.activeSettingsPopover = null;
    }

    const isSameField = this.currentOverdueReportsFilterField === field;
    const isPopoverOpen = this.activeFilterPopover === this.overdueReportsColumnFilterPopover;

    if (isSameField && isPopoverOpen) {
      this.closeActiveColumnFilterPopover();
      return;
    }

    this.closeActiveColumnFilterPopover();
    this.currentOverdueReportsFilterField = field;
    if (!this.overdueReportsColumnFilters[field]) {
      this.overdueReportsColumnFilters[field] = [];
    }
    this.currentOverdueReportsColumnOptions = this.getUniqueValuesForOverdueReportsColumn(field);
    this.cd.detectChanges();
    this.showColumnFilterPopover(this.overdueReportsColumnFilterPopover, targetElement, 120);
  }

  onOverdueReportsFiltersChanged(): void {
    // Binding already updates overdueReportsColumnFilters; method kept for parity with other pages.
  }

  /**
   * Handle filter popover close
   */
  onFilterPopoverClose(): void {
    if (this.activeFilterPopover === this.overdueReportsColumnFilterPopover) {
      this.activeFilterPopover = null;
    }
  }

  private showColumnFilterPopover(popoverRef: ColumnFilterPopoverComponent | null, targetElement: HTMLElement, delay = 120): void {
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
    this.activeFilterPopover = null;

    this.columnFilterPopoverTimeout = setTimeout(() => {
      popoverRef.show(positioningEvent);
      this.activeFilterPopover = popoverRef;
      this.columnFilterPopoverTimeout = null;
    }, delay);
  }

  private closeActiveColumnFilterPopover(): void {
    if (this.columnFilterPopoverTimeout) {
      clearTimeout(this.columnFilterPopoverTimeout);
      this.columnFilterPopoverTimeout = null;
    }
    if (this.activeFilterPopover) {
      this.activeFilterPopover.hide();
      this.activeFilterPopover = null;
    }
  }

  hasOverdueReportsColumnFilters(): boolean {
    return Object.values(this.overdueReportsColumnFilters).some((filters) => filters && Array.isArray(filters) && filters.length > 0);
  }

  getFilteredOverdueReports(excludeField?: string): Report[] {
    return this.overdueReports.filter((report) => {
      // Filter by kunde
      const kundeFilter = this.overdueReportsColumnFilters['kunde'];
      if (excludeField !== 'kunde' && kundeFilter && Array.isArray(kundeFilter) && kundeFilter.length > 0 && !kundeFilter.includes(this.getReportKunde(report))) {
        return false;
      }
      // Filter by store
      const storeFilter = this.overdueReportsColumnFilters['store'];
      if (excludeField !== 'store' && storeFilter && Array.isArray(storeFilter) && storeFilter.length > 0 && !storeFilter.includes(this.getReportStore(report))) {
        return false;
      }
      // Filter by ort
      const ortFilter = this.overdueReportsColumnFilters['ort'];
      if (excludeField !== 'ort' && ortFilter && Array.isArray(ortFilter) && ortFilter.length > 0 && !ortFilter.includes(this.getReportOrt(report))) {
        return false;
      }
      // Filter by besuchsdatum
      const besuchsdatumFilter = this.overdueReportsColumnFilters['besuchsdatum'];
      if (
        excludeField !== 'besuchsdatum' &&
        besuchsdatumFilter &&
        Array.isArray(besuchsdatumFilter) &&
        besuchsdatumFilter.length > 0 &&
        !besuchsdatumFilter.includes(this.getReportBesuchsdatum(report))
      ) {
        return false;
      }
      return true;
    });
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

  // Clear all column filters
  clearFilters(): void {
    this.overdueReportsColumnFilters = {
      kunde: [],
      store: [],
      ort: [],
      besuchsdatum: [],
    };
  }
}
