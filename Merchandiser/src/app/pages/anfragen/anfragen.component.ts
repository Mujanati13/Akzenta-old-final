import { Component, OnInit, ViewEncapsulation, ViewChild, HostListener } from '@angular/core';
import { Location } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { ImportsModule } from '@app/shared/imports';
import { AppIconComponent } from '../../shared/app-icon.component';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { TableModule } from 'primeng/table';
import { FavoriteToggleComponent } from '@app/shared/components/favorite-toggle/favorite-toggle.component';
import { MultiSelectModule } from 'primeng/multiselect';
import { PopoverModule } from 'primeng/popover';
import { DialogModule } from 'primeng/dialog';
import { DateRangePickerComponent } from '../../shared/components/date-range-picker/date-range-picker.component';
import { TableRowCollapseEvent, TableRowExpandEvent } from 'primeng/table';
import { AssignedReportsService, AssignedProject, AssignedReport } from '@app/@core/services/assigned-reports.service';
import { ProjectService } from '@app/@core/services/project.service';
import { ReportService } from '@app/@core/services/report.service';
import { AnfragenStateService } from './anfragen-state.service';
import { catchError, of } from 'rxjs';
import { Store } from '@ngrx/store';
import * as AppDataSelectors from '@app/@core/store/app-data/app-data.selectors';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { HotToastService } from '@ngneat/hot-toast';
import { ConfirmationDialogComponent } from '@app/shared/components/confirmation-dialog/confirmation-dialog.component';
import { ColumnFilterDialogComponent } from '@app/shared/components/column-filter-dialog/column-filter-dialog.component';
import { ColumnFilterPopoverComponent } from '@app/shared/components/column-filter-popover/column-filter-popover.component';
import { MobileFilterSheetComponent } from '@app/shared/components/mobile-filter-sheet/mobile-filter-sheet.component';

interface Project {
  id?: string;
  clientId?: string;
  clientName?: string;
  name?: string;
  zeitraum?: string;
  calendarWeek?: string;
  isFavorite?: boolean;
  orders?: Order[];
  slug?: string;
}

interface Order {
  id?: string;
  status?: string;
  geplant?: string;
  merchandiser?: string;
  filiale?: string;
  adresse?: string;
  notiz?: string;
  kunde?: string;
  reportBis?: string;
  feedback?: boolean;
  isFavorite?: boolean;
}

interface Column {
  field: string;
  header: string;
}

@Component({
  selector: 'app-anfragen',
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
    PopoverModule,
    DialogModule,
    DateRangePickerComponent,
    ConfirmationDialogComponent,
    ColumnFilterDialogComponent,
    ColumnFilterPopoverComponent,
    MobileFilterSheetComponent,
  ],
  templateUrl: './anfragen.component.html',
  styleUrl: './anfragen.component.scss',
  encapsulation: ViewEncapsulation.None,
})
@UntilDestroy({ checkProperties: true })
export class AnfragenComponent implements OnInit {
  projects!: Project[];
  allProjects!: Project[]; // Store original unfiltered data
  selectedProject!: Project | null;
  cols!: Column[];
  selectedColumns!: Column[];
  dateRange2 = { start: null, end: null };

  // Add filter properties
  projectSearchTerm: string = '';
  filialeSearchTerm: string = '';
  /** Mobile: bottom sheet for Suche + column filters */
  showAnfragenMobileFilters = false;
  anfragenMobileColumns: { field: string; header: string }[] = [];
  anfragenMobileFilterValues: { [key: string]: string[] } = {};
  anfragenMobileColumnOptions: { [key: string]: { label: string; value: string }[] } = {};
  anfragenMobileCanFilterMap: { [key: string]: boolean } = {};

  // Add these new properties for nested table columns
  orderCols!: Column[];
  selectedOrderColumns!: Column[];

  // Add these properties for sorting
  projectSortField: string = '';
  projectSortOrder: number = 1;
  orderSortField: string = '';
  orderSortOrder: number = 1;

  // Add ordered columns properties
  projectsOrderedColumns: Column[] = [];
  ordersOrderedColumns: Column[] = [];

  // Add these properties to track visible columns
  projectsVisibleColumns: { [key: string]: boolean } = {};
  ordersVisibleColumns: { [key: string]: boolean } = {};

  // Project column filter properties
  projectColumnFilters: { [key: string]: string[] } = {
    name: [],
    clientName: [],
    formattedZeitraum: [],
  };

  // Order column filter properties
  orderColumnFilters: { [key: string]: string[] } = {
    kunde: [],
    merchandiser: [],
    filiale: [],
    adresse: [],
    notiz: [],
  };

  // Cached options for listbox
  currentProjectColumnOptions: { label: string; value: string }[] = [];
  currentOrderColumnOptions: { label: string; value: string }[] = [];

  // Track current project filter field for popovers
  currentProjectFilterField: string = '';
  currentOrderFilterField: string = '';

  // Mobile column filter modal (centered dialog on small screens)
  showColumnFilterModal = false;
  columnFilterModalType: 'project' | 'order' | null = null;

  @ViewChild('projectColumnFilterPopover') projectColumnFilterPopover: any;
  @ViewChild('orderColumnFilterPopover') orderColumnFilterPopover: any;

  // Add loading and error states
  loading: boolean = true;
  downloadingExcel: { [projectId: string | number]: boolean } = {};
  error: boolean = false;
  currentUserName: string = 'Current User';

  // Success modal for accepted Anfrage
  successModalVisible: boolean = false;
  acceptedReportId: number | null = null;
  acceptedProjectId: number | null = null;
  acceptedClientId: number | null = null;

  // Modals for rejection
  confirmRejectModalVisible: boolean = false;
  rejectSuccessModalVisible: boolean = false;
  orderToReject: Order | null = null;
  projectToReject: Project | null = null;

  constructor(
    private router: Router,
    private assignedReportsService: AssignedReportsService,
    private projectService: ProjectService,
    private reportService: ReportService,
    private anfragenStateService: AnfragenStateService,
    private store: Store,
    private location: Location,
    private _toast: HotToastService,
  ) {}

  goBack(): void {
    this.location.back();
  }

  ngOnInit(): void {
    this.loadCurrentUserName();

    // Try to restore from cache first
    const cachedData = this.anfragenStateService.getAnfragenDataSnapshot();
    if (cachedData && this.anfragenStateService.isCacheValid()) {
      console.log('✅ Restoring anfragen data from cache');
      this.projects = cachedData.projects || [];
      this.allProjects = [...this.projects];
      this.loading = false;

      // Load fresh data in background (without showing loader)
      this.loadAssignedReports({ showLoader: false });
    } else {
      // No valid cache, load from server with loader
      console.log('🔄 No cache found, loading anfragen from server');
      this.loadAssignedReports({ showLoader: true });
    }

    this.initializeColumns();
  }

  /**
   * Load current user name from store
   */
  private loadCurrentUserName(): void {
    this.store
      .select(AppDataSelectors.selectUserDisplayName)
      .pipe(untilDestroyed(this))
      .subscribe((name) => {
        this.currentUserName = name;
        console.log('👤 Current user name loaded:', this.currentUserName);
      });
  }

  /**
   * Load assigned reports from API
   */
  private loadAssignedReports(options: { showLoader: boolean } = { showLoader: true }): void {
    if (options.showLoader) {
      this.loading = true;
    }
    this.error = false;

    this.assignedReportsService
      .getAssignedReports()
      .pipe(
        untilDestroyed(this),
        catchError((error) => {
          console.error('Error loading assigned reports:', error);
          this.error = true;
          if (options.showLoader) {
            this.loading = false;
          }
          return of([]);
        }),
      )
      .subscribe({
        next: (data) => {
          console.log('🔄 Raw assigned reports data:', data);
          this.projects = this.transformAssignedProjectsToProjects(data);
          this.allProjects = [...this.projects]; // Store original unfiltered data

          // Save to store
          this.anfragenStateService.setAnfragenData(this.projects);

          console.log('✅ Transformed projects:', this.projects);
          if (options.showLoader) {
            this.loading = false;
          }
        },
        error: () => {
          if (options.showLoader) {
            this.loading = false;
          }
        },
      });
  }

  /**
   * Transform API assigned projects to Project interface
   */
  private transformAssignedProjectsToProjects(assignedProjects: AssignedProject[]): Project[] {
    return assignedProjects.map((assignedProject) => {
      const startDate = new Date(assignedProject.project.startDate);
      const endDate = new Date(assignedProject.project.endDate);

      // Generate date range string
      const dateRange = `${startDate.getDate().toString().padStart(2, '0')}.${(startDate.getMonth() + 1).toString().padStart(2, '0')}.${startDate.getFullYear()} - ${endDate.getDate().toString().padStart(2, '0')}.${(endDate.getMonth() + 1).toString().padStart(2, '0')}.${endDate.getFullYear()}`;

      // Generate week number
      const weekNumber = `KW ${this.getWeekNumber(startDate)}`;

      // Generate slug from name
      const slug = assignedProject.project.name
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');

      // Transform reports to orders, passing clientCompany name for fallback
      const clientCompanyName = assignedProject.project.clientCompany?.name;
      const orders = assignedProject.reports.map((report) => this.transformReportToOrder(report, clientCompanyName));

      return {
        id: assignedProject.project.id.toString(),
        clientId: assignedProject.project.clientCompany?.id?.toString() ?? '0',
        clientName: clientCompanyName || '-',
        name: assignedProject.project.name,
        zeitraum: dateRange,
        calendarWeek: weekNumber,
        isFavorite: (assignedProject as any).project?.isFavorite ?? false,
        slug,
        orders,
      };
    });
  }

  /**
   * Transform API report to Order interface
   */
  private transformReportToOrder(report: AssignedReport, clientCompanyName?: string): Order {
    return {
      id: report.id.toString(),
      status: report.status.name.toUpperCase(),
      geplant: new Date(report.plannedOn).toLocaleDateString('de-DE'),
      merchandiser: this.currentUserName, // Use current user name from store
      filiale: report.branch.name,
      adresse: this.formatReportAddress(report),
      notiz: report.note,
      kunde: report.branch?.client?.name || clientCompanyName || '-',
      reportBis: new Date(report.reportTo).toLocaleDateString('de-DE'),
      feedback: report.feedback === 'true',
      isFavorite: false, // Default to false
    };
  }

  /**
   * Get week number for a date
   */
  private getWeekNumber(date: Date): number {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  }

  private initializeColumns(): void {
    // Initialize project columns - only zeitraum
    this.cols = [
      { field: 'clientName', header: 'Kunde' },
      { field: 'formattedZeitraum', header: 'Zeitraum' },
    ];
    this.selectedColumns = [...this.cols];

    // Initialize order columns (same as client-detail)
    this.orderCols = [
      { field: 'kunde', header: 'Kunde' },
      { field: 'merchandiser', header: 'Merchandiser' },
      { field: 'filiale', header: 'Filiale' },
      { field: 'adresse', header: 'Adresse' },
      { field: 'notiz', header: 'Notiz' },
    ];
    this.selectedOrderColumns = [...this.orderCols];

    // Initialize ordered columns
    this.projectsOrderedColumns = [...this.cols];
    this.ordersOrderedColumns = [...this.orderCols];

    // Set all columns to visible by default
    this.initializeVisibleColumns();
  }

  initializeVisibleColumns() {
    // Set all project columns to visible by default
    this.cols.forEach((col) => {
      this.projectsVisibleColumns[col.field] = true;
    });

    // Set all order columns to visible by default
    this.orderCols.forEach((col) => {
      this.ordersVisibleColumns[col.field] = true;
    });
  }

  // Add filter methods
  onProjectSearch(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.projectSearchTerm = target.value.toLowerCase().trim();
    this.applyFilters();
  }

  onFilialeSearch(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.filialeSearchTerm = target.value.toLowerCase().trim();
    this.applyFilters();
  }

  onRangeSelected(range: { start: Date | null; end: Date | null }) {
    console.log('Selected range:', range);
    this.dateRange2 = range;
    this.applyFilters();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target) {
      return;
    }

    const isInsideOverlay =
      target.closest('.p-popover') !== null ||
      target.closest('.p-dialog') !== null ||
      target.closest('.p-multiselect-panel') !== null ||
      target.closest('.p-listbox') !== null ||
      target.closest('.mobile-filter-sheet') !== null ||
      target.closest('.mobile-filter-sheet-backdrop') !== null;

    if (!isInsideOverlay) {
      this.projectColumnFilterPopover?.hide();
      this.orderColumnFilterPopover?.hide();
    }
  }

  getFilteredProjectsData(excludeField?: string): Project[] {
    let filteredProjects = [...this.allProjects];

    // Apply project name filter
    if (this.projectSearchTerm) {
      filteredProjects = filteredProjects.filter(
        (project) =>
          project.name?.toLowerCase().includes(this.projectSearchTerm) ||
          project.zeitraum?.toLowerCase().includes(this.projectSearchTerm) ||
          project.calendarWeek?.toLowerCase().includes(this.projectSearchTerm),
      );
    }

    // Apply filiale filter - filter projects that have orders matching the filiale search
    if (this.filialeSearchTerm) {
      filteredProjects = filteredProjects.filter((project) =>
        project.orders?.some(
          (order) =>
            order.filiale?.toLowerCase().includes(this.filialeSearchTerm) ||
            order.merchandiser?.toLowerCase().includes(this.filialeSearchTerm) ||
            order.adresse?.toLowerCase().includes(this.filialeSearchTerm),
        ),
      );

      // Also filter the orders within each project
      filteredProjects = filteredProjects.map((project) => ({
        ...project,
        orders: project.orders?.filter(
          (order) =>
            order.filiale?.toLowerCase().includes(this.filialeSearchTerm) ||
            order.merchandiser?.toLowerCase().includes(this.filialeSearchTerm) ||
            order.adresse?.toLowerCase().includes(this.filialeSearchTerm),
        ),
      }));
    }

    // Apply date range filter
    if (this.dateRange2.start && this.dateRange2.end) {
      filteredProjects = filteredProjects.filter((project) => {
        if (!project.orders || project.orders.length === 0) return false;

        return project.orders.some((order) => {
          if (!order.geplant) return false;

          const orderDate = this.parseGermanDate(order.geplant);
          if (!orderDate) return false;

          return orderDate >= this.dateRange2.start! && orderDate <= this.dateRange2.end!;
        });
      });

      // Also filter orders within projects by date range
      filteredProjects = filteredProjects.map((project) => ({
        ...project,
        orders: project.orders?.filter((order) => {
          if (!order.geplant) return false;

          const orderDate = this.parseGermanDate(order.geplant);
          if (!orderDate) return false;

          return orderDate >= this.dateRange2.start! && orderDate <= this.dateRange2.end!;
        }),
      }));
    }

    // Apply column filters
    filteredProjects = filteredProjects.filter((project) => {
      // Column filter: name (Projekt)
      if (excludeField !== 'name' && this.projectColumnFilters['name'].length > 0 && !this.projectColumnFilters['name'].includes(project.name || '')) {
        return false;
      }

      // Column filter: clientName (Kunde)
      const clientNameValue = project.clientName || '';
      if (excludeField !== 'clientName' && this.projectColumnFilters['clientName'].length > 0 && !this.projectColumnFilters['clientName'].includes(clientNameValue)) {
        return false;
      }

      // Column filter: formattedZeitraum (Zeitraum)
      const zeitraumValue = project.zeitraum || '';
      if (excludeField !== 'formattedZeitraum' && this.projectColumnFilters['formattedZeitraum'].length > 0 && !this.projectColumnFilters['formattedZeitraum'].includes(zeitraumValue)) {
        return false;
      }

      return true;
    });

    // Apply Order column filters
    if (this.hasOrderColumnFilters()) {
      filteredProjects = filteredProjects.map((project) => {
        if (!project.orders) return project;

        const filteredOrders = project.orders.filter((order) => {
          for (const field of Object.keys(this.orderColumnFilters)) {
            if (field === excludeField) continue;

            const filterValues = this.orderColumnFilters[field];
            if (filterValues.length > 0) {
              let orderValue = '';
              if (field === 'feedback') {
                orderValue = order[field as keyof Order] ? '1' : '0';
              } else {
                orderValue = (order as any)[field]?.toString() || '';
              }

              if (!filterValues.includes(orderValue)) {
                return false;
              }
            }
          }
          return true;
        });

        return { ...project, orders: filteredOrders };
      });

      // Filter out projects with no orders left after filtering
      filteredProjects = filteredProjects.filter((project) => project.orders && project.orders.length > 0);
    }

    return filteredProjects;
  }

  applyFilters(): void {
    this.projects = this.getFilteredProjectsData();
    this.refreshAnfragenMobileFilterSheetState();
  }

  /**
   * Keep all in-memory representations in sync after order actions.
   * This prevents removed orders from reappearing when restoring cached page state.
   */
  private removeOrderFromState(projectId?: string, orderId?: string): void {
    if (!projectId || !orderId) {
      return;
    }

    // Update source data first (used by filtering and cache)
    this.allProjects = (this.allProjects || [])
      .map((project) => {
        if (project.id !== projectId) {
          return project;
        }

        const nextOrders = (project.orders || []).filter((existingOrder) => existingOrder.id !== orderId);
        return { ...project, orders: nextOrders };
      })
      .filter((project) => (project.orders?.length || 0) > 0);

    // Re-apply filters to update rendered list consistently
    this.applyFilters();

    // Persist fresh state so navigation restore never shows stale removed orders
    this.anfragenStateService.setAnfragenData(this.allProjects);
  }

  private parseGermanDate(dateString: string): Date | null {
    try {
      // Handle German date format DD.MM.YYYY
      const parts = dateString.split('.');
      if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1; // Month is 0-based in JavaScript
        const year = parseInt(parts[2], 10);
        return new Date(year, month, day);
      }
      return null;
    } catch (error) {
      console.error('Error parsing date:', dateString, error);
      return null;
    }
  }

  // Clear all filters
  clearFilters(): void {
    this.projectSearchTerm = '';
    this.filialeSearchTerm = '';
    this.dateRange2 = { start: null, end: null };
    // Clear project column filters
    this.projectColumnFilters = {
      name: [],
      clientName: [],
      formattedZeitraum: [],
    };
    // Clear order column filters
    this.orderColumnFilters = {
      kunde: [],
      merchandiser: [],
      filiale: [],
      adresse: [],
      notiz: [],
    };
    this.projects = [...this.allProjects];
  }

  // Check if there are any active filters
  hasActiveFilters(): boolean {
    return !!(this.projectSearchTerm || this.filialeSearchTerm || this.dateRange2.start || this.dateRange2.end || this.hasProjectColumnFilters() || this.hasOrderColumnFilters());
  }

  getTotalAnfragenMobileColumnFilters(): number {
    let n = 0;
    Object.values(this.projectColumnFilters || {}).forEach((arr) => {
      n += (arr as string[])?.length || 0;
    });
    Object.values(this.orderColumnFilters || {}).forEach((arr) => {
      n += (arr as string[])?.length || 0;
    });
    return n;
  }

  openAnfragenMobileFilterSheet(): void {
    this.refreshAnfragenMobileFilterSheetState();
    this.showAnfragenMobileFilters = true;
  }

  private refreshAnfragenMobileFilterSheetState(): void {
    this.anfragenMobileColumns = [
      { field: 'name', header: 'Projekt' },
      ...(this.selectedColumns || []).map((c) => ({ field: c.field, header: c.header })),
      ...(this.selectedOrderColumns || []).map((c) => ({ field: c.field, header: c.header })),
    ];

    const nextValues: { [key: string]: string[] } = {};
    const nextOptions: { [key: string]: { label: string; value: string }[] } = {};
    const nextCanFilter: { [key: string]: boolean } = {};

    for (const col of this.anfragenMobileColumns) {
      const field = col.field;
      if (Object.prototype.hasOwnProperty.call(this.projectColumnFilters, field)) {
        nextValues[field] = [...(this.projectColumnFilters[field] || [])];
        nextOptions[field] = this.getUniqueValuesForProjectColumn(field);
        nextCanFilter[field] = (nextOptions[field]?.length || 0) > 0 || nextValues[field].length > 0;
      } else {
        nextValues[field] = [...(this.orderColumnFilters[field] || [])];
        nextOptions[field] = this.getUniqueValuesForOrderColumn(field);
        nextCanFilter[field] = (nextOptions[field]?.length || 0) > 0 || nextValues[field].length > 0;
      }
    }

    this.anfragenMobileFilterValues = nextValues;
    this.anfragenMobileColumnOptions = nextOptions;
    this.anfragenMobileCanFilterMap = nextCanFilter;
  }

  onAnfragenMobileFilterChanged(event: { field: string; values: string[] }): void {
    const f = event.field;
    const v = event.values || [];
    if (Object.prototype.hasOwnProperty.call(this.projectColumnFilters, f)) {
      this.projectColumnFilters[f] = [...v];
    } else {
      this.orderColumnFilters[f] = [...v];
    }
    this.anfragenMobileFilterValues[f] = [...v];
    this.anfragenMobileFilterValues = { ...this.anfragenMobileFilterValues };
    this.applyFilters();
  }

  onAnfragenMobileColumnFiltersCleared(): void {
    this.projectColumnFilters = {
      name: [],
      formattedZeitraum: [],
    };
    this.orderColumnFilters = {
      kunde: [],
      merchandiser: [],
      filiale: [],
      adresse: [],
      notiz: [],
    };
    this.anfragenMobileFilterValues = {};
    this.applyFilters();
  }

  onAnfragenProjectSearchFromSheet(term: string): void {
    this.projectSearchTerm = term.toLowerCase().trim();
    this.applyFilters();
  }

  onAnfragenFilialeSearchFromSheet(term: string): void {
    this.filialeSearchTerm = term.toLowerCase().trim();
    this.applyFilters();
  }

  // Project column filter methods
  getProjectFilterOptions(field: string): string[] {
    const values = new Set<string>();
    const filteredProjects = this.getFilteredProjectsData(field);
    filteredProjects.forEach((project) => {
      let value: string = '';
      switch (field) {
        case 'name':
          value = project.name || '';
          break;
        case 'formattedZeitraum':
          value = project.zeitraum || '';
          break;
      }
      if (value && value !== '-') {
        values.add(value);
      }
    });

    // Keep selected values visible even if currently not present
    // because of other active filters.
    (this.projectColumnFilters[field] || []).forEach((selectedValue) => {
      if (selectedValue) {
        values.add(selectedValue);
      }
    });

    return Array.from(values).sort();
  }

  getProjectColumnFilterValue(field: string): string[] {
    return this.projectColumnFilters[field] || [];
  }

  isMobileColumnFilter(): boolean {
    return typeof window !== 'undefined' && window.innerWidth < 1024;
  }

  openColumnFilterModal(): void {
    this.showColumnFilterModal = true;
  }

  closeColumnFilterModal(): void {
    this.showColumnFilterModal = false;
    this.columnFilterModalType = null;
  }

  getColumnFilterModalTitle(): string {
    if (this.columnFilterModalType === 'project' && this.currentProjectFilterField) {
      return this.getProjectColumnHeader(this.currentProjectFilterField);
    }
    if (this.columnFilterModalType === 'order' && this.currentOrderFilterField) {
      return this.getOrderColumnHeader(this.currentOrderFilterField);
    }
    return 'Filter';
  }

  hasColumnFilterModalSelection(): boolean {
    if (this.columnFilterModalType === 'project' && this.currentProjectFilterField) {
      return (this.projectColumnFilters[this.currentProjectFilterField] || []).length > 0;
    }
    if (this.columnFilterModalType === 'order' && this.currentOrderFilterField) {
      return (this.orderColumnFilters[this.currentOrderFilterField] || []).length > 0;
    }
    return false;
  }

  clearCurrentColumnFilterModal(): void {
    if (this.columnFilterModalType === 'project' && this.currentProjectFilterField) {
      this.projectColumnFilters[this.currentProjectFilterField] = [];
      this.onProjectColumnFilterChange();
      return;
    }
    if (this.columnFilterModalType === 'order' && this.currentOrderFilterField) {
      this.orderColumnFilters[this.currentOrderFilterField] = [];
      this.onOrderColumnFilterChange();
    }
  }

  openProjectColumnFilter(field: string, event: Event): void {
    event.stopPropagation();
    this.currentProjectFilterField = field;
    this.currentProjectColumnOptions = this.getUniqueValuesForProjectColumn(field);

    if (this.isMobileColumnFilter()) {
      const isSameField = this.currentProjectFilterField === field;
      if (isSameField && this.showColumnFilterModal && this.columnFilterModalType === 'project') {
        this.closeColumnFilterModal();
        return;
      }
      this.closeColumnFilterModal();
      this.columnFilterModalType = 'project';
      this.openColumnFilterModal();
      return;
    }

    if (this.projectColumnFilterPopover) {
      this.projectColumnFilterPopover.toggle(event);
    }
  }

  getUniqueValuesForProjectColumn(field: string): { label: string; value: string }[] {
    const values = new Map<string, string>(); // Use Map to store value -> label
    const projectsToUse = this.getFilteredProjectsData(field);

    projectsToUse.forEach((project) => {
      let value = '';
      let label = '';

      if (field === 'formattedZeitraum') {
        value = project.zeitraum || '';
        label = `${project.calendarWeek || ''} ${value}`; // Display calendar week + range
      } else {
        value = (project as any)[field]?.toString() || '';
        label = value;
      }

      if (value) {
        values.set(value, label);
      }
    });

    // Keep selected values visible even if currently not present
    // because of other active filters.
    (this.projectColumnFilters[field] || []).forEach((selectedValue) => {
      if (!selectedValue || values.has(selectedValue)) {
        return;
      }
      values.set(selectedValue, selectedValue);
    });

    // Sort by label for better UX
    return Array.from(values.entries())
      .map(([val, lbl]) => ({ label: lbl, value: val }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  onProjectColumnFilterChange(): void {
    this.applyFilters();
  }

  hasProjectColumnFilters(): boolean {
    return Object.values(this.projectColumnFilters).some((filters) => filters.length > 0);
  }

  // Order column filter methods
  getOrderColumnFilterValue(field: string): string[] {
    return this.orderColumnFilters[field] || [];
  }

  openOrderColumnFilter(field: string, event: Event): void {
    event.stopPropagation();
    this.currentOrderFilterField = field;
    this.currentOrderColumnOptions = this.getUniqueValuesForOrderColumn(field);

    if (this.isMobileColumnFilter()) {
      const isSameField = this.currentOrderFilterField === field;
      if (isSameField && this.showColumnFilterModal && this.columnFilterModalType === 'order') {
        this.closeColumnFilterModal();
        return;
      }
      this.closeColumnFilterModal();
      this.columnFilterModalType = 'order';
      this.openColumnFilterModal();
      return;
    }

    if (this.orderColumnFilterPopover) {
      this.orderColumnFilterPopover.toggle(event);
    }
  }

  getUniqueValuesForOrderColumn(field: string): { label: string; value: string }[] {
    const values = new Map<string, string>(); // Use Map to store value -> label
    // We want to collect unique values for orders from filtered projects
    const projectsToUse = this.getFilteredProjectsData(field);

    projectsToUse.forEach((project) => {
      if (project.orders) {
        project.orders.forEach((order) => {
          let value = '';
          let label = '';

          // Handle special fields if any
          if (field === 'feedback') {
            value = order[field] ? '1' : '0';
            label = order[field] ? 'Ja' : 'Nein';
          } else {
            value = (order as any)[field]?.toString() || '';
            label = value;
          }

          if (value) {
            values.set(value, label);
          }
        });
      }
    });

    // Keep selected values visible even if currently not present
    // because of other active filters.
    (this.orderColumnFilters[field] || []).forEach((selectedValue) => {
      if (!selectedValue || values.has(selectedValue)) {
        return;
      }
      values.set(selectedValue, selectedValue);
    });

    // Sort by label for better UX
    return Array.from(values.entries())
      .map(([val, lbl]) => ({ label: lbl, value: val }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  onOrderColumnFilterChange(): void {
    this.applyFilters();
  }

  hasOrderColumnFilters(): boolean {
    return Object.values(this.orderColumnFilters).some((filters) => filters.length > 0);
  }

  // Get column header for an order field
  getOrderColumnHeader(field: string): string {
    const col = this.orderCols.find((c) => c.field === field);
    return col ? col.header : field;
  }

  // Get column header for a project field
  getProjectColumnHeader(field: string): string {
    if (field === 'name') {
      return 'Projekt';
    }
    const col = this.cols.find((c) => c.field === field);
    return col ? col.header : field;
  }

  // Get placeholder text for project filter
  getProjectFilterPlaceholder(field: string): string {
    const header = this.getProjectColumnHeader(field);
    return `Alle ${header}`;
  }

  // Get visible columns for projects table
  getProjectsVisibleColumns(): Column[] {
    return this.projectsOrderedColumns.filter((col) => this.projectsVisibleColumns[col.field]);
  }

  getProjectsExpandedColspan(): number {
    return 2 + this.getProjectsVisibleColumns().length;
  }

  // Get visible columns for orders table
  getOrdersVisibleColumns(): Column[] {
    return this.ordersOrderedColumns.filter((col) => this.ordersVisibleColumns[col.field]);
  }

  // Handle column reordering for projects table
  onProjectsColReorder(event: any) {
    if (event && typeof event.dragIndex === 'number' && typeof event.dropIndex === 'number') {
      const movedColumn = this.projectsOrderedColumns[event.dragIndex];
      const newOrderedColumns = [...this.projectsOrderedColumns];
      newOrderedColumns.splice(event.dragIndex, 1);
      newOrderedColumns.splice(event.dropIndex, 0, movedColumn);
      this.projectsOrderedColumns = newOrderedColumns;
    }
  }

  // Handle column reordering for orders table
  onOrdersColReorder(event: any) {
    if (event && typeof event.dragIndex === 'number' && typeof event.dropIndex === 'number') {
      const movedColumn = this.ordersOrderedColumns[event.dragIndex];
      const newOrderedColumns = [...this.ordersOrderedColumns];
      newOrderedColumns.splice(event.dragIndex, 1);
      newOrderedColumns.splice(event.dropIndex, 0, movedColumn);
      this.ordersOrderedColumns = newOrderedColumns;
    }
  }

  // Update visible columns for projects
  onProjectsColumnsChange(selectedColumns: Column[]) {
    Object.keys(this.projectsVisibleColumns).forEach((key) => {
      this.projectsVisibleColumns[key] = false;
    });
    selectedColumns.forEach((col) => {
      this.projectsVisibleColumns[col.field] = true;
    });
    this.selectedColumns = selectedColumns;
  }

  // Update visible columns for orders
  onOrdersColumnsChange(selectedColumns: Column[]) {
    Object.keys(this.ordersVisibleColumns).forEach((key) => {
      this.ordersVisibleColumns[key] = false;
    });
    selectedColumns.forEach((col) => {
      this.ordersVisibleColumns[col.field] = true;
    });
    this.selectedOrderColumns = selectedColumns;
  }

  onFavoriteChanged(newStatus: boolean, project: Project): void {
    const previous = project.isFavorite ?? false;
    project.isFavorite = newStatus; // optimistic UI
    if (!project.id) return;
    this.projectService.toggleFavoriteStatus(project.id).subscribe({
      next: (res) => {
        project.isFavorite = res?.isFavorite ?? project.isFavorite;
        this._toast.success(project.isFavorite ? 'Projekt zu Favoriten hinzugefügt' : 'Projekt von Favoriten entfernt', {
          position: 'bottom-right',
          duration: 3000,
        });
      },
      error: () => {
        project.isFavorite = previous; // rollback on error
        this._toast.error('Status konnte nicht aktualisiert werden', {
          position: 'bottom-right',
          duration: 3000,
        });
      },
    });
  }

  onOrderFavoriteChanged(newStatus: boolean, order: Order): void {
    order.isFavorite = newStatus;
    console.log(`Order for ${order.filiale} favorite status: ${newStatus}`);
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

  // Add these new methods for handling sort
  onProjectSort(field: string): void {
    event?.stopPropagation();
    if (this.projectSortField === field) {
      this.projectSortOrder = this.projectSortOrder * -1;
    } else {
      this.projectSortField = field;
      this.projectSortOrder = 1;
    }
    this.sortProjects(field, this.projectSortOrder);
  }

  onOrderSort(field: string, project: Project): void {
    event?.stopPropagation();
    if (this.orderSortField === field) {
      this.orderSortOrder = this.orderSortOrder * -1;
    } else {
      this.orderSortField = field;
      this.orderSortOrder = 1;
    }
    if (project && project.orders) {
      this.sortOrders(project.orders, field, this.orderSortOrder);
    }
  }

  private sortProjects(field: string, order: number): void {
    this.projects.sort((a, b) => {
      const valueA = this.getProjectField(a, field);
      const valueB = this.getProjectField(b, field);

      if (valueA === valueB) return 0;
      if (typeof valueA === 'string' && typeof valueB === 'string') {
        return order * valueA.localeCompare(valueB);
      }
      if (valueA < valueB) return order * -1;
      return order;
    });
  }

  private sortOrders(orders: Order[], field: string, order: number): void {
    orders.sort((a, b) => {
      const valueA = this.getOrderField(a, field);
      const valueB = this.getOrderField(b, field);

      if (valueA === valueB) return 0;
      if (typeof valueA === 'string' && typeof valueB === 'string') {
        return order * valueA.localeCompare(valueB);
      }
      if (valueA < valueB) return order * -1;
      return order;
    });
  }

  private getProjectField(project: Project, field: string): any {
    if (field === 'name') return project.name || '';
    if (field === 'formattedZeitraum') return project.zeitraum || '';
    return project[field as keyof Project] || '';
  }

  private getOrderField(order: Order, field: string): any {
    if (field === 'status') return order.status || '';
    if (field === 'feedback') {
      return order[field] ? 'Ja' : '';
    }
    return order[field as keyof Order] || '';
  }

  // Download Excel for project (previously downloadProjectCsv)
  downloadProjectCsv(project: Project): void {
    if (!project || !project.id) return;

    // Prevent multiple simultaneous downloads for the same project
    if (this.downloadingExcel[project.id]) {
      return;
    }

    console.log('📊 Exporting project reports as Excel:', project);

    // Set loading state
    this.downloadingExcel[project.id] = true;

    this.assignedReportsService.exportProjectReportsAsExcel(project.id).subscribe({
      next: (blob: Blob) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${project.name?.replace(/\s+/g, '_')}_reports_export.xlsx`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);

        // Clear loading state
        this.downloadingExcel[project.id] = false;

        console.log(`Excel exported for project: ${project.name}`);
      },
      error: (error) => {
        console.error('❌ Error exporting Excel:', error);

        // Clear loading state
        this.downloadingExcel[project.id] = false;

        // Check if it's a "no data" error
        if (error.status === 404 && error.error?.error === 'NO_DATA_FOUND') {
          console.warn('Keine Daten in diesem Projekt vorhanden.');
        } else {
          console.error('Excel-Export fehlgeschlagen!');
        }
      },
    });
  }

  // Helper method to escape CSV fields that contain commas, quotes, or newlines
  private escapeCsvField(field: string): string {
    if (!field) return '';

    // If field contains comma, quote, or newline, wrap in quotes and escape internal quotes
    if (field.includes(',') || field.includes('"') || field.includes('\n') || field.includes('\r')) {
      return '"' + field.replace(/"/g, '""') + '"';
    }

    return field;
  }

  // Helper method to format current date for filename
  private formatDateForFilename(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');

    return `${year}-${month}-${day}_${hours}-${minutes}`;
  }

  // Optional: Add method to download all projects as CSV
  downloadAllProjectsCsv(): void {
    if (!this.projects || this.projects.length === 0) {
      console.warn('No projects available for CSV export');
      return;
    }

    // Define CSV headers
    const headers = ['Projekt', 'Zeitraum', 'Kalenderwoche', 'Status', 'Geplant', 'Merchandiser', 'Filiale', 'Adresse', 'Notiz', 'Report bis', 'Feedback', 'Projekt Favorit', 'Order Favorit'];

    const csvRows: string[] = [];
    csvRows.push(headers.join(','));

    // Add data rows for all projects and their orders
    this.projects.forEach((project) => {
      if (project.orders && project.orders.length > 0) {
        project.orders.forEach((order) => {
          const row = [
            this.escapeCsvField(project.name || ''),
            this.escapeCsvField(project.zeitraum || ''),
            this.escapeCsvField(project.calendarWeek || ''),
            this.escapeCsvField(order.status || ''),
            this.escapeCsvField(order.geplant || ''),
            this.escapeCsvField(order.merchandiser || ''),
            this.escapeCsvField(order.filiale || ''),
            this.escapeCsvField(order.adresse || ''),
            this.escapeCsvField(order.notiz || ''),
            this.escapeCsvField(order.reportBis || ''),
            order.feedback ? 'Ja' : 'Nein',
            project.isFavorite ? 'Ja' : 'Nein',
            order.isFavorite ? 'Ja' : 'Nein',
          ];
          csvRows.push(row.join(','));
        });
      } else {
        // Project with no orders
        const row = [
          this.escapeCsvField(project.name || ''),
          this.escapeCsvField(project.zeitraum || ''),
          this.escapeCsvField(project.calendarWeek || ''),
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          project.isFavorite ? 'Ja' : 'Nein',
          '',
        ];
        csvRows.push(row.join(','));
      }
    });

    // Create CSV content
    const csvContent = csvRows.join('\n');

    // Create and download the file
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');

    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `alle_projekte_${this.formatDateForFilename()}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      console.log('All projects CSV exported');
    }
  }

  // Add these methods at the end of the class
  acceptOrder(order: Order, project: Project): void {
    const reportId = Number(order.id);
    if (isNaN(reportId)) {
      console.error('Invalid report ID');
      alert('Ungültige Auftrags-ID');
      return;
    }

    // Validate clientId
    if (!project.clientId || project.clientId === '0') {
      console.error('Invalid or missing client ID for project:', project);
      alert('Fehler: Kunde-ID nicht verfügbar');
      return;
    }

    // Call backend API to accept the report
    this.reportService
      .acceptOrRejectReport(reportId, true)
      .pipe(
        catchError((error) => {
          console.error('Error accepting report:', error);
          alert('Fehler beim Annehmen des Auftrags');
          return of(null);
        }),
      )
      .subscribe((result) => {
        if (result) {
          console.log('✅ Report accepted successfully');
          // Store the IDs for navigation
          this.acceptedReportId = reportId;
          this.acceptedProjectId = Number(project.id);
          this.acceptedClientId = Number(project.clientId);
          // Show success modal
          this.successModalVisible = true;
          // Remove the order from current + source state and refresh cache
          this.removeOrderFromState(project.id, order.id);
        }
      });
  }

  rejectOrder(order: Order, project: Project): void {
    const reportId = Number(order.id);
    if (isNaN(reportId)) {
      console.error('Invalid report ID');
      return;
    }

    // Store order and project for confirmation
    this.orderToReject = order;
    this.projectToReject = project;

    // Show confirmation modal
    this.confirmRejectModalVisible = true;
  }

  confirmReject(): void {
    if (!this.orderToReject || !this.projectToReject) {
      return;
    }

    const reportId = Number(this.orderToReject.id);

    // Close confirmation modal
    this.confirmRejectModalVisible = false;

    // Call backend API to reject the report
    this.reportService
      .acceptOrRejectReport(reportId, false)
      .pipe(
        catchError((error) => {
          console.error('Error rejecting report:', error);
          return of(null);
        }),
      )
      .subscribe((result) => {
        if (result) {
          console.log('✅ Report rejected successfully');
          // Remove the order from current + source state and refresh cache
          this.removeOrderFromState(this.projectToReject?.id, this.orderToReject?.id);
          // Show success modal
          this.rejectSuccessModalVisible = true;
        }

        // Clear stored data
        this.orderToReject = null;
        this.projectToReject = null;
      });
  }

  cancelReject(): void {
    this.confirmRejectModalVisible = false;
    this.orderToReject = null;
    this.projectToReject = null;
  }

  closeRejectSuccessModal(): void {
    this.rejectSuccessModalVisible = false;
  }

  closeModal(): void {
    this.successModalVisible = false;
  }

  goToReport(): void {
    if (this.acceptedReportId && this.acceptedProjectId && this.acceptedClientId) {
      this.successModalVisible = false;
      // Navigate to edit-report page: /clients/{clientId}/projects/{projectId}/edit-report/{reportId}
      this.router.navigate(['/clients', this.acceptedClientId, 'projects', this.acceptedProjectId, 'edit-report', this.acceptedReportId]);
    }
  }

  /**
   * Generate formatted address string for a report
   * Format: STREET + HOUSE NUMBER, ZIP CODE, CITY, COUNTRY
   */
  formatReportAddress(report: any): string {
    if (!report) return '';

    // Street + House Number (already combined in report.street)
    const street = report.street || '';

    // ZIP Code
    const zip = report.zipCode || '';

    // City
    let city = '';
    if (report.branch) {
      if (report.branch.city && report.branch.city.name) {
        city = report.branch.city.name;
      } else {
        city = report.branch.name || '';
      }
    }

    // Country
    let country = '';
    if (report.branch && report.branch.city && report.branch.city.country) {
      const countryObj = report.branch.city.country;
      country = countryObj.name?.de || countryObj.name || '';
    }

    // Format: STREET + HOUSE NUMBER, ZIP CODE, CITY, COUNTRY
    const parts = [street, zip, city, country].filter(Boolean);
    return parts.join(', ');
  }
}
