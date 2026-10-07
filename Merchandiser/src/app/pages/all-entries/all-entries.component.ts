import { Component, OnInit, OnDestroy, AfterViewInit, ViewChild, Renderer2, ChangeDetectorRef, HostListener, ElementRef } from '@angular/core';
import { Location } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { ImportsModule } from '@app/shared/imports';
import { AppIconComponent } from '../../shared/app-icon.component';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, NavigationStart } from '@angular/router';
import { TableModule, Table } from 'primeng/table';
import { FavoriteToggleComponent } from '@app/shared/components/favorite-toggle/favorite-toggle.component';
import { MultiSelectModule } from 'primeng/multiselect';
import { ListboxModule } from 'primeng/listbox';
import { PopoverModule } from 'primeng/popover';
import { DateRangePickerComponent } from '../../shared/components/date-range-picker/date-range-picker.component';
import { ReportService, Report } from '@app/@core/services/report.service';
import { isPendingMerchandiserAcceptance } from '@app/@core/utils/report-merchandiser-status.util';
import { ClientCompanyService } from '@app/@core/services/client-company.service';
import { AllEntriesStateService } from './all-entries-state.service';
import { finalize, catchError } from 'rxjs/operators';
import { Subject, Subscription } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { of } from 'rxjs';
import { HotToastService } from '@ngneat/hot-toast';
import { DialogModule } from 'primeng/dialog';
import { ColumnFilterPopoverComponent } from '@app/shared/components/column-filter-popover/column-filter-popover.component';
import { MobileFilterSheetComponent, MobileFilterColumn, MobileFilterOption } from '@app/shared/components/mobile-filter-sheet/mobile-filter-sheet.component';

// Column interface for table configuration
interface Column {
  field: string;
  header: string;
}

interface FilterOption {
  label: string;
  value: string;
  color?: string;
}

@Component({
  selector: 'app-all-entries',
  standalone: true,
  imports: [
    TranslateModule,
    ImportsModule,
    AppIconComponent,
    FormsModule,
    CommonModule,
    RouterModule,
    TableModule,
    FavoriteToggleComponent,
    MultiSelectModule,
    ListboxModule,
    PopoverModule,
    DialogModule,
    DateRangePickerComponent,
    ColumnFilterPopoverComponent,
    MobileFilterSheetComponent,
  ],
  templateUrl: './all-entries.component.html',
  styleUrl: './all-entries.component.scss',
})
export class AllEntriesComponent implements OnInit, OnDestroy, AfterViewInit {
  // Search functionality
  searchQuery: string = '';
  showAllFiliales: boolean = false;

  // Table state
  expandedRows: { [key: string]: boolean } = {};

  // Change from mock data to real report data
  allReports: Report[] = []; // All reports from API

  private destroy$ = new Subject<void>();
  reports: Report[] = []; // Filtered reports

  // Update column structure to match report data
  cols: Column[] = [];
  selectedColumns: Column[] = [];
  orderedColumns: Column[] = [];
  visibleColumns: { [key: string]: boolean } = {};

  // Add filter properties
  projectSearchTerm: string = '';
  filialeSearchTerm: string = '';
  dateRange2 = { start: null, end: null };

  // Generic filter properties (like dashboard pattern)
  genericFilterValues: { [field: string]: string[] } = {};
  currentFilterField: string = '';

  // Current filter options (computed on-demand, not cached)
  currentGenericOptions: FilterOption[] = [];

  // Mobile column filter modal (centered dialog on small screens)
  showColumnFilterModal = false;

  // Mobile bottom sheet filter
  showMobileFilterSheet = false;
  mobileFilterColumns: MobileFilterColumn[] = [];
  mobileFilterValues: { [field: string]: string[] } = {};
  mobileFilterColumnOptions: { [field: string]: MobileFilterOption[] } = {};
  mobileFilterCanFilterMap: { [field: string]: boolean } = {};

  // Controls whether the mobile "search/date filters" area is visible.
  // Column-filter chips remain visible so the user can still filter.
  mobileFiltersExpanded = true;

  // Loading state
  isLoading: boolean = false;
  error: string | null = null;

  @ViewChild('genericFilterPopover') genericFilterPopover: any;
  @ViewChild('statusFilterPopover') statusFilterPopover: any;
  @ViewChild('merchandiserFilterPopover') merchandiserFilterPopover: any;
  @ViewChild('filialenFilterPopover') filialenFilterPopover: any;
  @ViewChild('columnsPopover') columnsPopover: any;
  @ViewChild('columnsMultiSelect') columnsMultiSelect: any;
  @ViewChild('reportsTable') reportsTable!: Table;
  @ViewChild('mobileReportsList') mobileReportsList?: ElementRef<HTMLElement>;

  private activeFilterPopover: any = null;
  private activeSettingsPopover: any = null;
  private columnFilterPopoverTimeout: any = null;

  // Scroll position tracking
  private scrollPosition = 0;
  private tableScrollPosition = 0;
  private scrollListener: (() => void) | null = null;
  private tableScrollListener: (() => void) | null = null;
  private mobileListScrollListener: (() => void) | null = null;
  private routerSubscription: Subscription | null = null;
  private nextUrl: string | null = null;
  private mobileListScrollPosition = 0;

  constructor(
    private router: Router,
    private reportService: ReportService,
    private allEntriesStateService: AllEntriesStateService,
    private renderer: Renderer2,
    private clientCompanyService: ClientCompanyService,
    private location: Location,
    private _toast: HotToastService,
    private cd: ChangeDetectorRef,
  ) {
    this.routerSubscription = this.router.events.subscribe((event) => {
      if (event instanceof NavigationStart) {
        this.nextUrl = event.url;
      }
    });
  }

  goBack(): void {
    this.location.back();
  }

  ngOnInit(): void {
    // Initialize columns first
    this.initializeColumns();

    // Restore filter state from cache
    const savedFilterState = this.allEntriesStateService.getFilterState();
    if (savedFilterState) {
      console.log('✅ Restoring filter state from cache');
      this.projectSearchTerm = savedFilterState.projectSearchTerm || '';
      this.filialeSearchTerm = savedFilterState.filialeSearchTerm || '';
      this.dateRange2 = savedFilterState.dateRange2 || { start: null, end: null };
      this.genericFilterValues = savedFilterState.genericFilterValues || {};

      // Restore scroll positions
      this.scrollPosition = savedFilterState.scrollPosition || 0;
      this.tableScrollPosition = savedFilterState.tableScrollPosition || 0;
      this.mobileListScrollPosition = (savedFilterState as any).mobileListScrollPosition || 0;
    } else {
      // Initialize filters to empty if no saved state
      this.genericFilterValues = {};
    }

    // Try to restore from cache first
    const cachedData = this.allEntriesStateService.getAllEntriesDataSnapshot();
    if (cachedData && this.allEntriesStateService.isCacheValid() && cachedData.reports && cachedData.reports.length > 0) {
      console.log('✅ Restoring all entries data from cache:', cachedData.reports.length, 'reports');
      this.allReports = cachedData.reports || [];
      this.reports = [...this.allReports];
      this.isLoading = false; // Ensure loader is not shown when data is from cache

      // Apply filters directly (no pre-calculation needed - dashboard pattern)
      this.applyFilters();

      // Load fresh data in background (without showing loader)
      setTimeout(() => {
        this.loadReports({ showLoader: false });
      }, 100);
    } else {
      // No valid cache, load from server with loader
      console.log('🔄 No cache found or cache invalid, loading all entries from server');
      this.loadReports({ showLoader: true });
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();

    // Clean up scroll listeners
    if (this.scrollListener) {
      this.scrollListener();
    }
    if (this.tableScrollListener) {
      this.tableScrollListener();
    }
    if (this.mobileListScrollListener) {
      this.mobileListScrollListener();
    }
    if (this.routerSubscription) {
      this.routerSubscription.unsubscribe();
    }

    // Persist scroll position when navigating to a report
    if (this.shouldPersistState()) {
      this.captureCurrentScrollPositions();
      this.saveFilterState();
    }
  }

  ngAfterViewInit(): void {
    // Debug: Check if popover references are available
    console.log('Popover references initialized:', {
      genericFilterPopover: !!this.genericFilterPopover,
      statusFilterPopover: !!this.statusFilterPopover,
      filialenFilterPopover: !!this.filialenFilterPopover,
      merchandiserFilterPopover: !!this.merchandiserFilterPopover,
      columnsPopover: !!this.columnsPopover,
    });

    // Restore scroll positions after view is initialized
    if (!this.isLoading) {
      this.restoreScrollPosition();
      this.restoreTableScrollPosition();
      this.restoreMobileListScrollPosition();
    }
  }

  /**
   * Determine if state should be persisted (navigating to report details)
   */
  private shouldPersistState(): boolean {
    if (!this.nextUrl) return false;
    return (this.nextUrl.includes('/reports/') || this.nextUrl.includes('/edit-report/')) && this.nextUrl.includes('/projects/');
  }

  /** Client name for display; supports both branch.client and report.clientCompany from API. */
  getReportClientName(report: Report): string {
    return report.branch?.client?.name || (report as any).clientCompany?.name || '-';
  }

  /** Client id for navigation; supports both branch.client and report.clientCompany from API. */
  getReportClientId(report: Report): number | undefined {
    return report.branch?.client?.id ?? (report as any).clientCompany?.id;
  }

  /** Check if report is pending merchandiser acceptance */
  isAnfrageStatus(report: Report): boolean {
    return isPendingMerchandiserAcceptance(report);
  }

  getStatusDisplayName(report: Report): string {
    const status = report?.status;
    if (!status) {
      return '';
    }

    if (typeof status === 'string') {
      return status;
    }

    return status.merchandiserName || status.clientName || status.akzenteName || status.name || '';
  }

  getStatusDisplayColor(report: Report): string {
    const status = report?.status;
    if (!status || typeof status === 'string') {
      return '#9CA3AF';
    }

    return status.merchandiserColor || status.clientColor || status.akzenteColor || status.color || '#9CA3AF';
  }

  navigateToClientFirstProject(clientCompanyId: number | undefined): void {
    if (!clientCompanyId) return;

    this.clientCompanyService
      .getProjectsByClientCompany(clientCompanyId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response && response.projects && response.projects.length > 0) {
            // Navigate to the first project
            const firstProject = response.projects[0];
            this.router.navigate(['/clients', clientCompanyId, 'projects', firstProject.id]);
          } else {
            // No projects, just go to client detail
            this.router.navigate(['/clients', clientCompanyId]);
          }
        },
        error: (err) => {
          console.error('Failed to load projects for client navigation', err);
          // Fallback to client detail
          this.router.navigate(['/clients', clientCompanyId]);
        },
      });
  }

  /**
   * Attach window scroll listener
   */
  private attachScrollListener(): void {
    if (this.scrollListener) {
      return;
    }

    this.scrollListener = this.renderer.listen('window', 'scroll', () => {
      this.scrollPosition = window.scrollY || document.documentElement.scrollTop;
    });
  }

  /**
   * Restore window scroll position
   */
  private restoreScrollPosition(): void {
    setTimeout(() => {
      if (this.scrollPosition > 0) {
        window.scrollTo(0, this.scrollPosition);
      }
      this.attachScrollListener();
    }, 100);
  }

  /**
   * Attach table scroll listener
   */
  private attachTableScrollListener(element?: HTMLElement): void {
    if (this.tableScrollListener) {
      return;
    }

    if (!element) {
      const tableEl = this.reportsTable?.el?.nativeElement;
      if (!tableEl) return;
      element = tableEl.querySelector('.p-datatable-wrapper') || tableEl.querySelector('.p-datatable-scrollable-body') || tableEl.querySelector('.p-datatable-table-container');
    }

    if (element) {
      this.tableScrollListener = this.renderer.listen(element, 'scroll', (event) => {
        const target = event.target as HTMLElement;
        this.tableScrollPosition = target.scrollTop;
      });
    }
  }

  /**
   * Attach mobile card list scroll listener
   */
  private attachMobileListScrollListener(element?: HTMLElement): void {
    if (this.mobileListScrollListener) {
      return;
    }

    const listElement = element || this.mobileReportsList?.nativeElement;
    if (!listElement) {
      return;
    }

    this.mobileListScrollListener = this.renderer.listen(listElement, 'scroll', (event) => {
      const target = event.target as HTMLElement;
      this.mobileListScrollPosition = target.scrollTop;
    });
  }

  /**
   * Restore mobile card list scroll position
   */
  private restoreMobileListScrollPosition(): void {
    let attempts = 0;
    const maxAttempts = 20;

    const checkAndRestore = () => {
      const listElement = this.mobileReportsList?.nativeElement;
      if (listElement) {
        if (this.mobileListScrollPosition > 0) {
          listElement.scrollTop = this.mobileListScrollPosition;
        }
        this.attachMobileListScrollListener(listElement);
      } else if (attempts < maxAttempts) {
        attempts++;
        setTimeout(checkAndRestore, 100);
      }
    };

    checkAndRestore();
  }

  /**
   * Read current scroll values from active containers before persisting state.
   */
  private captureCurrentScrollPositions(): void {
    this.scrollPosition = window.scrollY || document.documentElement.scrollTop || 0;

    const tableEl = this.reportsTable?.el?.nativeElement;
    const tableScrollable = tableEl?.querySelector('.p-datatable-wrapper') || tableEl?.querySelector('.p-datatable-scrollable-body') || tableEl?.querySelector('.p-datatable-table-container');
    if (tableScrollable) {
      this.tableScrollPosition = tableScrollable.scrollTop || 0;
    }

    const mobileListElement = this.mobileReportsList?.nativeElement;
    if (mobileListElement) {
      this.mobileListScrollPosition = mobileListElement.scrollTop || 0;
    }
  }

  /**
   * Restore table scroll position
   */
  private restoreTableScrollPosition(): void {
    let attempts = 0;
    const maxAttempts = 20; // Try for 2 seconds

    const checkAndRestore = () => {
      const tableEl = this.reportsTable?.el?.nativeElement;

      let scrollableBody: HTMLElement | null = null;

      if (tableEl) {
        scrollableBody = tableEl.querySelector('.p-datatable-wrapper') || tableEl.querySelector('.p-datatable-scrollable-body') || tableEl.querySelector('.p-datatable-table-container');

        // Fallback: look for any div with overflow-y auto/scroll
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
        if (this.tableScrollPosition > 0) {
          scrollableBody.scrollTop = this.tableScrollPosition;
        }

        // Attach listener
        this.attachTableScrollListener(scrollableBody);
      } else if (attempts < maxAttempts) {
        attempts++;
        setTimeout(checkAndRestore, 100);
      }
    };

    checkAndRestore();
  }

  // Load reports from API instead of mock data
  loadReports(options: { showLoader: boolean } = { showLoader: true }): void {
    if (options.showLoader) {
      this.isLoading = true;
    }
    this.error = null;

    this.reportService
      .getMerchandiserReports()
      .pipe(
        takeUntil(this.destroy$),
        catchError((error) => {
          this.error = 'Failed to load reports. Please try again.';
          console.error('Error loading reports:', error);
          if (options.showLoader) {
            this.isLoading = false;
          }
          return of([]);
        }),
        finalize(() => {
          if (options.showLoader) {
            this.isLoading = false;
            // Restore scroll positions after loading completes
            this.restoreScrollPosition();
            this.restoreTableScrollPosition();
            this.restoreMobileListScrollPosition();
          }
        }),
      )
      .subscribe({
        next: (reports) => {
          // Keep current filters active when fresh data arrives
          this.allReports = reports;

          // Apply filters (dashboard pattern - no pre-calculation needed)
          this.applyFilters();

          // Save to store
          this.allEntriesStateService.setAllEntriesData(reports);

          console.log('Loaded reports:', reports);
        },
      });
  }

  // Update column structure to match report data
  initializeColumns(): void {
    this.cols = [
      { field: 'branch.client.name', header: 'Client' },
      { field: 'project.name', header: 'Project' },
      { field: 'status', header: 'Status' },
      { field: 'plannedOn', header: 'Planned' },
      { field: 'branch.name', header: 'Branch' },
      { field: 'street', header: 'Address' },
      { field: 'note', header: 'Note' },
      { field: 'reportTo', header: 'Report to' },
      { field: 'feedback', header: 'Feedback' },
    ];

    // Initialize selectedColumns with visible columns
    // Exclude   feedback from default selection
    this.selectedColumns = this.cols.filter((col) => col.field !== 'feedback');
    this.orderedColumns = [...this.cols];
    this.initializeVisibleColumns();
  }

  // Initialize visible columns
  initializeVisibleColumns(): void {
    this.cols.forEach((col) => {
      // Show all columns by default except   feedback
      if (col.field === 'feedback') {
        this.visibleColumns[col.field] = false;
      } else {
        this.visibleColumns[col.field] = true;
      }
    });
  }

  // Get visible columns for the table
  getVisibleColumns(): Column[] {
    return this.orderedColumns.filter((col) => this.visibleColumns[col.field]);
  }

  // Handle column reordering for the table
  onColReorder(event: any): void {
    if (event && typeof event.dragIndex === 'number' && typeof event.dropIndex === 'number') {
      const movedColumn = this.orderedColumns[event.dragIndex];
      const newOrderedColumns = [...this.orderedColumns];
      newOrderedColumns.splice(event.dragIndex, 1);
      newOrderedColumns.splice(event.dropIndex, 0, movedColumn);
      this.orderedColumns = newOrderedColumns;
    }
  }

  // Update visible columns
  onColumnsChange(selectedColumns: Column[]): void {
    // Reset all to false
    Object.keys(this.visibleColumns).forEach((key) => {
      this.visibleColumns[key] = false;
    });

    // Set selected columns to true
    selectedColumns.forEach((col) => {
      this.visibleColumns[col.field] = true;
    });

    this.selectedColumns = selectedColumns;
  }

  /**
   * Save current filter state to cache
   */
  saveFilterState(): void {
    const filterState = {
      projectSearchTerm: this.projectSearchTerm,
      filialeSearchTerm: this.filialeSearchTerm,
      dateRange2: { ...this.dateRange2 }, // Create a copy to avoid reference issues
      reportStatusFilter: [], // Backwards compatibility
      reportMerchandiserFilter: [], // Backwards compatibility
      reportFilialenFilter: [], // Backwards compatibility
      genericFilterValues: JSON.parse(JSON.stringify(this.genericFilterValues || {})), // Deep copy
      scrollPosition: this.scrollPosition,
      tableScrollPosition: this.tableScrollPosition,
      mobileListScrollPosition: this.mobileListScrollPosition,
    };
    this.allEntriesStateService.setFilterState(filterState);
  }

  onReportNavigation(): void {
    this.captureCurrentScrollPositions();
    this.saveFilterState();
  }

  // Update filter methods to work with report data
  onProjectSearch(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.projectSearchTerm = target.value.toLowerCase().trim();
    this.applyFilters();
    this.saveFilterState();
  }

  onFilialeSearch(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.filialeSearchTerm = target.value.toLowerCase().trim();
    this.applyFilters();
    this.saveFilterState();
  }

  clearProjectSearch(): void {
    this.projectSearchTerm = '';
    this.applyFilters();
    this.saveFilterState();
  }

  clearFilialeSearch(): void {
    this.filialeSearchTerm = '';
    this.applyFilters();
    this.saveFilterState();
  }

  onRangeSelected(range: { start: Date | null; end: Date | null }) {
    console.log('Selected range:', range);
    this.dateRange2 = range;
    this.applyFilters();
    this.saveFilterState();
  }

  /**
   * Get filtered reports using all filters
   * @param excludeField Optional field to exclude from filtering (for getting unique values)
   * @returns Filtered reports array
   */
  private getFilteredReports(excludeField?: string): Report[] {
    let filtered = [...this.allReports];

    // Apply generic column filters
    Object.keys(this.genericFilterValues).forEach((field) => {
      if (excludeField !== field) {
        const filterValues = this.genericFilterValues[field];
        if (filterValues && Array.isArray(filterValues) && filterValues.length > 0) {
          filtered = filtered.filter((report) => {
            const normalizedValue = this.normalizeColumnFilterValue(this.getReportFieldValue(report, field));
            const wanted = filterValues.map((fv) => this.normalizeColumnFilterValue(fv));
            return wanted.includes(normalizedValue);
          });
        }
      }
    });

    // Apply project-related filters (search in multiple fields)
    if (this.projectSearchTerm) {
      filtered = filtered.filter(
        (report) =>
          report.title?.toLowerCase().includes(this.projectSearchTerm) ||
          report.description?.toLowerCase().includes(this.projectSearchTerm) ||
          this.getStatusDisplayName(report)?.toLowerCase().includes(this.projectSearchTerm) ||
          report.project?.name?.toLowerCase().includes(this.projectSearchTerm) ||
          report.id?.toString().includes(this.projectSearchTerm),
      );
    }

    // Apply filiale filter (search in branch name and address)
    if (this.filialeSearchTerm) {
      filtered = filtered.filter(
        (report) =>
          report.branch?.name?.toLowerCase().includes(this.filialeSearchTerm) ||
          report.street?.toLowerCase().includes(this.filialeSearchTerm) ||
          report.zipCode?.toLowerCase().includes(this.filialeSearchTerm),
      );
    }

    // Apply date range filter (filter by plannedOn)
    if (this.dateRange2.start && this.dateRange2.end) {
      filtered = filtered.filter((report) => {
        if (!report.plannedOn) return false;

        const reportDate = new Date(report.plannedOn);
        const startDate = new Date(this.dateRange2.start!);
        const endDate = new Date(this.dateRange2.end!);

        // Reset time to compare only dates
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        reportDate.setHours(12, 0, 0, 0); // Set to noon to avoid timezone issues

        return reportDate >= startDate && reportDate <= endDate;
      });
    }

    return filtered;
  }

  // Update the applyFilters method for report data (dashboard pattern - simple and clean)
  applyFilters(): void {
    this.reports = this.getFilteredReports();
    console.log('Filtered reports:', this.reports.length, 'out of', this.allReports.length);
    this.refreshMobileFilterSheetState();

    // Save filter state after applying filters
    this.saveFilterState();
  }

  /**
   * Called from filter listbox (onChange). Defers applyFilters so the dropdown doesn't block the UI.
   */
  onFilterSelectionChange(): void {
    setTimeout(() => this.applyFilters(), 0);
  }

  /**
   * Normalize cell values for column filters so empty / placeholder cells map to ''.
   */
  private normalizeColumnFilterValue(value: string | null | undefined): string {
    if (value == null) {
      return '';
    }
    const s = String(value).trim();
    if (s === '' || s === '-') {
      return '';
    }
    return s;
  }

  /** Visible label for listbox options (empty value → Leer). */
  private columnFilterOptionLabel(value: string): string {
    return this.normalizeColumnFilterValue(value) === '' ? '---' : value;
  }

  // Improve the German date parsing
  private parseGermanDate(dateString: string): Date | null {
    try {
      if (!dateString || dateString.trim() === '') return null;

      // Handle German date format DD.MM.YYYY
      const parts = dateString.trim().split('.');
      if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1; // Month is 0-based in JavaScript
        const year = parseInt(parts[2], 10);

        // Validate the date parts
        if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
        if (day < 1 || day > 31 || month < 0 || month > 11 || year < 1900 || year > 2100) return null;

        return new Date(year, month, day);
      }
      return null;
    } catch (error) {
      console.error('Error parsing date:', dateString, error);
      return null;
    }
  }

  /**
   * Check if any column filters are active
   */
  hasColumnFilters(): boolean {
    // Check generic filters
    if (this.genericFilterValues) {
      const hasGenericFilters = Object.values(this.genericFilterValues).some((filterValues) => filterValues && Array.isArray(filterValues) && filterValues.length > 0);
      if (hasGenericFilters) {
        return true;
      }
    }

    return false;
  }

  // Clear all filters
  clearFilters(): void {
    this.projectSearchTerm = '';
    this.filialeSearchTerm = '';
    this.dateRange2 = { start: null, end: null };

    // Clear column filters
    this.genericFilterValues = {};

    // Reset filtered reports to show all
    this.reports = [...this.allReports];
    this.applyFilters();
    this.saveFilterState();
  }

  toggleMobileFilters(): void {
    this.mobileFiltersExpanded = !this.mobileFiltersExpanded;
  }

  openMobileFilterSheet(): void {
    this.refreshMobileFilterSheetState();
    this.showMobileFilterSheet = true;
  }

  private refreshMobileFilterSheetState(): void {
    this.mobileFilterColumns = this.cols.map((col) => ({ field: col.field, header: col.header }));
    this.mobileFilterValues = { ...this.genericFilterValues };

    const nextOptions: { [field: string]: MobileFilterOption[] } = {};
    const nextCanFilter: { [field: string]: boolean } = {};

    this.mobileFilterColumns.forEach((col) => {
      const options =
        col.field === 'status'
          ? this.getStatusFilterOptions()
          : this.getFilterOptions(col.field).map((val) => ({
              label: this.columnFilterOptionLabel(val),
              value: val,
            }));
      nextOptions[col.field] = options;
      nextCanFilter[col.field] = this.canFilterColumn(col.field);
    });

    this.mobileFilterColumnOptions = nextOptions;
    this.mobileFilterCanFilterMap = nextCanFilter;
  }

  onMobileFilterChanged(event: { field: string; values: string[] }): void {
    this.genericFilterValues[event.field] = event.values;
    this.mobileFilterValues = { ...this.mobileFilterValues, [event.field]: event.values };
    this.applyFilters();
  }

  onMobileFilterCleared(): void {
    this.genericFilterValues = {};
    this.mobileFilterValues = {};
    this.applyFilters();
  }

  getTotalMobileActiveFilters(): number {
    return Object.values(this.genericFilterValues).reduce((sum, arr) => sum + (arr?.length || 0), 0);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target) {
      return;
    }

    const isInsideOverlay = target.closest('.p-popover') !== null || target.closest('.p-dialog') !== null || target.closest('.p-multiselect-panel') !== null || target.closest('.p-listbox') !== null;

    if (!isInsideOverlay) {
      this.closeAllFilterPopovers();
      this.closeSettingsPopover();
    }
  }

  // Sorting state
  sortField: string = '';
  sortDirection: 'asc' | 'desc' = 'asc';

  // Add methods that match client-details functionality
  onSort(field: string): void {
    console.log(`Sorting by ${field}`, this.sortField, this.sortDirection);

    // Toggle sort direction for the field
    if (this.sortField === field) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortDirection = 'asc';
    }

    console.log(`New sort: ${this.sortField} ${this.sortDirection}`);

    // Sort the reports array
    this.reports.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      // Handle special cases based on how they're displayed in the template
      if (field === 'status') {
        // Sort by the status value that is displayed in the table
        aValue = this.getStatusDisplayName(a);
        bValue = this.getStatusDisplayName(b);
        console.log(`Status sorting: ${aValue} vs ${bValue}`);
      } else if (field === 'feedback') {
        // Sort by the displayed text (Ja, Nein)
        aValue = a.feedback === 'true' || a.feedback === '1' ? 'Ja' : 'Nein';
        bValue = b.feedback === 'true' || b.feedback === '1' ? 'Ja' : 'Nein';
        console.log(`Feedback sorting: ${aValue} vs ${bValue}`);
      } else if (field === 'plannedOn') {
        // Sort by date
        aValue = a.plannedOn ? new Date(a.plannedOn).getTime() : 0;
        bValue = b.plannedOn ? new Date(b.plannedOn).getTime() : 0;
        console.log(`PlannedOn sorting: ${aValue} vs ${bValue}`);
      } else if (field === 'merchandiser.user.firstName') {
        // Sort by merchandiser name (first + last)
        aValue = `${a.merchandiser?.user?.firstName || ''} ${a.merchandiser?.user?.lastName || ''}`.trim();
        bValue = `${b.merchandiser?.user?.firstName || ''} ${b.merchandiser?.user?.lastName || ''}`.trim();
      } else if (field === 'branch.name') {
        // Sort by branch name
        aValue = a.branch?.name || '';
        bValue = b.branch?.name || '';
        console.log(`Branch sorting: ${aValue} vs ${bValue}`);
      } else if (field === 'branch.client.name') {
        // Sort by client (customer) name
        aValue = a.branch?.client?.name || '';
        bValue = b.branch?.client?.name || '';
      } else if (field === 'project.name') {
        // Sort by project name
        aValue = a.project?.name || '';
        bValue = b.project?.name || '';
      } else {
        // Default: use the raw field value
        aValue = a[field as keyof Report];
        bValue = b[field as keyof Report];
        console.log(`${field} sorting: ${aValue} vs ${bValue}`);
      }

      // Handle string comparison
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (aValue < bValue) {
        return this.sortDirection === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return this.sortDirection === 'asc' ? 1 : -1;
      }
      return 0;
    });

    // Also sort the allReports to maintain consistency
    this.allReports.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      // Handle special cases based on how they're displayed in the template
      if (field === 'status') {
        // Sort by the status value that is displayed in the table
        aValue = this.getStatusDisplayName(a);
        bValue = this.getStatusDisplayName(b);
      } else if (field === 'feedback') {
        // Sort by the displayed text (Ja, Nein)
        aValue = a.feedback === 'true' ? 'Ja' : 'Nein';
        bValue = b.feedback === 'true' ? 'Ja' : 'Nein';
      } else if (field === 'plannedOn') {
        // Sort by date
        aValue = a.plannedOn ? new Date(a.plannedOn).getTime() : 0;
        bValue = b.plannedOn ? new Date(b.plannedOn).getTime() : 0;
      } else if (field === 'merchandiser.user.firstName') {
        // Sort by merchandiser name (first + last)
        aValue = `${a.merchandiser?.user?.firstName || ''} ${a.merchandiser?.user?.lastName || ''}`.trim();
        bValue = `${b.merchandiser?.user?.firstName || ''} ${b.merchandiser?.user?.lastName || ''}`.trim();
      } else if (field === 'branch.name') {
        // Sort by branch name
        aValue = a.branch?.name || '';
        bValue = b.branch?.name || '';
      } else if (field === 'branch.client.name') {
        // Sort by client (customer) name
        aValue = a.branch?.client?.name || '';
        bValue = b.branch?.client?.name || '';
      } else if (field === 'project.name') {
        // Sort by project name
        aValue = a.project?.name || '';
        bValue = b.project?.name || '';
      } else {
        // Default: use the raw field value
        aValue = a[field as keyof Report];
        bValue = b[field as keyof Report];
      }

      // Handle string comparison
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (aValue < bValue) {
        return this.sortDirection === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return this.sortDirection === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }

  onFavoriteChanged(isFavorite: boolean, report: Report): void {
    report.isFavorite = isFavorite;
    console.log(`Report ${report.title} favorite status: ${isFavorite}`);

    // Call API to update favorite status
    this.reportService.toggleFavoriteStatus(report.id).subscribe({
      next: (response) => {
        console.log('Favorite status updated:', response);
        this._toast.success(response.message || (isFavorite ? 'Zu Favoriten hinzugefügt' : 'Aus Favoriten entfernt'), {
          position: 'bottom-right',
          duration: 2000,
        });
      },
      error: (error) => {
        console.error('Error updating favorite status:', error);
        // Revert the change on error
        report.isFavorite = !isFavorite;

        this._toast.error('Status konnte nicht aktualisiert werden', {
          position: 'bottom-right',
          duration: 3000,
        });
      },
    });
  }

  getStatusStyle(status: any): { bg: string; text: string } {
    // Handle both old string format and new object format
    const statusName = typeof status === 'string' ? status : status?.name;
    const statusColor = typeof status === 'object' && status?.color ? status.color : null;

    // If we have a color from the API, use it
    if (statusColor) {
      return { bg: statusColor, text: statusName };
    }

    // Fallback to predefined colors based on status name
    switch (statusName?.toUpperCase()) {
      case 'PENDING':
        return { bg: 'bg-[#9E9E9E]', text: 'PENDING' };
      case 'SCHEDULED':
        return { bg: 'bg-[#00709B]', text: 'SCHEDULED' };
      case 'SUBMITTED':
        return { bg: 'bg-[#CCAF08]', text: 'SUBMITTED' };
      case 'APPROVED':
        return { bg: 'bg-[#6FCC08]', text: 'APPROVED' };
      case 'VIEWED':
        return { bg: 'bg-[#6FCC08]', text: 'VIEWED' };
      default:
        return { bg: 'bg-gray-400', text: statusName };
    }
  }

  // Also make sure you have filteredReports property
  get filteredReports() {
    return this.reports;
  }

  /**
   * Get filter options for a specific field (dashboard pattern - compute on-demand)
   */
  getFilterOptions(field: string): string[] {
    const values = new Set<string>();
    const filteredReports = this.getFilteredReports(field); // Exclude this field from filtering

    filteredReports.forEach((report) => {
      const value = this.getReportFieldValue(report, field);
      values.add(this.normalizeColumnFilterValue(value));
    });

    // Keep selected values visible even if currently not present
    // in the filtered source due to other active filters.
    (this.genericFilterValues[field] || []).forEach((selectedValue) => {
      values.add(this.normalizeColumnFilterValue(selectedValue ?? ''));
    });

    return Array.from(values).sort();
  }

  private getStatusFilterOptions(): FilterOption[] {
    const statusMap = new Map<string, FilterOption>();
    const filteredReports = this.getFilteredReports('status');

    filteredReports.forEach((report) => {
      const displayValue = this.normalizeColumnFilterValue(this.getStatusDisplayName(report));
      if (!statusMap.has(displayValue)) {
        statusMap.set(displayValue, {
          label: this.columnFilterOptionLabel(displayValue),
          value: displayValue,
          color: displayValue !== '' ? this.getStatusDisplayColor(report) : undefined,
        });
      }
    });

    // Keep selected status values visible even if currently not present
    // in the filtered source due to other active filters.
    (this.genericFilterValues['status'] || []).forEach((selectedValue) => {
      const key = this.normalizeColumnFilterValue(selectedValue ?? '');
      if (!statusMap.has(key)) {
        statusMap.set(key, {
          label: this.columnFilterOptionLabel(key),
          value: key,
        });
      }
    });

    return Array.from(statusMap.values()).sort((a, b) => a.value.localeCompare(b.value));
  }

  /**
   * Check if column can be filtered (dashboard pattern - check if it has any values)
   */
  canFilterColumn(field: string): boolean {
    // If there are selected values, keep filter action available.
    if (this.getColumnFilterValue(field).length > 0) {
      return true;
    }

    if (field === 'status') {
      return this.getStatusFilterOptions().length > 0;
    }

    const options = this.getFilterOptions(field);
    return options && options.length > 0;
  }

  /**
   * Get the value of a report field for filtering
   */
  private getReportFieldValue(report: Report, field: string): string {
    if (field === 'merchandiser') {
      const first = report.merchandiser?.user?.firstName || '';
      const last = report.merchandiser?.user?.lastName || '';
      return `${first} ${last}`.trim();
    }
    if (field === 'branch.name') {
      return report.branch?.name || '';
    }
    if (field === 'branch.client.name') {
      return report.branch?.client?.name || (report as any).clientCompany?.name || '';
    }
    if (field === 'project.name') {
      return report.project?.name || '';
    }
    if (field === 'status') {
      return this.getStatusDisplayName(report);
    }
    if (field === 'feedback') {
      // Handle string values only (feedback is typed as string)
      const feedbackValue = report.feedback;
      if (feedbackValue === 'true' || feedbackValue === '1') {
        return 'Ja';
      }
      return 'Nein';
    }
    if (field === 'plannedOn') {
      // Format date for consistent filtering
      if (report.plannedOn) {
        const date = new Date(report.plannedOn);
        if (!isNaN(date.getTime())) {
          const day = date.getDate().toString().padStart(2, '0');
          const month = (date.getMonth() + 1).toString().padStart(2, '0');
          const year = date.getFullYear();
          return `${day}.${month}.${year}`;
        }
      }
      return '';
    }
    if (field === 'reportTo') {
      // Format date for consistent filtering
      if (report.reportTo) {
        const date = new Date(report.reportTo);
        if (!isNaN(date.getTime())) {
          const day = date.getDate().toString().padStart(2, '0');
          const month = (date.getMonth() + 1).toString().padStart(2, '0');
          const year = date.getFullYear();
          return `${day}.${month}.${year}`;
        }
      }
      return '';
    }
    if (field === 'street') {
      return report.street || '';
    }
    if (field === 'note') {
      return report.note || '';
    }
    // Default: try to get the value directly
    const value = (report as any)[field];
    return value ? String(value) : '';
  }

  /**
   * Get selectable columns
   */
  getSelectableColumns(): Column[] {
    return this.cols;
  }

  getColumnFilterValue(field: string): string[] {
    return this.genericFilterValues[field] || [];
  }

  clearCurrentColumnFilter(): void {
    if (!this.currentFilterField) {
      return;
    }

    this.genericFilterValues[this.currentFilterField] = [];
    this.onFilterSelectionChange();
    this.saveFilterState();
  }

  openColumnFilter(field: string, event: Event): void {
    event.stopPropagation();

    if (!this.canFilterColumn(field)) {
      return;
    }

    // Store the actual DOM element for positioning
    const targetElement = (event.currentTarget || event.target) as HTMLElement;

    if (!targetElement) {
      return;
    }

    // Close settings popover if open
    if (this.activeSettingsPopover) {
      this.activeSettingsPopover.hide();
      this.activeSettingsPopover = null;
    }

    // On mobile: open centered modal instead of popover
    if (this.isMobileColumnFilter()) {
      const isSameField = this.currentFilterField === field;
      if (isSameField && this.showColumnFilterModal) {
        this.closeColumnFilterModal();
        return;
      }
      this.closeColumnFilterModal();
      this.currentFilterField = field;
      // Compute options on-demand (dashboard pattern)
      this.currentGenericOptions =
        field === 'status'
          ? this.getStatusFilterOptions()
          : this.getFilterOptions(field).map((val) => ({
              label: this.columnFilterOptionLabel(val),
              value: val,
            }));
      console.log(`Opening mobile filter for ${field}`, 'Options:', this.currentGenericOptions.length);
      this.showColumnFilterModal = true;
      return;
    }

    // Desktop: popover
    const isSameField = this.currentFilterField === field;
    const isPopoverOpen = this.activeFilterPopover === this.genericFilterPopover;

    if (isSameField && isPopoverOpen) {
      this.closeActiveColumnFilterPopover();
      return;
    }

    this.closeActiveColumnFilterPopover();
    this.currentFilterField = field;
    if (!this.genericFilterValues[field]) {
      this.genericFilterValues[field] = [];
    }
    // Compute options on-demand (dashboard pattern)
    this.currentGenericOptions =
      field === 'status'
        ? this.getStatusFilterOptions()
        : this.getFilterOptions(field).map((val) => ({
            label: this.columnFilterOptionLabel(val),
            value: val,
          }));
    console.log(`Opening filter for ${field}`, {
      optionsCount: this.currentGenericOptions.length,
      actualOptions: this.currentGenericOptions,
      currentFilterField: this.currentFilterField,
    });
    this.showColumnFilterPopover(this.genericFilterPopover, targetElement, 120);
  }

  handleGenericFilterClick(field: string, event: Event): void {
    // Deprecated - kept for backward compatibility, delegates to openColumnFilter
    this.openColumnFilter(field, event);
  }

  openGenericFilter(field: string, event: Event): void {
    // Kept for any direct callers; normal flow uses handleGenericFilterClick
    if (event) {
      event.stopPropagation();
    }
    const targetElement = (event?.currentTarget || event?.target) as HTMLElement;
    this.handleGenericFilterClick(field, { ...event, currentTarget: targetElement, target: targetElement } as Event);
  }

  /**
   * Get generic filter value for a field
   */
  getGenericFilterValue(field: string): string[] {
    return this.genericFilterValues[field] || [];
  }

  /**
   * Get column header for a field
   */
  getColumnHeader(field: string): string {
    const col = this.cols.find((c) => c.field === field);
    return col ? col.header : field;
  }

  isMobileColumnFilter(): boolean {
    return typeof window !== 'undefined' && window.innerWidth < 1024;
  }

  openColumnFilterModal(): void {
    this.showColumnFilterModal = true;
  }

  closeColumnFilterModal(): void {
    this.showColumnFilterModal = false;
    this.activeFilterPopover = null;
  }

  getColumnFilterModalTitle(): string {
    if (this.currentFilterField === 'status') {
      return this.getColumnHeader('status');
    }
    if (this.currentFilterField) {
      return this.getColumnHeader(this.currentFilterField);
    }
    return 'Filter';
  }

  /** Options for modal listbox (label/value shape) */
  getCurrentGenericOptionsForModal(): { label: string; value: string }[] {
    // currentGenericOptions is already in {label, value} format
    return this.currentGenericOptions || [];
  }

  /**
   * Open status filter popover
   */
  openStatusFilter(event: Event): void {
    event.stopPropagation();
    // Simply use the generic column filter
    this.openColumnFilter('status', event);
  }

  /**
   * Open merchandiser filter popover
   */
  openMerchandiserFilter(event: Event): void {
    event.stopPropagation();

    // Simply use the generic column filter
    this.openColumnFilter('merchandiser', event);
  }

  /**
   * Open plannedOn filter popover
   */
  openPlannedOnFilter(event: Event): void {
    event.stopPropagation();
    // Simply use the generic column filter
    this.openColumnFilter('plannedOn', event);
  }

  /**
   * Open reportTo filter popover
   */
  openReportToFilter(event: Event): void {
    event.stopPropagation();
    // Simply use the generic column filter
    this.openColumnFilter('reportTo', event);
  }

  /**
   * Open feedback filter popover
   */
  openFeedbackFilter(event: Event): void {
    event.stopPropagation();
    // Simply use the generic column filter
    this.openColumnFilter('feedback', event);
  }

  /**
   * Open filialen filter popover
   */
  openFilialenFilter(event: Event): void {
    event.stopPropagation();

    // Simply use the generic column filter
    this.openColumnFilter('branch.name', event);
  }

  /**
   * Toggle settings popover
   */
  toggleSettingsPopover(event: Event): void {
    event.stopPropagation();

    // Get the div element (currentTarget) not the inner element (target)
    const targetElement = event.currentTarget as HTMLElement;

    if (!targetElement || !this.columnsPopover) {
      return;
    }

    // Close any open filter popover when opening settings
    this.closeAllFilterPopovers();

    // Check if the same popover is already open
    const isPopoverOpen = this.activeSettingsPopover === this.columnsPopover;

    // If clicking on the same settings that's already open, just close it
    if (isPopoverOpen) {
      this.columnsPopover.hide();
      this.activeSettingsPopover = null;
      return;
    }

    // Show settings popover using helper (but track as settings not filter)
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

    this.columnsPopover.hide();
    this.activeSettingsPopover = null;

    this.columnFilterPopoverTimeout = setTimeout(() => {
      this.columnsPopover.show(positioningEvent);
      this.activeSettingsPopover = this.columnsPopover;
    }, 50);
  }

  /**
   * Helper method to show column filter popover (like dashboard)
   */
  private showColumnFilterPopover(popoverRef: any, targetElement: HTMLElement, delay = 120): void {
    console.log('showColumnFilterPopover called', {
      hasPopoverRef: !!popoverRef,
      hasTargetElement: !!targetElement,
      delay,
    });
    if (!popoverRef || !targetElement) {
      console.log('Missing popoverRef or targetElement, aborting');
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
      console.log('About to show popover after delay');
      popoverRef.show(positioningEvent);
      this.activeFilterPopover = popoverRef;
      console.log('Popover shown');
    }, delay);
  }

  /**
   * Close active column filter popover (like dashboard)
   */
  private closeActiveColumnFilterPopover(): void {
    if (this.activeFilterPopover) {
      this.activeFilterPopover.hide();
      this.activeFilterPopover = null;
    }
  }

  /**
   * Close all filter popovers
   */
  private closeAllFilterPopovers(): void {
    if (this.statusFilterPopover) {
      this.statusFilterPopover.hide();
    }
    if (this.merchandiserFilterPopover) {
      this.merchandiserFilterPopover.hide();
    }
    if (this.filialenFilterPopover) {
      this.filialenFilterPopover.hide();
    }
    if (this.genericFilterPopover) {
      this.genericFilterPopover.hide();
    }
    this.activeFilterPopover = null;
  }

  /**
   * Close settings popover
   */
  private closeSettingsPopover(): void {
    if (this.activeSettingsPopover) {
      this.activeSettingsPopover.hide();
      this.activeSettingsPopover = null;
    }
  }

  /**
   * Handle popover close events to reset active popover state
   */
  onGenericFilterPopoverClose(): void {
    // Handle closing for all generic-style filter popovers
    if (
      this.activeFilterPopover === this.genericFilterPopover ||
      this.activeFilterPopover === this.statusFilterPopover ||
      this.activeFilterPopover === this.merchandiserFilterPopover ||
      this.activeFilterPopover === this.filialenFilterPopover
    ) {
      this.activeFilterPopover = null;
      this.currentFilterField = '';
    }
  }

  onSettingsPopoverClose(): void {
    if (this.activeSettingsPopover === this.columnsPopover) {
      this.activeSettingsPopover = null;
    }
  }

  /**
   * Handle settings popover show event - auto-open the multiselect dropdown
   */
  onSettingsPopoverShow(): void {
    // Auto-open the multiselect dropdown after a short delay to ensure the popover is fully rendered
    setTimeout(() => {
      if (this.columnsMultiSelect) {
        this.columnsMultiSelect.show();
      }
    }, 100);
  }

  /**
   * Open plannedOn date filter by clicking the date range picker
   */
  openPlannedOnDateFilter(event: Event): void {
    event.stopPropagation();
    // Close any open filter popovers when opening date picker
    this.closeAllFilterPopovers();
    this.closeSettingsPopover();

    console.log('Opening date range picker for plannedOn');

    // Find and click the date range picker element
    setTimeout(() => {
      const datePickerElement = document.querySelector('app-date-range-picker') as HTMLElement;
      if (datePickerElement) {
        const clickableDiv = datePickerElement.querySelector('div.cursor-pointer') as HTMLElement;
        if (clickableDiv) {
          clickableDiv.click();
          console.log('✅ Date picker opened via DOM click');
        } else {
          console.warn('Date picker clickable div not found');
        }
      } else {
        console.warn('Date picker element not found');
      }
    }, 0);
  }
}
