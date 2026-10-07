import { Component, OnInit, OnDestroy, ViewChild, Renderer2, ChangeDetectorRef, AfterViewInit, AfterViewChecked, HostListener } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { ImportsModule } from '@app/shared/imports';
import { AppIconComponent } from '../../shared/app-icon.component';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, NavigationStart, ActivatedRoute } from '@angular/router';
import { TableModule, Table } from 'primeng/table';
import { Paginator } from 'primeng/paginator';
import { DialogModule } from 'primeng/dialog';
import { FavoriteToggleComponent } from '@app/shared/components/favorite-toggle/favorite-toggle.component';
import { MultiSelectModule } from 'primeng/multiselect';
import { MultiSelect } from 'primeng/multiselect';
import { ListboxModule } from 'primeng/listbox';
import { PopoverModule } from 'primeng/popover';
import { ColumnFilterPopoverComponent } from '@app/shared/components/column-filter-popover/column-filter-popover.component';
import { FilialeMobileFilterSheetComponent, FilialeFilterColumn } from '@app/shared/components/filiale-mobile-filter-sheet/filiale-mobile-filter-sheet.component';
import { MobileFilterBottomSheetComponent, FilterColumn } from '@app/shared/components/mobile-filter-bottom-sheet/mobile-filter-bottom-sheet.component';
import { BranchesService, Branch } from '@core/services/branches.service';
import { ReportService, Report } from '@app/@core/services/report.service';
import { FilialeSuchenStateService, StoredColumn } from './filiale-suchen-state.service';
import { catchError, forkJoin, of, Subject, Subscription } from 'rxjs';
import { distinctUntilChanged, map, skip, takeUntil } from 'rxjs/operators';
import { HotToastService } from '@ngneat/hot-toast';
import { InitializerService } from '@app/core/services/initializer.service';

interface Filiale {
  id: string;
  name: string;
  strasse: string;
  plz: string;
  ort: string;
  phone?: string;
  clientId?: string;
  branchNumber?: string;
  /** IDs of merged duplicate branch records (same location, different DB rows). */
  mergedBranchIds?: string[];
  projekte?: Projekt[];
  /** Precomputed filtered reports (projects) for the nested table — same pattern as client-detail `_filteredReports`. */
  _filteredProjekte?: Projekt[];
}

interface Projekt {
  id: string;
  projectId?: string;
  clientId?: string;
  branchId?: string;
  name: string;
  clientCompany?: {
    name: string;
  };
  kunde?: {
    name: string;
  };
  zeitraum: string;
  calendarWeek: string;
  status: {
    name: string;
    akzenteName?: string;
    color?: string;
  };
  geplant: string;
  filiale: string;
  adresse: string;
  merchandiser?: {
    id?: number;
    user?: { firstName?: string; lastName?: string; email?: string };
  };
  merchandiserName?: string;
  isFavorite: boolean;
}

// Add Column interface
interface Column {
  field: string;
  header: string;
}

const COLUMN_FILTER_EMPTY_LABEL = '--';

type MaybeWithId = { id?: string | number | null };

@Component({
  selector: 'app-filiale-suchen',
  standalone: true,
  imports: [
    TranslateModule,
    ImportsModule,
    AppIconComponent,
    FormsModule,
    CommonModule,
    RouterModule,
    TableModule,
    DialogModule,
    FavoriteToggleComponent,
    MultiSelectModule,
    ListboxModule,
    PopoverModule,
    ColumnFilterPopoverComponent,
    FilialeMobileFilterSheetComponent,
    MobileFilterBottomSheetComponent,
  ],
  templateUrl: './filiale-suchen.component.html',
  styleUrl: './filiale-suchen.component.scss',
})
export class FilialeSuchenComponent implements OnInit, OnDestroy, AfterViewInit, AfterViewChecked {
  // Mobile filter state
  showMobileFilters: boolean = false;
  showFilialeMobileFilter = false;

  // Filiale detail modal state
  selectedFilialeForModal: Filiale | null = null;
  showFilialeModal = false;
  projekteModalSearchQuery = '';
  showProjekteMobileFilter = false;

  // Search functionality
  searchQuery: string = '';
  showAllFiliales: boolean = false;

  // Table state
  expandedRows: { [key: string]: boolean } = {};
  filialen: Filiale[] = [];
  pageSize = 10;
  paginationFirst = 0;
  currentPage = 1;
  totalRecords = 0;
  hasNextPage = false;

  private destroy$ = new Subject<void>();

  // Add column management properties
  filialenCols: Column[] = [];
  selectedFilialenColumns: Column[] = [];
  filialenOrderedColumns: Column[] = [];
  filialenVisibleColumns: { [key: string]: boolean } = {};

  projekteCols: Column[] = [];
  selectedProjekteColumns: Column[] = [];
  projekteOrderedColumns: Column[] = [];
  projekteVisibleColumns: { [key: string]: boolean } = {};

  // Add this property to store all original filialen
  originalFilialen: Filiale[] = [];

  // Sorting state
  sortField: string = '';
  sortDirection: 'asc' | 'desc' = 'asc';
  projektSortField: string = '';
  projektSortDirection: 'asc' | 'desc' = 'asc';

  // Loading state for reports
  loadingReports: { [filialeId: string]: boolean } = {};

  // Loading state for main data
  loading: boolean = false;

  // Column filter properties
  filialenColumnFilterValues: { [field: string]: string[] } = {};
  currentFilialenFilterField: string = '';
  currentFilialenFilterOptions: { label: string; value: string }[] = [];
  /** Column filters per Filiale (each expanded report list has its own filters, like client-detail per project). */
  projekteColumnFiltersByFilialeId: { [filialeId: string]: { [field: string]: string[] } } = {};
  /** @deprecated Legacy flat filters — migrated into projekteColumnFiltersByFilialeId on restore. */
  projekteColumnFilterValues: { [field: string]: string[] } = {};
  currentProjekteFilterField: string = '';
  currentProjekteFilterOptions: { label: string; value: string; color?: string }[] = [];
  selectedFilialeForFilter: Filiale | null = null;

  /** Precomputed when Filialen data/filters change so column filter UI opens without building options on click */
  private filialenColumnFilterOptionsCache: { [field: string]: { label: string; value: string }[] } = {};
  /** Precomputed per branch when projects load or Projekt column filters change */
  private projekteColumnFilterOptionsCache: {
    [filialeId: string]: { [field: string]: { label: string; value: string; color?: string }[] };
  } = {};

  showColumnFilterModal = false;
  columnFilterModalType: 'filialen' | 'projekte' | null = null;

  @ViewChild('filialenColumnFilterPopover') filialenColumnFilterPopover: any;
  @ViewChild('projekteColumnFilterPopover') projekteColumnFilterPopover: any;
  @ViewChild('filialenColumnsPopover') filialenColumnsPopover: any;
  @ViewChild('projekteColumnsPopover') projekteColumnsPopover: any;
  @ViewChild('filialenColumnsMultiSelect') filialenColumnsMultiSelect?: MultiSelect;
  @ViewChild('projekteColumnsMultiSelect') projekteColumnsMultiSelect?: MultiSelect;
  @ViewChild('dt') table!: Table;
  @ViewChild('filialenDesktopPaginator') filialenDesktopPaginator?: Paginator;
  @ViewChild('filialenMobilePaginator') filialenMobilePaginator?: Paginator;

  private filialenPaginatorUnlisteners = new Map<HTMLElement, () => void>();
  private activeColumnFilterPopover: any = null;
  private activeSettingsPopover: any = null;
  private filterPopoverTimeout: any = null;

  private scrollListener: (() => void) | null = null;
  private scrollPosition = 0;
  private pendingMainTableScrollTop: number | null = null;
  private _mainScrollRestoreId = 0;
  private routerSubscription: Subscription | null = null;
  private pendingExpansionId: string | null = null;
  private filialeModalScrollPositionById: { [filialeId: string]: number } = {};

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

  private appendSelectedFilterValuesToMap(valuesMap: Map<string, string>, selectedValues?: string[]): void {
    (selectedValues || []).forEach((selected) => {
      if (!valuesMap.has(selected)) {
        valuesMap.set(selected, '');
      }
    });
  }

  private dedupeById<T extends MaybeWithId>(items: T[] = []): T[] {
    const uniqueItems: T[] = [];
    const seenIds = new Set<string>();

    items.forEach((item) => {
      if (!item) {
        return;
      }

      const rawId = item.id;
      const normalizedId = rawId === null || rawId === undefined ? '' : String(rawId);

      if (!normalizedId) {
        uniqueItems.push(item);
        return;
      }

      if (seenIds.has(normalizedId)) {
        return;
      }

      seenIds.add(normalizedId);
      uniqueItems.push(item);
    });

    return uniqueItems;
  }

  private normalizeIdentityPart(value: string | null | undefined): string {
    return (value ?? '').toString().trim().toLowerCase();
  }

  private getFilialeIdentityKey(filiale: { name: string; strasse: string; plz: string; ort: string; branchNumber?: string }): string {
    const name = this.normalizeIdentityPart(filiale.name);
    const street = this.normalizeIdentityPart(filiale.strasse);
    const plz = this.normalizeIdentityPart(filiale.plz);
    const ort = this.normalizeIdentityPart(filiale.ort);
    const branchNumber = this.normalizeIdentityPart(filiale.branchNumber);

    // Same physical branch may exist once per client in DB — match by number or address, not clientId.
    if (branchNumber) {
      return `bn:${branchNumber}|${name}|${street}|${plz}|${ort}`;
    }

    return `addr:${name}|${street}|${plz}|${ort}`;
  }

  private normalizeFilialenList(filialen: Filiale[]): Filiale[] {
    return this.dedupeFilialenByIdentity(this.dedupeById(filialen));
  }

  private getMerchandiserNameFromReport(report: any): string {
    return this.getProjektMerchandiserName({
      merchandiser: report?.merchandiser,
      merchandiserName: '',
    } as Projekt);
  }

  /** Same logic as client-detail `getReportMerchandiserName`. */
  getProjektMerchandiserName(projekt: Projekt): string {
    if (projekt.merchandiser?.user) {
      const user = projekt.merchandiser.user;
      return [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
    }
    return (projekt.merchandiserName || '').trim();
  }

  private getProjektMerchandiserLabel(projekt: Projekt): string {
    return this.normalizeColumnFilterValue(this.getProjektMerchandiserName(projekt));
  }

  getFilialeProjekteColumnFiltersForSheet(filialeId: string): { [field: string]: string[] } {
    return this.getFilialeProjekteColumnFilters(filialeId);
  }

  private getFilialeProjekteColumnFilters(filialeId: string): { [field: string]: string[] } {
    if (!this.projekteColumnFiltersByFilialeId[filialeId]) {
      this.projekteColumnFiltersByFilialeId[filialeId] = {};
    }
    return this.projekteColumnFiltersByFilialeId[filialeId];
  }

  private ensureFilialeProjekteFilterField(filialeId: string, field: string): void {
    const filters = this.getFilialeProjekteColumnFilters(filialeId);
    if (!filters[field]) {
      filters[field] = [];
    }
  }

  private hasAnyProjekteColumnFilter(filialeId: string): boolean {
    const filters = this.getFilialeProjekteColumnFilters(filialeId);
    return Object.keys(filters).some((key) => Array.isArray(filters[key]) && filters[key].length > 0);
  }

  private dedupeProjekte(projekte: Projekt[]): Projekt[] {
    const byKey = new Map<string, Projekt>();

    projekte.forEach((projekt) => {
      const key = projekt.id ? `r:${projekt.id}` : `p:${projekt.projectId || ''}:${projekt.clientId || ''}`;
      const existing = byKey.get(key);

      if (!existing) {
        byKey.set(key, projekt);
        return;
      }

      if (!this.getProjektMerchandiserLabel(existing) && this.getProjektMerchandiserLabel(projekt)) {
        byKey.set(key, projekt);
      }
    });

    return Array.from(byKey.values());
  }

  private dedupeFilialenByIdentity(filialen: Filiale[]): Filiale[] {
    const byKey = new Map<string, Filiale>();

    filialen.forEach((filiale) => {
      const key = this.getFilialeIdentityKey(filiale);
      const existing = byKey.get(key);

      if (!existing) {
        byKey.set(key, {
          ...filiale,
          mergedBranchIds: [filiale.id],
        });
        return;
      }

      const mergedIds = new Set([...(existing.mergedBranchIds ?? [existing.id]), filiale.id]);
      existing.mergedBranchIds = Array.from(mergedIds);

      const mergedProjekte = this.dedupeProjekte([...(existing.projekte || []), ...(filiale.projekte || [])]);

      if (Number(filiale.id) < Number(existing.id)) {
        byKey.set(key, {
          ...filiale,
          projekte: mergedProjekte,
          mergedBranchIds: existing.mergedBranchIds,
        });
      } else {
        existing.projekte = mergedProjekte.length ? mergedProjekte : existing.projekte;
      }
    });

    return Array.from(byKey.values());
  }

  private getBranchIdsForFiliale(filialeId: string, fallbackBranchId: number): number[] {
    const filiale = this.originalFilialen.find((f) => f.id === filialeId) ?? this.filialen.find((f) => f.id === filialeId);

    const ids = (filiale?.mergedBranchIds ?? [filialeId]).map((id) => parseInt(id, 10)).filter((id) => !isNaN(id));

    if (ids.length === 0) {
      return [fallbackBranchId];
    }

    return [...new Set(ids)];
  }

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private branchesService: BranchesService,
    private reportService: ReportService,
    private filialeSuchenStateService: FilialeSuchenStateService,
    private initializerService: InitializerService,
    private renderer: Renderer2,
    private cd: ChangeDetectorRef,
    private toast: HotToastService,
  ) {
    this.routerSubscription = this.router.events.subscribe((event) => {
      if (event instanceof NavigationStart) {
        this.persistViewState();
      }
    });
  }

  getProjectUrl(projekt: any): string {
    if (projekt?.projectId && projekt?.id) {
      return this.router.serializeUrl(
        this.router.createUrlTree(['/projects', projekt.projectId, 'reports', projekt.id], {
          queryParams: { referrer: 'filiale-suchen' },
        }),
      );
    }
    return '';
  }

  getFilialeUrl(filiale: Filiale): string {
    const urlTree = this.router.createUrlTree([], {
      relativeTo: this.route,
      queryParams: { expanded: filiale.id },
      queryParamsHandling: 'merge',
    });
    return this.router.serializeUrl(urlTree);
  }

  onFilialeClick(event: Event, filiale: Filiale) {
    event.preventDefault();
    if (this.isMobileColumnFilter()) {
      this.openFilialeModal(filiale);
      return;
    }

    const isExpanded = !!this.expandedRows[filiale.id];
    if (isExpanded) {
      this.onRowCollapse({ data: filiale });
      return;
    }

    this.onRowExpand({ data: filiale });
  }

  navigateToProject(event: Event, projekt: any) {
    event.preventDefault();
    if (projekt?.projectId && projekt?.id) {
      this.router.navigate(['/projects', projekt.projectId, 'reports', projekt.id], {
        queryParams: { referrer: 'filiale-suchen' },
      });
    }
  }

  ngOnInit(): void {
    this.initializeColumns();
    this.restoreViewState();

    // Subscribe to view state changes (e.g. triggered by sidebar)
    this.filialeSuchenStateService.filialeSuchenViewState$.pipe(takeUntil(this.destroy$)).subscribe((state) => {
      if (state === null) {
        this.resetFilters();
      }
    });

    const cachedData = this.filialeSuchenStateService.getFilialeSuchenDataSnapshot();
    const hasValidCache = !!(cachedData && this.filialeSuchenStateService.isCacheValid());
    this.loadFilialen({ showLoader: !hasValidCache });

    // Check for expanded query param
    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      if (params['expanded']) {
        this.pendingExpansionId = params['expanded'];
        this.checkPendingExpansion();
      }
    });

    this.initializerService.currentClientCompany$
      .pipe(
        distinctUntilChanged((previous, current) => previous?.id === current?.id),
        skip(1),
        takeUntil(this.destroy$),
      )
      .subscribe(() => {
        this.filialeSuchenStateService.clearCache();
        this.expandedRows = {};
        this.loadFilialen({ showLoader: true });
      });
  }

  private checkPendingExpansion(): void {
    if (this.pendingExpansionId && this.filialen.length > 0) {
      const filiale = this.filialen.find((f) => f.id === this.pendingExpansionId);
      if (filiale) {
        this.onRowExpand({ data: filiale });
        this.pendingExpansionId = null;

        // Scroll to the expanded row after a short delay to allow rendering
        setTimeout(() => {
          const row = document.querySelector(`[data-id="${filiale.id}"]`); // Assuming we add data-id to row or find it otherwise
          // Since we don't have data-id on row easily, we rely on p-table scrolling or just let it be.
          // Or we can try to scroll to the expanded content.
        }, 100);
      }
    }
  }

  ngAfterViewInit(): void {
    this.attachFilialenPaginatorListeners();
    if (!this.loading && this.originalFilialen.length > 0) {
      this.restoreScrollPosition();
    }
  }

  ngAfterViewChecked(): void {
    this.attachFilialenPaginatorListeners();
  }

  ngOnDestroy(): void {
    this.detachFilialenPaginatorListeners();
    if (this.scrollListener) {
      this.scrollListener();
    }
    if (this.routerSubscription) {
      this.routerSubscription.unsubscribe();
    }
    this.persistViewState();
    this.destroy$.next();
    this.destroy$.complete();
  }

  // Initialize column definitions
  initializeColumns(): void {
    // Define columns for the main Filialen table
    this.filialenCols = [
      { field: 'strasse', header: 'Straße' },
      { field: 'plz', header: 'PLZ' },
      { field: 'ort', header: 'Ort' },
      { field: 'phone', header: 'Telefon' },
    ];

    // Set initial selected and ordered columns
    this.selectedFilialenColumns = [...this.filialenCols];
    this.filialenOrderedColumns = [...this.filialenCols];

    // Define columns for the nested Projekte table
    this.projekteCols = [
      { field: 'kunde', header: 'Kunde' },
      { field: 'zeitraum', header: 'Zeitraum' },
      { field: 'status', header: 'Status' },
      { field: 'geplant', header: 'Geplant' },
      { field: 'adresse', header: 'Adresse' },
    ];

    // Set initial selected and ordered columns
    this.selectedProjekteColumns = [...this.projekteCols];
    this.projekteOrderedColumns = [...this.projekteCols];

    // Initialize visible columns
    this.initializeVisibleColumns();
  }

  // Initialize visible columns
  initializeVisibleColumns(): void {
    // Set all filialen columns to visible by default
    this.filialenCols.forEach((col) => {
      this.filialenVisibleColumns[col.field] = true;
    });

    // Set all projekte columns to visible by default
    this.projekteCols.forEach((col) => {
      this.projekteVisibleColumns[col.field] = true;
    });
  }

  // Get visible columns for filialen table
  getFilialenVisibleColumns(): Column[] {
    return this.filialenOrderedColumns.filter((col) => this.filialenVisibleColumns[col.field]);
  }

  // Get visible columns for projekte table
  getProjekteVisibleColumns(): Column[] {
    return this.projekteOrderedColumns.filter((col) => this.projekteVisibleColumns[col.field]);
  }

  // Handle column reordering for filialen table
  onFilialenColReorder(event: any): void {
    if (event && typeof event.dragIndex === 'number' && typeof event.dropIndex === 'number') {
      const movedColumn = this.filialenOrderedColumns[event.dragIndex];

      const newOrderedColumns = [...this.filialenOrderedColumns];
      newOrderedColumns.splice(event.dragIndex, 1);
      newOrderedColumns.splice(event.dropIndex, 0, movedColumn);

      this.filialenOrderedColumns = newOrderedColumns;
      this.persistViewState();
    }
  }

  // Handle column reordering for projekte table
  onProjekteColReorder(event: any): void {
    if (event && typeof event.dragIndex === 'number' && typeof event.dropIndex === 'number') {
      const movedColumn = this.projekteOrderedColumns[event.dragIndex];

      const newOrderedColumns = [...this.projekteOrderedColumns];
      newOrderedColumns.splice(event.dragIndex, 1);
      newOrderedColumns.splice(event.dropIndex, 0, movedColumn);

      this.projekteOrderedColumns = newOrderedColumns;
      this.persistViewState();
    }
  }

  // Update visible columns for filialen
  onFilialenColumnsChange(selectedColumns: Column[]): void {
    // Reset all to false
    Object.keys(this.filialenVisibleColumns).forEach((key) => {
      this.filialenVisibleColumns[key] = false;
    });

    // Set selected columns to true
    selectedColumns.forEach((col) => {
      this.filialenVisibleColumns[col.field] = true;
    });

    // Update the selectedFilialenColumns for backward compatibility
    this.selectedFilialenColumns = selectedColumns;
    this.persistViewState();
  }

  // Update visible columns for projekte
  onProjekteColumnsChange(selectedColumns: Column[]): void {
    // Reset all to false
    Object.keys(this.projekteVisibleColumns).forEach((key) => {
      this.projekteVisibleColumns[key] = false;
    });

    // Set selected columns to true
    selectedColumns.forEach((col) => {
      this.projekteVisibleColumns[col.field] = true;
    });

    // Update the selectedProjekteColumns for backward compatibility
    this.selectedProjekteColumns = selectedColumns;
    this.persistViewState();
  }

  get paginatorTotalRecords(): number {
    return this.filteredFilialen.length;
  }

  get showFilialenPaginator(): boolean {
    return this.paginatorTotalRecords > this.pageSize;
  }

  /** Rows rendered in the table / mobile list for the current page. */
  get displayedFilialen(): Filiale[] {
    const list = this.filteredFilialen;
    if (!this.showFilialenPaginator) {
      return list;
    }
    return list.slice(this.paginationFirst, this.paginationFirst + this.pageSize);
  }

  get paginatedMobileFilialen(): Filiale[] {
    return this.displayedFilialen;
  }

  private getAssignedProjectIds(): Set<number> {
    return new Set(this.initializerService.getAssignedProjects().map((project) => Number(project.id)));
  }

  private filterProjekteForConnectedClient(projekte: Projekt[]): Projekt[] {
    const currentCompany = this.initializerService.getCurrentClientCompany();
    if (!currentCompany) {
      return projekte;
    }

    const assignedProjectIds = this.getAssignedProjectIds();

    return projekte.filter((projekt) => {
      const projectId = Number(projekt.projectId);
      if (!projectId || !assignedProjectIds.has(projectId)) {
        return false;
      }

      const clientId = Number(projekt.clientId);
      return !clientId || clientId === currentCompany.id;
    });
  }

  private extractUniqueBranchesFromReports(reports: Report[]): Branch[] {
    const branchesById = new Map<number, Branch>();

    reports.forEach((report) => {
      const branch = report.branch;
      if (!branch?.id) {
        return;
      }

      if (!branchesById.has(branch.id)) {
        branchesById.set(branch.id, {
          id: branch.id,
          name: branch.name || '',
          branchNumber: branch.branchNumber ?? null,
          street: branch.street || report.street || '',
          zipCode: branch.zipCode || report.zipCode || '',
          phone: branch.phone || '',
          client: branch.client
            ? {
                id: branch.client.id,
                name: branch.client.name || '',
              }
            : undefined,
          city: branch.city
            ? {
                id: branch.city.id,
                name: branch.city.name || '',
              }
            : undefined,
        });
      }
    });

    return Array.from(branchesById.values());
  }

  private loadFilialenFromAssignedProjects() {
    const projectIds = [
      ...new Set(
        this.initializerService
          .getAssignedProjects()
          .map((project) => Number(project.id))
          .filter((id) => !isNaN(id) && id > 0),
      ),
    ];

    if (projectIds.length === 0) {
      return of({
        data: [] as Branch[],
        hasNextPage: false,
        totalCount: 0,
      });
    }

    return forkJoin(projectIds.map((projectId) => this.reportService.getReportsByProject(projectId).pipe(catchError(() => of([] as Report[]))))).pipe(
      map((reportGroups) => {
        const branches = this.extractUniqueBranchesFromReports(reportGroups.flat());
        return {
          data: branches,
          hasNextPage: false,
          totalCount: branches.length,
        };
      }),
    );
  }

  // Load branches from API
  loadFilialen(options: { showLoader: boolean } = { showLoader: true }): void {
    if (options.showLoader) {
      this.loading = true;
    }

    this.loadFilialenFromAssignedProjects()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          const branches = response?.data || [];
          this.hasNextPage = !!response?.hasNextPage;
          this.totalRecords = response?.totalCount ?? branches.length;

          if (!branches || !Array.isArray(branches)) {
            console.warn('No branches received, using empty array');
            this.originalFilialen = [];
            this.filialen = [];
            this.totalRecords = 0;
            this.applyFilters();
            this.loading = false;
            return;
          }

          const mappedFilialen = this.mapBranchesToFilialen(branches);

          const existingById = new Map<string, Filiale>();
          this.originalFilialen.forEach((f) => existingById.set(f.id, f));

          const mergedFilialen = mappedFilialen.map((filiale) => {
            const existing = existingById.get(filiale.id);
            if (existing && existing.projekte) {
              return { ...filiale, projekte: existing.projekte };
            }
            return filiale;
          });

          this.originalFilialen = mergedFilialen;
          this.filialeSuchenStateService.setFilialeSuchenData(mergedFilialen);
          this.applyFilters();

          this.loading = false;
          this.cd.detectChanges();

          // Check expanded rows and load missing data
          Object.keys(this.expandedRows).forEach((filialeId) => {
            if (this.expandedRows[filialeId]) {
              const filiale = this.originalFilialen.find((f) => f.id === filialeId);
              if (filiale && (!filiale.projekte || filiale.projekte.length === 0)) {
                this.loadingReports[filialeId] = true;
                this.loadReportsForBranch(parseInt(filialeId), filialeId);
              }
            }
          });
          // Restore scroll position after data load
          setTimeout(() => {
            this.restoreScrollPosition();
          }, 0);
        },
        error: (error) => {
          console.error('Error loading branches:', error);
          this.loading = false;
        },
      });
  }
  // Map API branches to Filiale interface
  private mapBranchesToFilialen(branches: Branch[]): Filiale[] {
    const mapped = branches.map((branch) => ({
      id: branch.id.toString(),
      name: branch.name,
      strasse: branch.street || '',
      plz: branch.zipCode || '',
      ort: branch.city?.name || '',
      phone: branch.phone || '',
      clientId: branch.client?.id?.toString() ?? '',
      branchNumber: branch.branchNumber ?? '',
      projekte: [], // Will be populated when row is expanded
    }));
    return this.normalizeFilialenList(mapped);
  }

  // Load reports for a specific branch
  loadReportsForBranch(branchId: number, filialeId: string): void {
    const branchIds = this.getBranchIdsForFiliale(filialeId, branchId);

    forkJoin(branchIds.map((id) => this.branchesService.getReportsByBranch(id).pipe(catchError(() => of([] as any[])))))
      .pipe(map((reportGroups) => reportGroups.flat()))
      .subscribe({
        next: (reports: any[]) => {
          // Map reports to projekte format
          const projekte = reports.map((report) => {
            const projectId = report?.project?.id ? report.project.id.toString() : '';
            const clientId = (report?.clientCompany?.id || report?.project?.clientCompany?.id || report?.branch?.client?.id || report?.client?.id || '').toString();
            const mappedBranchId = report?.branch?.id ? report.branch.id.toString() : branchId?.toString() || '';

            return {
              id: report.id?.toString() || '',
              projectId,
              clientId,
              branchId: mappedBranchId,
              name: report.project?.name || 'Unnamed Project',
              kunde: {
                name: report?.clientCompany?.name || report?.project?.clientCompany?.name || report?.branch?.client?.name || report?.client?.name || 'Unbekannt',
              },
              zeitraum: this.formatDateRange(report.plannedOn, report.reportTo),
              calendarWeek: this.getCalendarWeek(report.plannedOn),
              status: {
                name: report.status?.name || 'unknown',
                akzenteName: report.status?.akzenteName || report.status?.name || 'unknown',
                color: report.status?.akzenteColor || '#6B7280',
              },
              geplant: this.formatDate(report.plannedOn),
              filiale: report.branch?.name || 'Unknown Branch',
              adresse: `${report.street || ''} ${report.zipCode || ''}`.trim(),
              merchandiser: report.merchandiser,
              merchandiserName: this.getMerchandiserNameFromReport(report),
              isFavorite: report.isFavorite || false,
            } as Projekt;
          });
          const uniqueProjekte = this.filterProjekteForConnectedClient(this.dedupeProjekte(this.dedupeById(projekte)));

          // Find the branch in the filialen array and update its projekte
          const branchIndex = this.filialen.findIndex((filiale) => filiale.id === filialeId);
          if (branchIndex !== -1) {
            this.filialen[branchIndex].projekte = uniqueProjekte;
          }

          // Also update originalFilialen so filters/sorts keep the loaded projects
          const originalBranchIndex = this.originalFilialen.findIndex((filiale) => filiale.id === filialeId);
          if (originalBranchIndex !== -1) {
            this.originalFilialen[originalBranchIndex].projekte = uniqueProjekte;
          }

          // Persist data and view state so returning to the page restores projects and expansions
          this.filialeSuchenStateService.setFilialeSuchenData(this.originalFilialen);
          // Don't persist view state here as it might overwrite scroll position with incorrect value before restoration
          // this.persistViewState();

          // Clear loading state
          this.loadingReports[filialeId] = false;

          if (originalBranchIndex !== -1) {
            const filialeRef = this.originalFilialen[originalBranchIndex];
            this.rebuildProjekteColumnFilterOptionsCacheForFiliale(filialeRef);
            this.updateFilialeDerivedData(filialeRef);
            const visibleIndex = this.filialen.findIndex((f) => f.id === filialeId);
            if (visibleIndex !== -1) {
              this.filialen[visibleIndex]._filteredProjekte = filialeRef._filteredProjekte;
            }
          }

          this.cd.detectChanges();

          this.restoreMainTableScrollAfterExpand();
          if (this.showFilialeModal && this.selectedFilialeForModal?.id === filialeId) {
            this.restoreFilialeModalScrollPosition(filialeId);
          }
        },
        error: (error) => {
          console.error('Error loading reports for branch:', branchIds, error);
          // Clear loading state on error
          this.loadingReports[filialeId] = false;
        },
      });
  }

  // Helper method to format date range
  private formatDateRange(startDate: string, endDate: string): string {
    if (!startDate && !endDate) return '';
    const start = startDate ? this.formatDate(startDate) : '';
    const end = endDate ? this.formatDate(endDate) : '';
    return start && end ? `${start} - ${end}` : start || end;
  }

  // Helper method to format date
  private formatDate(dateString: string): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('de-DE');
  }

  // Helper method to get calendar week
  private getCalendarWeek(dateString: string): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    const start = new Date(date.getFullYear(), 0, 1);
    const days = Math.floor((date.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
    const weekNumber = Math.ceil((days + start.getDay() + 1) / 7);
    return `KW ${weekNumber}`;
  }

  // Add this getter for filtered filialen
  get filteredFilialen(): Filiale[] {
    // Return the filtered filialen array (filtering is handled by applyFilters)
    return this.filialen;
  }

  // Method to filter filialen based on search query
  filterFilialen(): void {
    this.currentPage = 1;
    this.paginationFirst = 0;
    this.applyFilters();
    this.persistViewState();
  }

  // Apply all filters (search + column filters)
  applyFilters(): void {
    let filtered = [...this.originalFilialen];

    // Apply search query filter
    if (this.searchQuery && this.searchQuery.trim() !== '') {
      const query = this.searchQuery.toLowerCase().trim();
      filtered = filtered.filter(
        (filiale) =>
          filiale.name.toLowerCase().includes(query) || filiale.ort.toLowerCase().includes(query) || filiale.plz.toLowerCase().includes(query) || filiale.strasse.toLowerCase().includes(query),
      );
    }

    // Apply column filters for 'name' column (not in filialenCols)
    const nameFilterValues = this.filialenColumnFilterValues['name'];
    if (nameFilterValues && Array.isArray(nameFilterValues) && nameFilterValues.length > 0) {
      filtered = filtered.filter((filiale) => {
        const value = this.normalizeColumnFilterValue(filiale.name?.toString() || '');
        return nameFilterValues.includes(value);
      });
    }

    // Apply column filters for other columns
    this.filialenCols.forEach((col) => {
      const filterValues = this.filialenColumnFilterValues[col.field];
      if (filterValues && Array.isArray(filterValues) && filterValues.length > 0) {
        filtered = filtered.filter((filiale) => {
          const value = this.normalizeColumnFilterValue(filiale[col.field as keyof Filiale]?.toString() || '');
          return filterValues.includes(value);
        });
      }
    });

    this.filialen = filtered;
    this.applyProjekteFilters();

    if (this.paginationFirst >= this.filialen.length) {
      this.paginationFirst = 0;
      this.currentPage = 1;
    }

    // Re-apply current sort after filtering
    if (this.sortField) {
      this.filialen = this.applyFilialenSorting(this.filialen, this.sortField, this.sortDirection === 'asc' ? 1 : -1);
    }

    this.rebuildFilialenColumnFilterOptionsCache();
    this.refreshCurrentColumnFilterOptions();

    // Trigger change detection to update view
    this.cd.detectChanges();

    // Do not persist view state here automatically as it might overwrite scroll position during load
    // this.persistViewState();
  }

  get filialeMobileFilterColumns(): FilialeFilterColumn[] {
    return [{ field: 'name', header: 'Filiale' }, ...this.filialenCols];
  }

  get filialeMobileColumnOptions(): { [field: string]: { label: string; value: string }[] } {
    const options: { [field: string]: { label: string; value: string }[] } = {};
    this.filialeMobileFilterColumns.forEach(({ field }) => {
      options[field] = this.filialenColumnFilterOptionsCache[field] || this.getUniqueValuesForFilialenColumn(field);
    });
    return options;
  }

  get filialeMobileCanFilterMap(): { [field: string]: boolean } {
    const map: { [field: string]: boolean } = {};
    this.filialeMobileFilterColumns.forEach(({ field }) => {
      map[field] = this.hasFilialenColumnData(field);
    });
    return map;
  }

  getTotalFilialenActiveFilters(): number {
    const searchCount = this.searchQuery?.trim() ? 1 : 0;
    const colCount = Object.values(this.filialenColumnFilterValues).reduce((sum, arr) => sum + (arr?.length || 0), 0);
    return searchCount + colCount;
  }

  openFilialeMobileFilter(): void {
    this.ensureFilialenColumnFilterOptionsCacheReady();
    this.showFilialeMobileFilter = true;
  }

  onMobileFilterSearchChange(term: string): void {
    this.searchQuery = term;
    this.filterFilialen();
  }

  onMobileFilterColumnChanged(event: { field: string; values: string[] }): void {
    this.filialenColumnFilterValues[event.field] = event.values;
    this.onFilialenColumnFilterChange();
  }

  onMobileFilterAllCleared(): void {
    this.clearFilters();
  }

  // --- Filiale detail modal ---

  openFilialeModal(filiale: Filiale, event?: Event): void {
    event?.preventDefault();
    this.selectedFilialeForModal = filiale;
    this.showFilialeModal = true;
    this.projekteModalSearchQuery = '';
    this.restoreFilialeModalScrollPosition(filiale.id);
    if (!filiale.projekte || filiale.projekte.length === 0) {
      const branchId = parseInt(filiale.id);
      this.loadingReports[filiale.id] = true;
      if (branchId) {
        this.loadReportsForBranch(branchId, filiale.id);
      }
    } else {
      this.ensureProjekteColumnFilterCacheForFiliale(filiale);
      this.updateFilialeDerivedData(filiale);
    }
  }

  closeFilialeModal(): void {
    this.captureFilialeModalScrollPosition();
    this.showFilialeModal = false;
    this.selectedFilialeForModal = null;
    this.showProjekteMobileFilter = false;
  }

  rememberFilialeModalStateBeforeNavigate(): void {
    this.captureFilialeModalScrollPosition();
    this.persistViewState();
    this.closeFilialeModal();
  }

  onFilialeModalScroll(event: Event): void {
    if (!this.selectedFilialeForModal?.id) {
      return;
    }
    const target = event.target as HTMLElement | null;
    if (!target) {
      return;
    }
    this.filialeModalScrollPositionById[this.selectedFilialeForModal.id] = target.scrollTop || 0;
  }

  private captureFilialeModalScrollPosition(filialeId?: string): void {
    const id = filialeId || this.selectedFilialeForModal?.id;
    if (!id) {
      return;
    }

    const container = document.querySelector(`.filiale-detail-fullscreen-dialog [data-filiale-modal-scroll-id="${id}"]`) as HTMLElement | null;
    if (container) {
      this.filialeModalScrollPositionById[id] = container.scrollTop || 0;
    }
  }

  private restoreFilialeModalScrollPosition(filialeId?: string): void {
    const id = filialeId || this.selectedFilialeForModal?.id;
    if (!id) {
      return;
    }

    const targetPosition = this.filialeModalScrollPositionById[id] ?? 0;
    if (targetPosition <= 0) {
      return;
    }

    let attempts = 0;
    const maxAttempts = 120;
    const tryRestore = () => {
      const container = document.querySelector(`[data-filiale-modal-scroll-id="${id}"]`) as HTMLElement | null;
      if (container) {
        container.scrollTop = targetPosition;
        requestAnimationFrame(() => {
          container.scrollTop = targetPosition;
          setTimeout(() => {
            container.scrollTop = targetPosition;
          }, 120);
        });
        return;
      }

      if (attempts < maxAttempts) {
        attempts++;
        setTimeout(tryRestore, 16);
      }
    };

    setTimeout(tryRestore, 0);
  }

  getFilteredProjekteForModal(): Projekt[] {
    if (!this.selectedFilialeForModal) return [];
    let filtered = this.getFilteredProjekte(this.selectedFilialeForModal);
    const q = this.projekteModalSearchQuery.trim().toLowerCase();
    if (q) {
      filtered = filtered.filter((p) => (p.name || '').toLowerCase().includes(q) || (p.kunde?.name || '').toLowerCase().includes(q) || (p.zeitraum || '').toLowerCase().includes(q));
    }
    return filtered;
  }

  onProjekteModalSearchChange(term: string): void {
    this.projekteModalSearchQuery = term;
    if (this.selectedFilialeForModal) {
      this.rebuildProjekteColumnFilterOptionsCacheForFiliale(this.selectedFilialeForModal);
    }
    this.refreshCurrentColumnFilterOptions();
  }

  getTotalProjekteActiveFilters(): number {
    const filialeId = this.selectedFilialeForModal?.id;
    if (!filialeId) {
      return 0;
    }
    const filters = this.getFilialeProjekteColumnFilters(filialeId);
    return Object.values(filters).reduce((sum, arr) => sum + (arr?.length || 0), 0);
  }

  clearProjekteModalFilters(): void {
    if (this.selectedFilialeForModal?.id) {
      this.projekteColumnFiltersByFilialeId[this.selectedFilialeForModal.id] = {};
    }
    this.projekteColumnFilterValues = {};
    this.projekteModalSearchQuery = '';
    if (this.selectedFilialeForModal) {
      this.rebuildProjekteColumnFilterOptionsCacheForFiliale(this.selectedFilialeForModal);
      this.applyProjekteFilters(this.selectedFilialeForModal);
    }
    this.persistViewState();
  }

  openProjekteModalFilter(): void {
    if (this.selectedFilialeForModal) {
      this.ensureProjekteColumnFilterCacheForFiliale(this.selectedFilialeForModal);
    }
    this.showProjekteMobileFilter = true;
  }

  get projekteMobileFilterColumns(): FilterColumn[] {
    return [{ field: 'name', header: 'Projekt' }, ...this.projekteCols];
  }

  get projekteMobileColumnOptions(): { [field: string]: { label: string; value: string; color?: string }[] } {
    if (!this.selectedFilialeForModal) return {};
    const options: { [field: string]: { label: string; value: string; color?: string }[] } = {};
    this.projekteMobileFilterColumns.forEach(({ field }) => {
      options[field] = this.projekteColumnFilterOptionsCache[this.selectedFilialeForModal!.id]?.[field] || this.getUniqueValuesForProjekteColumnForFiliale(this.selectedFilialeForModal!, field);
    });
    return options;
  }

  get projekteMobileCanFilterMap(): { [field: string]: boolean } {
    const map: { [field: string]: boolean } = {};
    this.projekteMobileFilterColumns.forEach(({ field }) => {
      map[field] = this.selectedFilialeForModal ? this.hasProjekteColumnData(field, this.selectedFilialeForModal) : false;
    });
    return map;
  }

  onProjekteModalFilterChanged(event: { field: string; values: string[] }): void {
    if (this.selectedFilialeForModal?.id) {
      this.getFilialeProjekteColumnFilters(this.selectedFilialeForModal.id)[event.field] = event.values;
      this.rebuildProjekteColumnFilterOptionsCacheForFiliale(this.selectedFilialeForModal);
      this.applyProjekteFilters(this.selectedFilialeForModal);
    }
    this.persistViewState();
  }

  onProjekteModalAllFiltersCleared(): void {
    this.clearProjekteModalFilters();
  }

  // Clear all filters
  clearFilters(): void {
    this.searchQuery = '';
    this.filialenColumnFilterValues = {};
    this.projekteColumnFilterValues = {};
    this.currentPage = 1;
    this.paginationFirst = 0;
    this.applyFilters();
    this.refreshProjekteColumnFilterOptionsCachesForExpandedRows();
    this.persistViewState();
  }

  /**
   * Close all filter popovers
   */
  closeAllFilterPopovers(): void {
    if (this.filterPopoverTimeout) {
      clearTimeout(this.filterPopoverTimeout);
      this.filterPopoverTimeout = null;
    }

    if (this.filialenColumnFilterPopover) {
      this.filialenColumnFilterPopover.hide();
    }
    if (this.projekteColumnFilterPopover) {
      this.projekteColumnFilterPopover.hide();
    }

    this.closeActiveColumnFilterPopover();
    this.hideSettingsPopovers();
  }

  private closeActiveColumnFilterPopover(except?: any): void {
    if (this.filialenColumnFilterPopover && this.filialenColumnFilterPopover !== except) {
      this.filialenColumnFilterPopover.hide();
    }
    if (this.projekteColumnFilterPopover && this.projekteColumnFilterPopover !== except) {
      this.projekteColumnFilterPopover.hide();
    }

    if (this.activeColumnFilterPopover && this.activeColumnFilterPopover !== except) {
      this.activeColumnFilterPopover = null;
    }

    this.cd.detectChanges();
  }

  private hideSettingsPopovers(except?: any): void {
    if (this.filialenColumnsPopover && this.filialenColumnsPopover !== except) {
      this.filialenColumnsPopover.hide();
    }
    if (this.projekteColumnsPopover && this.projekteColumnsPopover !== except) {
      this.projekteColumnsPopover.hide();
    }
    if (!except || (this.activeSettingsPopover && this.activeSettingsPopover !== except)) {
      this.activeSettingsPopover = null;
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

    // Check if click is on a column filter trigger (desktop icons / wrappers)
    const isClickOnColumnFilterTrigger = target.closest('.column-filter-btn') !== null || target.closest('.column-filter-trigger') !== null;

    // Check if click is on PrimeNG multiselect or dropdown
    const isClickOnPrimeComponent =
      target.closest('p-multiselect') !== null ||
      target.closest('p-dropdown') !== null ||
      target.closest('.p-multiselect') !== null ||
      target.closest('.p-dropdown') !== null ||
      target.closest('.p-multiselect-panel') !== null ||
      target.closest('.p-dropdown-panel') !== null ||
      target.closest('p-popover') !== null;

    // If click is outside popover and not on filter trigger/Prime component, close all popovers
    if (!isClickInsidePopover && !isClickOnPrimeComponent && !isClickOnColumnFilterTrigger) {
      this.closeAllFilterPopovers();
    }
  }

  // Check if any filters are active
  hasFilters(): boolean {
    return (this.searchQuery && this.searchQuery.trim() !== '') || this.hasFilialenColumnFilters() || this.hasProjekteColumnFilters();
  }

  hasFilialenColumnFilters(): boolean {
    return Object.keys(this.filialenColumnFilterValues).some((field) => {
      const values = this.filialenColumnFilterValues[field];
      return values && Array.isArray(values) && values.length > 0;
    });
  }

  hasProjekteColumnFilters(): boolean {
    return Object.keys(this.projekteColumnFiltersByFilialeId).some((filialeId) => this.hasAnyProjekteColumnFilter(filialeId));
  }

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

  getColumnFilterModalTitle(): string {
    if (this.columnFilterModalType === 'filialen' && this.currentFilialenFilterField) {
      return this.getFilialenColumnHeader(this.currentFilialenFilterField);
    }
    if (this.columnFilterModalType === 'projekte' && this.currentProjekteFilterField) {
      return this.getProjekteColumnHeader(this.currentProjekteFilterField);
    }
    return 'Filter';
  }

  // Column filter methods for filialen
  openFilialenColumnFilter(field: string, event: Event): void {
    // Store the actual DOM element for positioning
    const targetElement = (event.currentTarget || event.target) as HTMLElement;

    if (!targetElement) {
      return;
    }

    event.stopPropagation();

    this.ensureFilialenColumnFilterOptionsCacheReady();

    // Close settings popover if open
    this.hideSettingsPopovers();

    // On mobile: open centered modal instead of popover
    if (this.isMobileColumnFilter()) {
      // If a column-filter modal is already open, swap content in place. Closing and reopening
      // races with p-dialog (onHide) and can leave the new filter stuck closed.
      if (this.showColumnFilterModal) {
        this.currentFilialenFilterField = field;
        if (!this.filialenColumnFilterValues[field]) {
          this.filialenColumnFilterValues[field] = [];
        }
        this.currentFilialenFilterOptions = this.filialenColumnFilterOptionsCache[field] ?? this.getUniqueValuesForFilialenColumn(field);
        this.columnFilterModalType = 'filialen';
        this.cd.detectChanges();
        return;
      }
      this.currentFilialenFilterField = field;
      if (!this.filialenColumnFilterValues[field]) {
        this.filialenColumnFilterValues[field] = [];
      }
      this.currentFilialenFilterOptions = this.filialenColumnFilterOptionsCache[field] ?? this.getUniqueValuesForFilialenColumn(field);
      this.columnFilterModalType = 'filialen';
      this.openColumnFilterModal();
      return;
    }

    // Check if the same field is already open (compare before mutating state)
    this.closeActiveColumnFilterPopover();

    this.currentFilialenFilterField = field;
    if (!this.filialenColumnFilterValues[field]) {
      this.filialenColumnFilterValues[field] = [];
    }
    this.currentFilialenFilterOptions = this.filialenColumnFilterOptionsCache[field] ?? this.getUniqueValuesForFilialenColumn(field);

    this.cd.detectChanges();
    this.showFilterPopover(this.filialenColumnFilterPopover, targetElement);
  }

  // Column filter methods for projekte
  openProjekteColumnFilter(field: string, filiale: Filiale, event: Event): void {
    // Store the actual DOM element for positioning
    const targetElement = (event.currentTarget || event.target) as HTMLElement;

    if (!targetElement) {
      return;
    }

    event.stopPropagation();

    this.ensureProjekteColumnFilterCacheForFiliale(filiale);

    // Close settings popover if open
    this.hideSettingsPopovers();

    // On mobile: open centered modal instead of popover
    if (this.isMobileColumnFilter()) {
      if (this.showColumnFilterModal) {
        this.currentProjekteFilterField = field;
        this.selectedFilialeForFilter = filiale;
        this.ensureFilialeProjekteFilterField(filiale.id, field);
        this.currentProjekteFilterOptions = this.projekteColumnFilterOptionsCache[filiale.id]?.[field] ?? this.getUniqueValuesForProjekteColumn(field);
        this.columnFilterModalType = 'projekte';
        this.cd.detectChanges();
        return;
      }
      this.currentProjekteFilterField = field;
      this.selectedFilialeForFilter = filiale;
      this.ensureFilialeProjekteFilterField(filiale.id, field);
      this.currentProjekteFilterOptions = this.projekteColumnFilterOptionsCache[filiale.id]?.[field] ?? this.getUniqueValuesForProjekteColumn(field);
      this.columnFilterModalType = 'projekte';
      this.openColumnFilterModal();
      return;
    }

    // Same column + same Filiale (compare before mutating state)
    this.closeActiveColumnFilterPopover();

    this.currentProjekteFilterField = field;
    this.selectedFilialeForFilter = filiale;
    this.ensureFilialeProjekteFilterField(filiale.id, field);
    this.currentProjekteFilterOptions = this.projekteColumnFilterOptionsCache[filiale.id]?.[field] ?? this.getUniqueValuesForProjekteColumn(field);

    // Let the angular change detection tick so the DOM responds to the above state changes,
    // then reposition & re-show the popover correctly.
    this.cd.detectChanges();
    this.showFilterPopover(this.projekteColumnFilterPopover, targetElement);
  }

  toggleFilialenSettings(popover: any, event: Event): void {
    const targetElement = (event.currentTarget || event.target) as HTMLElement;
    if (!popover || !targetElement) {
      return;
    }

    event.stopPropagation();

    if (this.activeSettingsPopover === popover) {
      this.closeSettingsColumnsSelector(popover);
      popover.hide();
      this.activeSettingsPopover = null;
      return;
    }

    this.closeActiveColumnFilterPopover();
    this.hideSettingsPopovers(popover);

    this.showFilterPopover(popover, targetElement, true);
  }

  toggleProjekteSettings(popover: any, event: Event): void {
    const targetElement = (event.currentTarget || event.target) as HTMLElement;
    if (!popover || !targetElement) {
      return;
    }

    event.stopPropagation();

    if (this.activeSettingsPopover === popover) {
      this.closeSettingsColumnsSelector(popover);
      popover.hide();
      this.activeSettingsPopover = null;
      return;
    }

    this.closeActiveColumnFilterPopover();
    this.hideSettingsPopovers(popover);

    this.showFilterPopover(popover, targetElement, true);
  }

  // Helper method to show filter popover with proper positioning
  private showFilterPopover(popoverRef: any, targetElement: HTMLElement, isSettings: boolean = false): void {
    if (!popoverRef || !targetElement) {
      return;
    }

    if (this.filterPopoverTimeout) {
      clearTimeout(this.filterPopoverTimeout);
      this.filterPopoverTimeout = null;
    }

    const positioningEvent = {
      currentTarget: targetElement,
      target: targetElement,
      preventDefault: () => {},
      stopPropagation: () => {},
    } as any;

    popoverRef.hide();
    if (isSettings) {
      this.activeSettingsPopover = null;
    } else {
      this.activeColumnFilterPopover = null;
    }
    this.cd.detectChanges();

    const showPopover = (): void => {
      popoverRef.show(positioningEvent);

      if (isSettings) {
        this.activeSettingsPopover = popoverRef;
      } else {
        this.activeColumnFilterPopover = popoverRef;
      }

      this.scheduleOpenFirstDropdown(popoverRef);
      if (isSettings) {
        this.openSettingsColumnsSelector(popoverRef);
      }
      this.cd.detectChanges();
    };

    // Match dashboard behavior: always reopen popover with a short delay after hide.
    // This avoids races when switching quickly between filter triggers.
    this.filterPopoverTimeout = setTimeout(showPopover, 120);
  }

  onColumnFilterPopoverClose(popoverRef: any, event?: Event): void {
    event?.stopPropagation();
    if (popoverRef) {
      popoverRef.hide();
    }
    if (this.activeColumnFilterPopover === popoverRef) {
      this.activeColumnFilterPopover = null;
    }
  }

  onPopoverClose(popoverRef: any, event?: Event): void {
    event?.stopPropagation();
    if (popoverRef) {
      popoverRef.hide();
    }
    if (this.activeSettingsPopover === popoverRef) {
      this.activeSettingsPopover = null;
    }
  }

  private scheduleOpenFirstDropdown(popoverRef: any): void {
    // Try a few times to catch the overlay once it is rendered
    [0, 50, 120].forEach((delay) => setTimeout(() => this.tryOpenFirstDropdown(popoverRef), delay));
  }

  private openSettingsColumnsSelector(popoverRef: any): void {
    const targetMultiSelect = popoverRef === this.filialenColumnsPopover ? this.filialenColumnsMultiSelect : this.projekteColumnsMultiSelect;

    if (!targetMultiSelect || targetMultiSelect.overlayVisible) {
      return;
    }

    [0, 50, 120].forEach((delay) =>
      setTimeout(() => {
        if (!targetMultiSelect.overlayVisible) {
          targetMultiSelect.show();
        }
      }, delay),
    );
  }

  private closeSettingsColumnsSelector(popoverRef: any): void {
    const targetMultiSelect = popoverRef === this.filialenColumnsPopover ? this.filialenColumnsMultiSelect : this.projekteColumnsMultiSelect;

    if (targetMultiSelect?.overlayVisible) {
      targetMultiSelect.hide();
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

  getFilialenColumnFilterValue(field: string): string[] {
    return this.filialenColumnFilterValues[field] || [];
  }

  /** True when there is at least one distinct value to filter for this column (enables filter icon). */
  hasFilialenColumnData(field: string): boolean {
    // Keep column filter clickable when it already has an active selection,
    // even if current option list is empty due to other active filters.
    if (this.getFilialenColumnFilterValue(field).length > 0) {
      return true;
    }

    if (!this.originalFilialen?.length) {
      return false;
    }
    const cached = this.filialenColumnFilterOptionsCache[field];
    if (cached !== undefined) {
      return cached.length > 0;
    }
    return this.getUniqueValuesForFilialenColumn(field).length > 0;
  }

  /** True when the expanded Filiale has project rows with data for this column. */
  hasProjekteColumnData(field: string, filiale: Filiale): boolean {
    // Keep column filter clickable when it already has an active selection.
    if (this.getProjekteColumnFilterValue(field, filiale.id).length > 0) {
      return true;
    }

    if (!filiale?.projekte?.length) {
      return false;
    }
    const cached = this.projekteColumnFilterOptionsCache[filiale.id]?.[field];
    if (cached !== undefined) {
      return cached.length > 0;
    }
    return this.getUniqueValuesForProjekteColumnForFiliale(filiale, field).length > 0;
  }

  private getFilteredFilialenForOptions(excludeField?: string): Filiale[] {
    let filtered = [...this.originalFilialen];

    // Apply search query filter
    if (this.searchQuery && this.searchQuery.trim() !== '') {
      const query = this.searchQuery.toLowerCase().trim();
      filtered = filtered.filter(
        (filiale) =>
          filiale.name.toLowerCase().includes(query) || filiale.ort.toLowerCase().includes(query) || filiale.plz.toLowerCase().includes(query) || filiale.strasse.toLowerCase().includes(query),
      );
    }

    // Apply column filters for 'name' column (not in filialenCols)
    if (excludeField !== 'name') {
      const nameFilterValues = this.filialenColumnFilterValues['name'];
      if (nameFilterValues && Array.isArray(nameFilterValues) && nameFilterValues.length > 0) {
        filtered = filtered.filter((filiale) => {
          const value = this.normalizeColumnFilterValue(filiale.name?.toString() || '');
          return nameFilterValues.includes(value);
        });
      }
    }

    // Apply column filters for other columns
    this.filialenCols.forEach((col) => {
      if (col.field === excludeField) return;

      const filterValues = this.filialenColumnFilterValues[col.field];
      if (filterValues && Array.isArray(filterValues) && filterValues.length > 0) {
        filtered = filtered.filter((filiale) => {
          const value = this.normalizeColumnFilterValue(filiale[col.field as keyof Filiale]?.toString() || '');
          return filterValues.includes(value);
        });
      }
    });

    return filtered;
  }

  getUniqueValuesForFilialenColumn(field: string): { label: string; value: string }[] {
    const values = new Set<string>();
    const filialenToUse = this.getFilteredFilialenForOptions(field);

    filialenToUse.forEach((filiale) => {
      const value = this.normalizeColumnFilterValue(filiale[field as keyof Filiale]?.toString() || '');
      values.add(value);
    });
    this.appendSelectedFilterValues(values, this.filialenColumnFilterValues[field]);
    return this.sortColumnFilterValues(Array.from(values)).map((val) => ({
      label: this.getColumnFilterOptionLabel(val),
      value: val,
    }));
  }

  private getFilialenFilterFieldKeys(): string[] {
    return ['name', ...this.filialenCols.map((c) => c.field)];
  }

  private rebuildFilialenColumnFilterOptionsCache(): void {
    const cache: { [field: string]: { label: string; value: string }[] } = {};
    for (const field of this.getFilialenFilterFieldKeys()) {
      cache[field] = this.getUniqueValuesForFilialenColumn(field);
    }
    this.filialenColumnFilterOptionsCache = cache;
  }

  /** Ensures precomputed options exist before opening popover/modal (avoids on-click computation jank). */
  private ensureFilialenColumnFilterOptionsCacheReady(): void {
    const keys = this.getFilialenFilterFieldKeys();
    if (keys.some((k) => !this.filialenColumnFilterOptionsCache[k])) {
      this.rebuildFilialenColumnFilterOptionsCache();
    }
  }

  getFilialenColumnHeader(field: string): string {
    if (field === 'name') {
      return 'Filiale';
    }
    const col = this.filialenCols.find((c) => c.field === field);
    return col ? col.header : field;
  }

  onFilialenColumnFilterChange(): void {
    this.currentPage = 1;
    this.paginationFirst = 0;
    this.applyFilters();
    this.persistViewState();
  }

  onFilialenColumnFilterCleared(): void {
    if (this.currentFilialenFilterField) {
      this.filialenColumnFilterValues[this.currentFilialenFilterField] = [];
    }
    this.onFilialenColumnFilterChange();
  }

  getProjekteColumnFilterValue(field: string, filialeId?: string): string[] {
    const id = filialeId || this.selectedFilialeForFilter?.id || this.selectedFilialeForModal?.id;
    if (!id) {
      return this.projekteColumnFilterValues[field] || [];
    }
    return this.getFilialeProjekteColumnFilters(id)[field] || [];
  }

  private getProjektFilterFieldValue(projekt: Projekt, field: string): string {
    switch (field) {
      case 'name':
        return projekt.name || '';
      case 'zeitraum':
        return projekt.calendarWeek ? `${projekt.calendarWeek} ${projekt.zeitraum}` : projekt.zeitraum || '';
      case 'status':
        return projekt.status?.akzenteName || projekt.status?.name || '';
      case 'merchandiser':
        return this.getProjektMerchandiserName(projekt);
      case 'kunde':
        return projekt.kunde?.name || '';
      case 'geplant':
        return projekt.geplant || '';
      case 'adresse':
        return projekt.adresse || '';
      default:
        return (projekt as any)?.[field]?.toString() || '';
    }
  }

  /** Client-detail style report filtering for a single Filiale's project list. */
  private getFilteredProjekteList(filiale: Filiale, excludeField?: string): Projekt[] {
    if (!filiale.projekte?.length) {
      return [];
    }

    let filtered = this.filterProjekteForConnectedClient([...filiale.projekte]);
    const filters = this.getFilialeProjekteColumnFilters(filiale.id);

    for (const field of this.getProjekteFilterFieldKeys()) {
      if (field === excludeField) {
        continue;
      }

      const filterValues = filters[field];
      if (!filterValues?.length) {
        continue;
      }

      filtered = filtered.filter((projekt) => {
        const value = this.normalizeColumnFilterValue(this.getProjektFilterFieldValue(projekt, field));
        return filterValues.includes(value);
      });
    }

    return filtered;
  }

  private updateFilialeDerivedData(filiale: Filiale): void {
    if (!filiale.projekte) {
      filiale._filteredProjekte = [];
      return;
    }

    let filtered = this.getFilteredProjekteList(filiale);
    const sortKey = this.projektSortField;

    if (sortKey?.startsWith(`${filiale.id}_`)) {
      const field = sortKey.slice(filiale.id.length + 1);
      const order = this.projektSortDirection === 'asc' ? 1 : -1;
      filtered = this.applyProjekteSorting(filtered, field, order);
    }

    filiale._filteredProjekte = filtered;
  }

  private applyProjekteFilters(filiale?: Filiale): void {
    const targets = filiale ? [filiale] : [...this.originalFilialen.filter((f) => this.expandedRows[f.id]), ...(this.selectedFilialeForModal ? [this.selectedFilialeForModal] : [])];

    const seen = new Set<string>();
    targets.forEach((f) => {
      if (!f?.id || seen.has(f.id)) {
        return;
      }
      seen.add(f.id);
      this.updateFilialeDerivedData(f);
      const visible = this.filialen.find((row) => row.id === f.id);
      if (visible) {
        visible._filteredProjekte = f._filteredProjekte;
      }
    });

    this.cd.detectChanges();
  }

  private getFilteredProjekteForOptions(filiale: Filiale, excludeField?: string): Projekt[] {
    if (!filiale.projekte) {
      return [];
    }

    let filtered = this.getFilteredProjekteList(filiale, excludeField);

    if (this.selectedFilialeForModal?.id === filiale.id && this.projekteModalSearchQuery.trim()) {
      const query = this.projekteModalSearchQuery.trim().toLowerCase();
      filtered = filtered.filter(
        (projekt) =>
          (projekt.name || '').toLowerCase().includes(query) ||
          (projekt.kunde?.name || '').toLowerCase().includes(query) ||
          (projekt.merchandiserName || '').toLowerCase().includes(query) ||
          (projekt.zeitraum || '').toLowerCase().includes(query),
      );
    }

    return filtered;
  }

  getUniqueValuesForProjekteColumn(field: string): { label: string; value: string; color?: string }[] {
    const filiale = this.selectedFilialeForFilter;
    if (!filiale) {
      return [];
    }
    return this.getUniqueValuesForProjekteColumnForFiliale(filiale, field);
  }

  private getUniqueValuesForProjekteColumnForFiliale(filiale: Filiale, field: string): { label: string; value: string; color?: string }[] {
    const valuesMap = new Map<string, string>();
    const projectsToUse = this.getFilteredProjekteForOptions(filiale, field);
    projectsToUse.forEach((projekt) => {
      const value = this.normalizeColumnFilterValue(this.getProjektFilterFieldValue(projekt, field));
      if (field === 'status' && value && projekt.status?.color) {
        valuesMap.set(value, projekt.status.color);
      } else if (!valuesMap.has(value)) {
        valuesMap.set(value, '');
      }
    });
    this.appendSelectedFilterValuesToMap(valuesMap, this.getFilialeProjekteColumnFilters(filiale.id)[field]);
    return Array.from(valuesMap.entries())
      .sort((a, b) => {
        const aEmpty = a[0] === '';
        const bEmpty = b[0] === '';
        if (aEmpty !== bEmpty) {
          return aEmpty ? 1 : -1;
        }
        return a[0].localeCompare(b[0], 'de', { sensitivity: 'base', numeric: true });
      })
      .map(([val, color]) => ({
        label: this.getColumnFilterOptionLabel(val),
        value: val,
        color: color || undefined,
      }));
  }

  private getProjekteFilterFieldKeys(): string[] {
    return ['name', ...this.projekteCols.map((c) => c.field)];
  }

  private rebuildProjekteColumnFilterOptionsCacheForFiliale(filiale: Filiale): void {
    if (!filiale?.id) {
      return;
    }
    const byField: { [field: string]: { label: string; value: string; color?: string }[] } = {};
    for (const field of this.getProjekteFilterFieldKeys()) {
      byField[field] = this.getUniqueValuesForProjekteColumnForFiliale(filiale, field);
    }
    this.projekteColumnFilterOptionsCache[filiale.id] = byField;
  }

  private ensureProjekteColumnFilterCacheForFiliale(filiale: Filiale): void {
    if (!filiale?.id) {
      return;
    }
    const byField = this.projekteColumnFilterOptionsCache[filiale.id];
    const keys = this.getProjekteFilterFieldKeys();
    if (!byField || keys.some((k) => !byField[k])) {
      this.rebuildProjekteColumnFilterOptionsCacheForFiliale(filiale);
    }
  }

  private refreshProjekteColumnFilterOptionsCachesForExpandedRows(): void {
    Object.keys(this.expandedRows || {}).forEach((id) => {
      if (!this.expandedRows[id]) {
        return;
      }
      const filiale = this.originalFilialen.find((f) => f.id === id);
      if (filiale) {
        this.rebuildProjekteColumnFilterOptionsCacheForFiliale(filiale);
      }
    });
  }

  private refreshCurrentColumnFilterOptions(): void {
    if (this.columnFilterModalType === 'filialen' && this.currentFilialenFilterField) {
      this.currentFilialenFilterOptions = this.filialenColumnFilterOptionsCache[this.currentFilialenFilterField] ?? this.getUniqueValuesForFilialenColumn(this.currentFilialenFilterField);
      return;
    }

    if (this.columnFilterModalType === 'projekte' && this.currentProjekteFilterField && this.selectedFilialeForFilter) {
      this.currentProjekteFilterOptions =
        this.projekteColumnFilterOptionsCache[this.selectedFilialeForFilter.id]?.[this.currentProjekteFilterField] ?? this.getUniqueValuesForProjekteColumn(this.currentProjekteFilterField);
    }
  }

  getProjekteColumnHeader(field: string): string {
    const col = this.projekteCols.find((c) => c.field === field);
    return col ? col.header : field;
  }

  onProjekteColumnFilterChange(): void {
    if (this.selectedFilialeForFilter) {
      this.applyProjekteFilters(this.selectedFilialeForFilter);
    } else if (this.selectedFilialeForModal) {
      this.applyProjekteFilters(this.selectedFilialeForModal);
    } else {
      this.applyProjekteFilters();
    }
    this.refreshProjekteColumnFilterOptionsCachesForExpandedRows();
    this.refreshCurrentColumnFilterOptions();
    this.persistViewState();
  }

  onProjekteColumnFilterCleared(): void {
    const filialeId = this.selectedFilialeForFilter?.id || this.selectedFilialeForModal?.id;
    if (this.currentProjekteFilterField && filialeId) {
      this.getFilialeProjekteColumnFilters(filialeId)[this.currentProjekteFilterField] = [];
    }
    this.onProjekteColumnFilterChange();
  }

  getFilteredProjekte(filiale: Filiale): Projekt[] {
    if (filiale._filteredProjekte !== undefined) {
      return filiale._filteredProjekte;
    }
    this.updateFilialeDerivedData(filiale);
    return filiale._filteredProjekte || [];
  }

  onRowExpand(event: any): void {
    const branchId = parseInt(event.data.id);
    const filialeId = event.data.id;
    const wasExpanded = !!this.expandedRows[filialeId];

    if (!wasExpanded) {
      this.pendingMainTableScrollTop = this.captureMainTableScrollTop();
    }

    this.expandedRows = { [filialeId]: true };
    this.persistViewState();

    const filialeForPrefetch = this.originalFilialen.find((f) => f.id === filialeId);
    if (filialeForPrefetch?.projekte?.length) {
      this.rebuildProjekteColumnFilterOptionsCacheForFiliale(filialeForPrefetch);
    }

    this.cd.detectChanges();
    this.restoreMainTableScrollAfterExpand();

    this.loadingReports[filialeId] = true;

    if (branchId) {
      this.loadReportsForBranch(branchId, filialeId);
    } else {
      this.loadingReports[filialeId] = false;
    }
  }

  onRowCollapse(event: any): void {
    if (event?.data?.id) {
      const { [event.data.id]: _, ...rest } = this.expandedRows || {};
      this.expandedRows = rest;
      this.pendingMainTableScrollTop = null;
      this.persistViewState();
    }
  }

  startSearch(): void {
    // In a real app, you would make an API call here
  }

  // Update showAllStores method to reset search and refresh data
  showAllStores(): void {
    this.searchQuery = '';
    this.showAllFiliales = true;
    this.filialen = [...this.originalFilialen];

    // You would typically make an API call here to load all stores
  }

  onFavoriteChanged(newStatus: boolean, projekt: Projekt): void {
    projekt.isFavorite = newStatus;
    this.filialeSuchenStateService.setFilialeSuchenData(this.originalFilialen);
    this.persistViewState();

    if (newStatus) {
      this.toast.success('Projekt zu Favoriten hinzugefügt');
    } else {
      this.toast.info('Projekt aus Favoriten entfernt');
    }
  }

  toggleFilter(event: Event): void {
    event.preventDefault();
  }

  onSort(field: string): void {
    // Handle main table sorting

    // Toggle sort direction for the field
    if (this.sortField === field) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortDirection = 'asc';
    }

    const direction = this.sortDirection === 'asc' ? 1 : -1;
    this.filialen = this.applyFilialenSorting(this.filialen, field, direction);
    this.originalFilialen = this.applyFilialenSorting(this.originalFilialen, field, direction);
    this.paginationFirst = 0;
    this.currentPage = 1;

    this.persistViewState();
  }

  onPageChange(event: { first?: number; rows?: number }): void {
    const newFirst = event?.first ?? 0;
    const newRows = event?.rows ?? this.pageSize;

    this.paginationFirst = newFirst;
    this.pageSize = newRows;
    this.currentPage = Math.max(1, Math.floor(newFirst / newRows) + 1);
    this.cd.detectChanges();
    this.persistViewState();
  }

  private attachFilialenPaginatorListeners(): void {
    [this.filialenDesktopPaginator, this.filialenMobilePaginator].forEach((paginator) => {
      const element = paginator?.el?.nativeElement as HTMLElement | undefined;
      if (!element || this.filialenPaginatorUnlisteners.has(element)) {
        return;
      }

      const unlisten = this.renderer.listen(element, 'click', () => {
        if (!paginator) {
          return;
        }

        setTimeout(() => {
          const newFirst = paginator.first ?? this.paginationFirst;
          const newRows = paginator.rows ?? this.pageSize;
          if (newFirst !== this.paginationFirst || newRows !== this.pageSize) {
            this.onPageChange({ first: newFirst, rows: newRows });
          }
        }, 50);
      });

      this.filialenPaginatorUnlisteners.set(element, unlisten);
    });
  }

  private detachFilialenPaginatorListeners(): void {
    this.filialenPaginatorUnlisteners.forEach((unlisten) => unlisten());
    this.filialenPaginatorUnlisteners.clear();
  }

  onProjektSort(field: string, filiale: Filiale): void {
    // Handle nested table sorting

    if (!filiale.projekte || filiale.projekte.length === 0) {
      return;
    }

    // Toggle sort direction for the field
    const sortKey = `${filiale.id}_${field}`;
    if (this.projektSortField === sortKey) {
      this.projektSortDirection = this.projektSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.projektSortField = sortKey;
      this.projektSortDirection = 'asc';
    }

    this.updateFilialeDerivedData(filiale);
    const visible = this.filialen.find((f) => f.id === filiale.id);
    if (visible) {
      visible._filteredProjekte = filiale._filteredProjekte;
    }

    this.cd.detectChanges();
    this.persistViewState();
  }

  private applyFilialenSorting(items: Filiale[] = [], field: string, order: number): Filiale[] {
    if (!field) {
      return [...items];
    }

    const sorted = [...items];
    sorted.sort((a, b) => {
      const valueA = this.getFilialeSortValue(a, field);
      const valueB = this.getFilialeSortValue(b, field);

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

  private getFilialeSortValue(filiale: Filiale, field: string): string | number {
    return (filiale as any)?.[field] ?? '';
  }

  private applyProjekteSorting(items: Projekt[] = [], field: string, order: number): Projekt[] {
    if (!field) {
      return [...items];
    }

    const sorted = [...items];
    sorted.sort((a, b) => {
      const valueA = this.getProjektSortValue(a, field);
      const valueB = this.getProjektSortValue(b, field);

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

  private getProjektSortValue(projekt: Projekt, field: string): string | number {
    switch (field) {
      case 'status':
        return (projekt.status as any)?.name || '';
      case 'merchandiser':
        return this.getProjektMerchandiserName(projekt);
      case 'zeitraum':
        return `${projekt.calendarWeek || ''} ${projekt.zeitraum || ''}`.trim();
      case 'geplant': {
        const dateVal = projekt.geplant;
        const parsed = dateVal ? new Date(dateVal).getTime() : 0;
        return isNaN(parsed) ? 0 : parsed;
      }
      case 'kunde':
        return projekt.kunde?.name || '';
      default:
        return (projekt as any)?.[field] ?? '';
    }
  }

  /**
   * Navigate to report detail view
   * @param projekt The project/report to view
   */
  viewReportDetails(projekt: Projekt): void {
    const { projectId, id: reportId } = projekt;

    if (!projectId || !reportId) {
      console.warn('Missing navigation parameters for report detail', { projectId, reportId });
      return;
    }

    this.persistViewState();
    this.router.navigate(['/projects', projectId, 'reports', reportId], {
      queryParams: { referrer: 'filiale-suchen' },
    });
  }

  resetFilters(): void {
    this.searchQuery = '';
    this.filialenColumnFilterValues = {};
    this.projekteColumnFilterValues = {};
    this.projekteColumnFiltersByFilialeId = {};
    this.sortField = '';
    this.sortDirection = 'asc';
    this.projektSortField = '';
    this.projektSortDirection = 'asc';
    this.expandedRows = {};
    this.currentPage = 1;
    this.paginationFirst = 0;
    this.loadFilialen({ showLoader: true });
    this.refreshProjekteColumnFilterOptionsCachesForExpandedRows();
  }

  private restoreViewState(): void {
    const viewState = this.filialeSuchenStateService.getViewStateSnapshot();
    if (!viewState) {
      return;
    }

    this.searchQuery = viewState.searchQuery || '';
    this.filialenColumnFilterValues = this.cloneColumnFilters(viewState.filialenColumnFilterValues);
    this.projekteColumnFilterValues = this.cloneColumnFilters(viewState.projekteColumnFilterValues);
    this.projekteColumnFiltersByFilialeId = viewState.projekteColumnFiltersByFilialeId ? JSON.parse(JSON.stringify(viewState.projekteColumnFiltersByFilialeId)) : {};
    if (Object.keys(this.projekteColumnFiltersByFilialeId).length === 0 && Object.keys(this.projekteColumnFilterValues).length > 0 && Object.keys(this.expandedRows || {}).length === 1) {
      const [filialeId] = Object.keys(this.expandedRows);
      this.projekteColumnFiltersByFilialeId[filialeId] = { ...this.projekteColumnFilterValues };
    }
    this.sortField = viewState.sortField || '';
    this.sortDirection = viewState.sortDirection || 'asc';
    this.projektSortField = viewState.projektSortField || '';
    this.projektSortDirection = viewState.projektSortDirection || 'asc';
    this.expandedRows = viewState.expandedRows || {};
    this.filialeModalScrollPositionById = viewState.filialeModalScrollPositionById ? { ...viewState.filialeModalScrollPositionById } : {};

    if (viewState.scrollPosition !== undefined && viewState.scrollPosition !== null) {
      this.scrollPosition = viewState.scrollPosition;
    }

    if (viewState.pageSize) {
      this.pageSize = viewState.pageSize;
    }
    if (viewState.paginationFirst !== undefined && viewState.paginationFirst !== null) {
      this.paginationFirst = viewState.paginationFirst;
    }
    if (viewState.currentPage) {
      this.currentPage = viewState.currentPage;
    } else if (this.pageSize > 0) {
      this.currentPage = Math.floor(this.paginationFirst / this.pageSize) + 1;
    }

    if (viewState.filialenVisibleColumns) {
      this.filialenVisibleColumns = { ...this.filialenVisibleColumns, ...viewState.filialenVisibleColumns };
    }

    if (Array.isArray(viewState.filialenOrderedColumns) && viewState.filialenOrderedColumns.length > 0) {
      this.filialenOrderedColumns = this.hydrateFilialenOrderedColumns(viewState.filialenOrderedColumns);
    }

    if (Array.isArray(viewState.selectedFilialenColumns) && viewState.selectedFilialenColumns.length > 0) {
      this.selectedFilialenColumns = this.hydrateFilialenOrderedColumns(viewState.selectedFilialenColumns);
    }

    if (viewState.projekteVisibleColumns) {
      this.projekteVisibleColumns = { ...this.projekteVisibleColumns, ...viewState.projekteVisibleColumns };
    }

    if (Array.isArray(viewState.projekteOrderedColumns) && viewState.projekteOrderedColumns.length > 0) {
      this.projekteOrderedColumns = this.hydrateProjekteOrderedColumns(viewState.projekteOrderedColumns);
    }

    if (Array.isArray(viewState.selectedProjekteColumns) && viewState.selectedProjekteColumns.length > 0) {
      this.selectedProjekteColumns = this.hydrateProjekteOrderedColumns(viewState.selectedProjekteColumns);
    }

    this.syncFilialenColumnSelections();
    this.syncProjekteColumnSelections();

    this.persistViewState();
  }

  private cloneColumnFilters(filters: { [field: string]: string[] } | undefined): { [field: string]: string[] } {
    return Object.keys(filters || {}).reduce<{ [field: string]: string[] }>((acc, key) => {
      acc[key] = [...(filters![key] || [])];
      return acc;
    }, {});
  }

  private hydrateFilialenOrderedColumns(storedColumns: StoredColumn[]): Column[] {
    const columnMap = this.filialenCols.reduce<Record<string, Column>>((acc, column) => {
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

    this.filialenCols.forEach((col) => {
      if (!ordered.find((c) => c.field === col.field)) {
        ordered.push(col);
      }
    });

    return ordered;
  }

  private hydrateProjekteOrderedColumns(storedColumns: StoredColumn[]): Column[] {
    const columnMap = this.projekteCols.reduce<Record<string, Column>>((acc, column) => {
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

    this.projekteCols.forEach((col) => {
      if (!ordered.find((c) => c.field === col.field)) {
        ordered.push(col);
      }
    });

    return ordered;
  }

  private syncFilialenColumnSelections(): void {
    if (this.filialenOrderedColumns.length === 0) {
      this.filialenOrderedColumns = [...this.filialenCols];
    }

    this.selectedFilialenColumns = this.filialenOrderedColumns.filter((col) => {
      return this.filialenVisibleColumns[col.field] !== false;
    });

    if (!this.selectedFilialenColumns.length) {
      this.selectedFilialenColumns = [...this.filialenOrderedColumns];
      this.selectedFilialenColumns.forEach((col) => {
        if (this.filialenVisibleColumns[col.field] === undefined) {
          this.filialenVisibleColumns[col.field] = true;
        }
      });
    }
  }

  private syncProjekteColumnSelections(): void {
    if (this.projekteOrderedColumns.length === 0) {
      this.projekteOrderedColumns = [...this.projekteCols];
    }

    this.selectedProjekteColumns = this.projekteOrderedColumns.filter((col) => {
      return this.projekteVisibleColumns[col.field] !== false;
    });

    if (!this.selectedProjekteColumns.length) {
      this.selectedProjekteColumns = [...this.projekteOrderedColumns];
      this.selectedProjekteColumns.forEach((col) => {
        if (this.projekteVisibleColumns[col.field] === undefined) {
          this.projekteVisibleColumns[col.field] = true;
        }
      });
    }
  }

  private getMainTableScrollContainer(): HTMLElement | null {
    const tableEl = this.table?.el?.nativeElement;
    if (tableEl) {
      const scrollableBodies = tableEl.querySelectorAll('.p-datatable-scrollable-body');
      for (let i = 0; i < scrollableBodies.length; i++) {
        const el = scrollableBodies[i] as HTMLElement;
        if (!el.closest('.expanded-row-cell')) {
          return el;
        }
      }

      const wrapper = (tableEl.querySelector('.p-datatable-wrapper') as HTMLElement | null) || (tableEl.querySelector('.p-datatable-table-container') as HTMLElement | null);
      if (wrapper && !wrapper.closest('.expanded-row-cell')) {
        return wrapper;
      }

      const divs = tableEl.querySelectorAll('div');
      for (let i = 0; i < divs.length; i++) {
        const div = divs[i] as HTMLElement;
        if (div.closest('.expanded-row-cell')) {
          continue;
        }
        const style = window.getComputedStyle(div);
        if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
          return div;
        }
      }
      return null;
    }

    return document.querySelector('app-filiale-suchen .filialen-main-table .p-datatable-scrollable-body') as HTMLElement | null;
  }

  private captureMainTableScrollTop(): number {
    const container = this.getMainTableScrollContainer();
    const top = container?.scrollTop ?? this.scrollPosition;
    this.scrollPosition = top;
    return top;
  }

  private restoreMainTableScrollAfterExpand(): void {
    const targetTop = this.pendingMainTableScrollTop;
    if (targetTop == null) {
      return;
    }

    const restoreId = ++this._mainScrollRestoreId;
    let attempts = 0;
    const maxAttempts = 20;

    const apply = () => {
      if (restoreId !== this._mainScrollRestoreId) {
        return;
      }

      const container = this.getMainTableScrollContainer();
      if (!container) {
        if (attempts++ < maxAttempts) {
          requestAnimationFrame(apply);
        }
        return;
      }

      this.attachScrollListener(container);

      if (Math.abs(container.scrollTop - targetTop) > 2) {
        container.scrollTop = targetTop;
        this.scrollPosition = targetTop;
      }

      if (Math.abs(container.scrollTop - targetTop) > 5 && attempts++ < maxAttempts) {
        requestAnimationFrame(apply);
      }
    };

    requestAnimationFrame(apply);
  }

  private persistViewState(): void {
    let currentScrollPosition = this.scrollPosition;

    const scrollContainer = this.getMainTableScrollContainer();
    if (scrollContainer) {
      currentScrollPosition = scrollContainer.scrollTop;
      this.scrollPosition = currentScrollPosition;
    }

    this.captureFilialeModalScrollPosition();
    this.filialeSuchenStateService.setViewState({
      searchQuery: this.searchQuery || '',
      filialenColumnFilterValues: this.filialenColumnFilterValues || {},
      projekteColumnFilterValues: this.projekteColumnFilterValues || {},
      projekteColumnFiltersByFilialeId: this.projekteColumnFiltersByFilialeId || {},
      sortField: this.sortField || '',
      sortDirection: this.sortDirection || 'asc',
      projektSortField: this.projektSortField || '',
      projektSortDirection: this.projektSortDirection || 'asc',
      expandedRows: this.expandedRows || {},
      scrollPosition: currentScrollPosition || 0,
      filialeModalScrollPositionById: { ...this.filialeModalScrollPositionById },
      currentPage: this.currentPage,
      pageSize: this.pageSize,
      paginationFirst: this.paginationFirst,
      filialenVisibleColumns: { ...this.filialenVisibleColumns },
      filialenOrderedColumns: this.filialenOrderedColumns.map((col) => ({ field: col.field, header: col.header })),
      selectedFilialenColumns: this.selectedFilialenColumns.map((col) => ({ field: col.field, header: col.header })),
      projekteVisibleColumns: { ...this.projekteVisibleColumns },
      projekteOrderedColumns: this.projekteOrderedColumns.map((col) => ({ field: col.field, header: col.header })),
      selectedProjekteColumns: this.selectedProjekteColumns.map((col) => ({ field: col.field, header: col.header })),
    });
  }

  private attachScrollListener(element?: HTMLElement): void {
    if (this.scrollListener) {
      return;
    }

    const scrollTarget = element ?? this.getMainTableScrollContainer();
    if (!scrollTarget) {
      return;
    }

    this.scrollListener = this.renderer.listen(scrollTarget, 'scroll', (event) => {
      const target = event.target as HTMLElement;
      if (target.closest('.expanded-row-cell')) {
        return;
      }
      this.scrollPosition = target.scrollTop;
    });
  }

  private restoreScrollPosition(): void {
    const viewState = this.filialeSuchenStateService.getViewStateSnapshot();
    let targetPosition = 0;

    if (viewState && viewState.scrollPosition !== undefined && viewState.scrollPosition !== null) {
      targetPosition = viewState.scrollPosition;
      this.scrollPosition = targetPosition;
    }

    let attempts = 0;
    const maxAttempts = 30; // Try for ~1 second (30 * 30ms)

    const checkAndRestore = () => {
      const scrollableBody = this.getMainTableScrollContainer();

      if (scrollableBody) {
        // Attach listener first to ensure we catch any user scrolls
        this.attachScrollListener(scrollableBody);

        // Restore position instantly
        if (targetPosition > 0 && Math.abs(scrollableBody.scrollTop - targetPosition) > 5) {
          scrollableBody.scrollTop = targetPosition;

          // If it didn't work (content not ready), retry quickly
          if (Math.abs(scrollableBody.scrollTop - targetPosition) > 5 && attempts < maxAttempts) {
            attempts++;
            requestAnimationFrame(checkAndRestore);
          }
        }
      } else if (attempts < maxAttempts) {
        attempts++;
        requestAnimationFrame(checkAndRestore);
      }
    };

    // Start checking immediately
    checkAndRestore();
  }

  // Get value for filiale field display
  getFilialeFieldValue(filiale: Filiale, field: string): string {
    if (field === 'phone') {
      return filiale.phone || '';
    }
    return filiale[field as keyof Filiale]?.toString() || '';
  }

  // Get tooltip value for filiale field
  getFilialeTooltipValue(filiale: Filiale, field: string): string {
    return this.getFilialeFieldValue(filiale, field);
  }

  // Get tooltip value for projekt field
  getProjektTooltipValue(projekt: Projekt, field: string): string {
    return this.getProjektFilterFieldValue(projekt, field);
  }
}
