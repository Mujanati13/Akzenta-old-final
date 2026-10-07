// ...existing imports and decorator...
import { Component, OnInit, OnDestroy, ViewChild, ElementRef, HostListener, ChangeDetectorRef, Renderer2, Inject } from '@angular/core';
import { DOCUMENT, Location } from '@angular/common';
import { ActivatedRoute, Router, NavigationEnd, NavigationStart } from '@angular/router';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TableRowCollapseEvent, TableRowExpandEvent } from 'primeng/table';
import { MenuItem } from 'primeng/api';
import { catchError, of, filter, debounceTime, timeout, distinctUntilChanged, skip } from 'rxjs';
import { ReportService, Report } from '@app/@core/services/report.service';
import { ProjectService } from '@app/@core/services/project.service';
import { ClientService, AssignedProject } from '@app/@core/services/client.service';
import { ProjectsStateService, ProjectsState, Project, ProjectQuestion, StoredColumn, ProjectReportFilters } from './projects-state.service';
import { HotToastService } from '@ngneat/hot-toast';
import { ReportStatusEnum } from '@app/@core/enums/status.enum';
import { categorizeReportForClient } from '@app/@core/utils/report-client-status.util';
import { FilterResetService } from '@core/services/filter-reset.service';
import { InitializerService } from '@app/core/services/initializer.service';
import { MobileFilterColumn, MobileFilterOption } from '@app/shared/components/mobile-filter-sheet/mobile-filter-sheet.component';
import { FilterColumn, FilterOption } from '@app/shared/components/mobile-filter-bottom-sheet/mobile-filter-bottom-sheet.component';

@UntilDestroy()
@Component({
  selector: 'app-projects',
  templateUrl: './projects.component.html',
  styleUrls: ['./projects.component.scss'],
  standalone: false,
})
export class ProjectsComponent implements OnInit, OnDestroy {
  private static readonly EMPTY_FILTER_VALUE = '__EMPTY__';
  private static readonly EMPTY_FILTER_LABEL = '---';
  private static readonly CLIENT_CONFIDENTIAL_REPORT_FIELDS = ['note', 'merchandiser'];
  private static readonly CLIENT_REPORT_BASE_COLUMNS: StoredColumn[] = [
    { field: 'plannedOn', header: 'Geplant' },
    { field: 'branch.client.name', header: 'Kunde' },
    { field: 'branch.name', header: 'Filiale' },
    { field: 'address', header: 'Adresse' },
    { field: 'reportTo', header: 'Report bis' },
    { field: 'feedback', header: 'Feedback' },
  ];
  activeFilter: 'all' | 'running' | 'completed' = 'all';
  dateRange: Date[] = [];
  projects: Project[] = [];
  selectedProject: Project | null = null;
  expandedRows: { [key: string]: boolean } = {};
  cols: StoredColumn[] = [];
  selectedColumns: StoredColumn[] = [];
  reportCols: StoredColumn[] = [];
  selectedReportColumns: StoredColumn[] = [];

  // Filter properties
  showProjectsMobileFilterSheet = false;
  projectsMobileColumns: MobileFilterColumn[] = [];
  projectsMobileFilterValues: { [field: string]: string[] } = {};
  projectsMobileColumnOptions: { [field: string]: MobileFilterOption[] } = {};
  projectsMobileCanFilterMap: { [field: string]: boolean } = {};

  projectSearchTerm: string = '';
  filialeSearchTerm: string = '';
  filteredProjects: Project[] = [];

  // Loading state
  isLoadingProjects = false;
  loadingReports: { [projectId: string]: boolean } = {};
  downloadingExcel: { [projectId: string]: boolean } = {};
  private isLoadingProjectsLock = false; // Prevent multiple simultaneous loads
  private loadingTimeoutId: any = null; // Timeout to force reset loading state

  // Sort properties
  projectSortField: string = '';
  projectSortOrder: number = 1;
  reportSortField: string = '';
  reportSortOrder: number = 1;

  // Column management
  projectsOrderedColumns: StoredColumn[] = [];
  reportsOrderedColumns: StoredColumn[] = [];
  projectsVisibleColumns: { [key: string]: boolean } = {};
  reportsVisibleColumns: { [key: string]: boolean } = {};

  // Report filters
  reportStatusFilter: string[] = [];
  reportMerchandiserFilter: string[] = [];
  reportFilialenFilter: string[] = [];
  reportPlannedOnFilter: string[] = [];

  // Project column filters
  projectColumnFilterValues: { [field: string]: string[] } = {};
  currentProjectFilterField: string = '';
  currentProjectColumnOptions: { label: string; value: string }[] = [];

  /** Mobile (lg:hidden): full-screen sidebar for project reports */
  sidebarVisibleProjectId: string | null = null;

  /** Mobile: Aufträge filter bottom sheet (inside Projekt Aufträge sidebar) */
  showReportsMobileFilterSheet = false;
  reportMobileColumns: FilterColumn[] = [];
  reportMobileFilterValues: { [field: string]: string[] } = {};
  reportMobileColumnOptions: { [field: string]: FilterOption[] } = {};
  reportMobileCanFilterMap: { [field: string]: boolean } = {};

  // Mobile column filter modal (centered dialog on small screens)
  showColumnFilterModal = false;
  columnFilterModalType: 'project' | 'reportStatus' | 'reportMerchandiser' | 'reportFilialen' | 'reportPlannedOn' | 'reportGeneric' = 'project';

  // Generic filter properties
  genericFilterValues: { [field: string]: string[] } = {};
  currentGenericOptions: { label: string; value: string }[] = [];

  // Cached filter options
  currentReportStatusOptions: { label: string; value: string; name: string; color: string }[] = [];
  currentMerchandiserOptions: { label: string; value: string }[] = [];
  currentFilialenOptions: { label: string; value: string }[] = [];
  currentPlannedOnOptions: { label: string; value: string }[] = [];

  // New cached options for listbox refactor (Client App)
  currentReportMerchandiserOptions: { label: string; value: string }[] = [];
  currentReportBranchOptions: { label: string; value: string }[] = [];
  currentReportPlannedDateOptions: { label: string; value: string }[] = [];
  currentReportDoneDateOptions: { label: string; value: string }[] = [];

  currentFilterField: string = '';

  // Date range filter
  dateRange2: { start: Date | null; end: Date | null } = { start: null, end: null };

  // Default values applied when a project has no stored column filters
  // These are global filters that apply to all projects
  private defaultReportFilters: ProjectReportFilters = {
    status: [],
    merchandiser: [],
    filialen: [],
    plannedOn: [],
    generic: {},
  };

  @ViewChild('csvFileInput') csvFileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('cmReports') cmReports: any;
  @ViewChild('genericFilterPopover') genericFilterPopover: any;
  @ViewChild('projectColumnFilterPopover') projectColumnFilterPopover: any;
  @ViewChild('statusFilterPopover') statusFilterPopover: any;
  @ViewChild('merchandiserFilterPopover') merchandiserFilterPopover: any;
  @ViewChild('filialenFilterPopover') filialenFilterPopover: any;
  @ViewChild('plannedOnFilterPopover') plannedOnFilterPopover: any;
  // Report filters popovers
  @ViewChild('reportStatusFilterPopover') reportStatusFilterPopover: any;
  @ViewChild('reportMerchandiserFilterPopover') reportMerchandiserFilterPopover: any;
  @ViewChild('reportFilialenFilterPopover') reportFilialenFilterPopover: any;
  @ViewChild('reportPlannedDateFilterPopover') reportPlannedDateFilterPopover: any;
  @ViewChild('reportDoneDateFilterPopover') reportDoneDateFilterPopover: any;

  @ViewChild('op') op: any;
  @ViewChild('reportColumnsPopover') reportColumnsPopover: any;

  reportMenuItems: MenuItem[] = [];
  selectedReport: Report | null = null;

  csvDialogVisible = false;
  isUpload = false;
  dialogMessage = '';
  uploadedCsvData: any[] = [];
  csvDialogIsError: boolean = false;
  statusFilter: string = '';
  private previousNavigationUrl: string = '';
  private hasExpandedAllOnLoad: boolean = false; // Track if we've already expanded all projects on initial load
  private initialAutoExpandDone: boolean = false; // Track if we've already done the initial auto-expand of first project

  private clickOutsideListener?: () => void;
  private reportsTableScrollListener?: () => void;
  private reportsTableScrollPosition: number = 0;
  private projectsTableScrollPosition: number = 0;
  private isRestoringScroll: boolean = false; // Flag to prevent multiple simultaneous restores
  private isRestoringProjectsScroll: boolean = false;
  private nextUrl: string | null = null;
  private hasRestoredScrollThisCycle: boolean = false; // Flag to track if scroll has been restored in current navigation cycle
  private activeFilterPopover: any = null;
  private activeFilterId: string | null = null;
  private filterPopoverTimeout: any = null;
  private activeSettingsPopover: any = null;
  private projectColumnOptionsCache = new Map<string, { label: string; value: string }[]>();
  private projectColumnDataCache = new Map<string, boolean>();
  private filteredReportsCache = new Map<string, Report[]>();
  private filterOptionsSignature = '';

  // Check if can go back (has navigation history)
  canGoBack: boolean = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private reportService: ReportService,
    private projectService: ProjectService,
    private clientService: ClientService,
    private projectsStateService: ProjectsStateService,
    private toast: HotToastService,
    private filterResetService: FilterResetService,
    private initializerService: InitializerService,
    private cdr: ChangeDetectorRef,
    private renderer: Renderer2,
    @Inject(DOCUMENT) private document: Document,
    private location: Location,
  ) {
    // Check if we have navigation history
    const navigation = this.router.getCurrentNavigation();
    this.canGoBack = !!navigation?.previousNavigation;
  }

  navigateBack(): void {
    if (this.canGoBack) {
      this.location.back();
    }
  }

  onFavoriteChanged(isFavorite: boolean, project: Project): void {
    if (!project.id) return;

    // Optimistic update
    project.isFavorite = isFavorite;

    this.projectService.toggleFavoriteStatus(project.id.toString()).subscribe({
      next: () => {
        this.toast.success(isFavorite ? 'Projekt zu Favoriten hinzugefügt' : 'Projekt aus Favoriten entfernt');
      },
      error: (err) => {
        // Revert on error
        project.isFavorite = !isFavorite;
        this.toast.error('Fehler beim Aktualisieren des Favoritenstatus');
        console.error('Error toggling project favorite:', err);
      },
    });
  }

  onReportFavoriteChanged(isFavorite: boolean, report: Report): void {
    if (!report.id) return;

    // Optimistic update
    report.isFavorite = isFavorite;

    this.reportService.toggleFavoriteStatus(report.id).subscribe({
      next: () => {
        this.toast.success(isFavorite ? 'Bericht zu Favoriten hinzugefügt' : 'Bericht aus Favoriten entfernt');
      },
      error: (err) => {
        // Revert
        report.isFavorite = !isFavorite;
        this.toast.error('Fehler beim Aktualisieren des Favoritenstatus');
        console.error('Error toggling report favorite:', err);
      },
    });
  }

  initContextMenu(): void {
    this.reportMenuItems = [
      {
        label: 'In neuem Tab öffnen',
        icon: 'pi pi-external-link',
        command: () => this.openReportInNewTab(this.selectedReport),
      },
    ];
  }

  openReportInNewTab(report: Report | null): void {
    if (!report || !report.id) {
      return;
    }
    const project = this.projects.find((p) => p.reports?.some((r) => r.id === report.id));
    if (!project?.id) {
      return;
    }
    const urlTree = this.router.createUrlTree(['/projects', project.id, 'reports', report.id]);
    const url = window.location.origin + urlTree.toString();
    window.open(url, '_blank');
  }

  ngOnInit(): void {
    this.filterResetService.reset$.pipe(untilDestroyed(this)).subscribe(() => {
      this.projectsStateService.clearCache();
      this.activeFilter = 'all';
      this.statusFilter = '';
      this.projectSearchTerm = '';
      this.filialeSearchTerm = '';
      this.dateRange = [];
      this.dateRange2 = { start: null, end: null };
      this.projectColumnFilterValues = {};
      this.genericFilterValues = {};
      this.reportStatusFilter = [];
      this.reportMerchandiserFilter = [];
      this.reportFilialenFilter = [];
      this.reportPlannedOnFilter = [];
      this.loadProjects();
    });

    // Initialize context menu
    this.initContextMenu();

    // Restore status filter from query params first (before restoring state)
    // This matches HeadOffice behavior - query params take precedence
    const queryStatusFilter = this.route.snapshot.queryParamMap.get('status');
    const normalizedQueryStatusFilter = this.normalizeStatusFilter(queryStatusFilter);
    if (normalizedQueryStatusFilter) {
      this.statusFilter = normalizedQueryStatusFilter;
    } else {
      this.statusFilter = '';
    }

    // Restore filter state from service
    this.restoreState();
    this.closeReportsSidebarOnDesktop();

    this.initializeColumns();

    // Try to restore from cache first
    const cachedState = this.projectsStateService.getStateSnapshot();
    if (cachedState && this.projectsStateService.isCacheValid() && cachedState.projects && cachedState.projects.length > 0) {
      this.projects = cachedState.projects || [];
      this.isLoadingProjects = false;

      // Restore per-project filters map and ensure reports are preserved
      if (cachedState.projectReportFilters) {
        this.projects.forEach((p) => {
          if (p.id && cachedState.projectReportFilters && cachedState.projectReportFilters[p.id]) {
            p._reportFilters = cachedState.projectReportFilters[p.id];
          }
          // Ensure reports from cache are preserved
          const cachedProject = cachedState.projects?.find((cp) => cp.id === p.id);
          if (cachedProject && cachedProject.reports && cachedProject.reports.length > 0) {
            p.reports = cachedProject.reports;
            // Recalculate branchesCount
            const uniqueBranches = new Set<string>();
            p.reports.forEach((report: any) => {
              if (report.branch?.id) {
                uniqueBranches.add(report.branch.id.toString());
              }
            });
            p.branchesCount = uniqueBranches.size;
          }
        });
      }

      // Apply filters after projects are loaded
      this.applyFilters();

      // Check if status filter is in query params - if so, expand all projects
      // Note: statusFilter was already set above from query params
      /*
      if (this.statusFilter) {
        const projectId = this.route.snapshot.params['projectId'];
        // If there's a status filter and no specific project selected, expand all projects
        if (!projectId) {
          // Use setTimeout to ensure filteredProjects is populated
          setTimeout(() => {
            this.expandAllFilteredProjects();
          }, 50);
        }
      }
      */

      // After projects are loaded, check if we need to expand a specific project
      this.checkAndExpandProjectFromRoute();

      const expandedProjectId = Object.keys(this.expandedRows).find((id) => this.expandedRows[id]);
      if (expandedProjectId) {
        const expandedProject = this.projects.find((p) => p.id?.toString() === expandedProjectId);
        if (expandedProject) {
          if (!this.selectedProject) {
            this.selectedProject = expandedProject;
          }
          this.updateReportColumnsForProject(expandedProject);
          this.updateProjectDerivedData(expandedProject);
        }
      }

      // Restore scroll position if a project is already expanded
      if (Object.keys(this.expandedRows).length > 0) {
        setTimeout(() => {
          this.onProjectExpanded();
        }, 200);
      }

      // Restore projects table scroll position
      setTimeout(() => {
        this.restoreProjectsTableScrollPosition();
      }, 200);

      // Load fresh data in background (but don't reload reports if they're already cached)
      setTimeout(() => {
        this.loadProjects({ showLoader: false });
      }, 100);
    } else {
      // No valid cache, load from server with loader
      this.loadProjects({ showLoader: true });
    }

    // Listen for client company changes and reload projects
    this.initializerService.currentClientCompany$
      .pipe(
        distinctUntilChanged((previous, current) => previous?.id === current?.id),
        skip(1),
        untilDestroyed(this),
      )
      .subscribe(() => {
        this.projectsStateService.clearCache();
        this.clearFiltersOnNavigation();
        this.loadProjects({ showLoader: true });
      });

    this.setupRouteListener();
    this.setupNavigationListener();
  }

  onRangeSelected(range: { start: Date | null; end: Date | null }) {
    this.dateRange2 = range;
    this.applyFilters();
  }

  // Add these methods for the filter buttons
  showAllClients(): void {
    this.activeFilter = 'all';
    // Reset date range when showing all projects
    this.dateRange = [];
    this.dateRange2 = { start: null, end: null };
    this.applyFilters();
  }

  showRunningProjects(): void {
    this.activeFilter = 'running';
    this.applyFilters();
  }

  showCompletedProjects(): void {
    this.activeFilter = 'completed';
    this.applyFilters();
  }

  hasProjectsMobileFilterSheetBadge(): boolean {
    if (this.projectSearchTerm?.trim() || this.filialeSearchTerm?.trim()) {
      return true;
    }
    if (this.dateRange2?.start && this.dateRange2?.end) {
      return true;
    }
    let colCount = 0;
    const fields = ['name', ...(this.selectedColumns || []).map((c) => c.field)];
    for (const f of fields) {
      colCount += (this.projectColumnFilterValues[f] || []).length;
    }
    return colCount > 0;
  }

  openProjectsMobileFilterSheet(): void {
    this.refreshProjectsMobileFilterSheetState();
    this.showProjectsMobileFilterSheet = true;
  }

  private refreshProjectsMobileFilterSheetState(): void {
    this.projectsMobileColumns = [{ field: 'name', header: 'Projekt' }, ...(this.selectedColumns || []).map((c) => ({ field: c.field, header: c.header }))];

    const nextValues: { [key: string]: string[] } = {};
    const nextOptions: { [key: string]: { label: string; value: string }[] } = {};
    const nextCanFilter: { [key: string]: boolean } = {};

    for (const col of this.projectsMobileColumns) {
      const field = col.field;
      nextValues[field] = [...(this.projectColumnFilterValues[field] || [])];
      nextOptions[field] = this.getUniqueValuesForProjectColumn(field);
      nextCanFilter[field] = (nextOptions[field]?.length || 0) > 0 || nextValues[field].length > 0;
    }

    this.projectsMobileFilterValues = nextValues;
    this.projectsMobileColumnOptions = nextOptions;
    this.projectsMobileCanFilterMap = nextCanFilter;
  }

  onProjectsMobileFilterChanged(event: { field: string; values: string[] }): void {
    const f = event.field;
    const v = event.values || [];
    this.projectColumnFilterValues[f] = [...v];
    this.projectsMobileFilterValues[f] = [...v];
    this.projectsMobileFilterValues = { ...this.projectsMobileFilterValues };
    this.applyFilters();
  }

  onProjectsMobileColumnFiltersCleared(): void {
    this.projectsMobileColumns.forEach((col) => {
      this.projectColumnFilterValues[col.field] = [];
    });
    this.projectsMobileFilterValues = {};
    this.applyFilters();
  }

  onProjectsSheetProjectSearch(term: string): void {
    this.projectSearchTerm = term.toLowerCase();
    this.applyFilters();
    this.refreshProjectsMobileFilterSheetState();
  }

  onProjectsSheetFilialeSearch(term: string): void {
    this.filialeSearchTerm = term.toLowerCase();
    this.applyFilters();
    this.refreshProjectsMobileFilterSheetState();
  }

  private initializeColumns(): void {
    // Initialize project columns
    this.cols = [
      { field: 'formattedZeitraum', header: 'Zeitraum' },
      { field: 'filialen', header: 'Filialen' },
      { field: 'status', header: 'Status' },
    ];

    // Use stored selected columns if available, otherwise default
    const storedState = this.projectsStateService.getStateSnapshot();
    if (storedState && storedState.selectedColumns) {
      this.selectedColumns = storedState.selectedColumns;
    } else {
      this.selectedColumns = [...this.cols];
    }

    // Initialize report columns (note and merchandiser are internal-only)
    this.reportCols = [...ProjectsComponent.CLIENT_REPORT_BASE_COLUMNS];

    // Use stored selected report columns if available, otherwise default
    if (storedState && storedState.selectedReportColumns) {
      this.selectedReportColumns = this.excludeConfidentialReportColumns(storedState.selectedReportColumns);
    } else {
      this.selectedReportColumns = this.getDefaultSelectedReportColumns();
    }

    // Initialize ordered columns
    if (storedState && storedState.projectsOrderedColumns) {
      this.projectsOrderedColumns = storedState.projectsOrderedColumns;
    } else {
      this.projectsOrderedColumns = [...this.cols];
    }

    if (storedState && storedState.reportsOrderedColumns) {
      this.reportsOrderedColumns = this.excludeConfidentialReportColumns(storedState.reportsOrderedColumns);
    } else {
      this.reportsOrderedColumns = [...this.reportCols];
    }

    // Initialize visible columns
    this.initializeVisibleColumns();
    this.sanitizeReportColumnState();
  }

  private isConfidentialReportField(field: string): boolean {
    return ProjectsComponent.CLIENT_CONFIDENTIAL_REPORT_FIELDS.includes(field);
  }

  private excludeConfidentialReportColumns(columns: StoredColumn[] = []): StoredColumn[] {
    return columns.filter((col) => !this.isConfidentialReportField(col.field));
  }

  private getDefaultSelectedReportColumns(): StoredColumn[] {
    return ProjectsComponent.CLIENT_REPORT_BASE_COLUMNS.filter((col) => col.field !== 'feedback');
  }

  private isAllowedStoredReportColumn(col: StoredColumn): boolean {
    if (this.isConfidentialReportField(col.field)) {
      return false;
    }
    if (col.field.startsWith('question_')) {
      return true;
    }
    return ProjectsComponent.CLIENT_REPORT_BASE_COLUMNS.some((baseCol) => baseCol.field === col.field);
  }

  private sanitizeReportColumnState(): void {
    this.reportsOrderedColumns = this.excludeConfidentialReportColumns((this.reportsOrderedColumns || []).filter((col) => this.isAllowedStoredReportColumn(col)));
    if (this.reportsOrderedColumns.length === 0) {
      this.reportsOrderedColumns = [...ProjectsComponent.CLIENT_REPORT_BASE_COLUMNS];
    }

    this.selectedReportColumns = this.excludeConfidentialReportColumns((this.selectedReportColumns || []).filter((col) => this.isAllowedStoredReportColumn(col)));
    if (this.selectedReportColumns.length === 0) {
      this.selectedReportColumns = [...this.getDefaultSelectedReportColumns()];
    }

    Object.keys(this.reportsVisibleColumns || {}).forEach((field) => {
      if (this.isConfidentialReportField(field)) {
        delete this.reportsVisibleColumns[field];
      }
    });

    Object.keys(this.genericFilterValues || {}).forEach((field) => {
      if (this.isConfidentialReportField(field)) {
        delete this.genericFilterValues[field];
      }
    });
  }

  getClientReportSettingsColumns(): StoredColumn[] {
    return this.excludeConfidentialReportColumns(this.reportCols);
  }

  resetReportColumnsToDefault(): void {
    const defaultColumns = [...this.getDefaultSelectedReportColumns(), ...this.getOverviewQuestionColumns(this.selectedProject)];
    this.onReportsColumnsChange(defaultColumns);
  }

  private syncProjectQuestions(project: Project): void {
    const reportQuestions = project.reports?.[0]?.project?.questions;
    if (Array.isArray(reportQuestions) && reportQuestions.length > 0) {
      project.questions = reportQuestions;
    }
  }

  private getOverviewQuestions(project: Project): ProjectQuestion[] {
    const questions = project.questions || project.reports?.[0]?.project?.questions || [];
    return (questions as ProjectQuestion[])
      .filter((q) => q.showInOverview && q.isVisibleToClient !== false && !!q.questionText?.trim())
      .sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
  }

  private getOverviewQuestionColumns(project?: Project | null): StoredColumn[] {
    if (!project) {
      return [];
    }

    return this.getOverviewQuestions(project).map((q) => ({
      field: `question_${q.id}`,
      header: q.questionText,
    }));
  }

  private updateReportColumnsForProject(project: Project): void {
    this.syncProjectQuestions(project);

    const baseCols = [...ProjectsComponent.CLIENT_REPORT_BASE_COLUMNS];
    const questionCols: StoredColumn[] = this.getOverviewQuestions(project).map((q) => ({
      field: `question_${q.id}`,
      header: q.questionText,
    }));

    this.reportCols = [...baseCols, ...questionCols];

    const previousOrdered = this.reportsOrderedColumns || [];
    const baseOrdered = previousOrdered.filter((col) => !col.field.startsWith('question_') && baseCols.some((baseCol) => baseCol.field === col.field));
    const orderedBase = baseOrdered.length > 0 ? baseOrdered : baseCols.filter((col) => previousOrdered.some((ordered) => ordered.field === col.field));
    this.reportsOrderedColumns = [...(orderedBase.length > 0 ? orderedBase : baseCols), ...questionCols];

    const newVisibleColumns: { [key: string]: boolean } = {};
    this.reportCols.forEach((col) => {
      if (col.field.startsWith('question_')) {
        newVisibleColumns[col.field] = true;
      } else if (this.reportsVisibleColumns[col.field] !== undefined) {
        newVisibleColumns[col.field] = this.reportsVisibleColumns[col.field];
      } else {
        newVisibleColumns[col.field] = col.field !== 'feedback';
      }
    });
    this.reportsVisibleColumns = newVisibleColumns;

    const selectedBase = this.excludeConfidentialReportColumns((this.selectedReportColumns || []).filter((col) => !col.field.startsWith('question_'))).filter((col) =>
      baseCols.some((baseCol) => baseCol.field === col.field),
    );

    this.selectedReportColumns = [...(selectedBase.length > 0 ? selectedBase : this.getDefaultSelectedReportColumns()), ...questionCols];
    this.sanitizeReportColumnState();
  }

  private formatAnswerValue(answers: any[], answerTypeName: string = ''): string {
    if (!answers?.length) {
      return '';
    }

    const normalizedType = (answerTypeName || '').toLowerCase().trim();

    if (normalizedType === 'boolean') {
      const answer = answers[0];
      if (answer.selectedOption?.optionText) {
        const optionText = answer.selectedOption.optionText.toLowerCase();
        if (optionText.includes('ja') || optionText === 'yes') {
          return 'Ja';
        }
        if (optionText.includes('nein') || optionText === 'no') {
          return 'Nein';
        }
        return answer.selectedOption.optionText;
      }
      if (answer.textAnswer) {
        const textAnswer = answer.textAnswer.toLowerCase();
        if (textAnswer === 'true' || textAnswer === 'ja') {
          return 'Ja';
        }
        if (textAnswer === 'false' || textAnswer === 'nein') {
          return 'Nein';
        }
        return answer.textAnswer;
      }
      return '';
    }

    if (normalizedType === 'multiselect' || normalizedType === 'multiple choice') {
      return answers
        .map((answer) => answer.selectedOption?.optionText)
        .filter((optionText): optionText is string => !!optionText)
        .join(', ');
    }

    const answer = answers[0];
    if (answer.textAnswer) {
      return answer.textAnswer;
    }
    if (answer.selectedOption?.optionText) {
      return answer.selectedOption.optionText;
    }
    return '';
  }

  private initializeVisibleColumns(): void {
    // Reset visibility maps
    this.projectsVisibleColumns = {};
    this.reportsVisibleColumns = {};

    // Set visible based on selectedColumns
    if (this.selectedColumns) {
      this.selectedColumns.forEach((col) => {
        this.projectsVisibleColumns[col.field] = true;
      });
    }

    if (this.selectedReportColumns) {
      this.selectedReportColumns.forEach((col) => {
        this.reportsVisibleColumns[col.field] = true;
      });
    }
  }

  private loadProjects(options: { showLoader?: boolean } = { showLoader: true }): void {
    // Capture scroll position before refreshing data (if it's a background refresh)
    if (!options.showLoader) {
      this.captureReportsTableScrollPosition();
    }

    if (this.isLoadingProjectsLock && options.showLoader) {
      return;
    }

    if (this.isLoadingProjects && options.showLoader) {
      return;
    }

    if (options.showLoader) {
      this.isLoadingProjectsLock = true;
      this.isLoadingProjects = true;

      // Force change detection
      this.cdr.detectChanges();

      // Safety timeout: if loading takes more than 30 seconds, force reset
      if (this.loadingTimeoutId) {
        clearTimeout(this.loadingTimeoutId);
      }
      this.loadingTimeoutId = setTimeout(() => {
        if (this.isLoadingProjects) {
          console.error('⚠️ [loadProjects] TIMEOUT: Loading took too long, forcing reset');
          this.isLoadingProjects = false;
          this.isLoadingProjectsLock = false;
          this.cdr.detectChanges();
          this.toast.error('Timeout beim Laden der Projekte', {
            position: 'bottom-right',
            duration: 4000,
          });
        }
      }, 30000); // 30 second timeout
    }

    this.clientService
      .getAssignedProjects({ scope: 'all' })
      .pipe(
        timeout(25000), // 25 second timeout for the HTTP request
        catchError((error) => {
          console.error('❌ [loadProjects] Error loading assigned projects:', error);
          if (this.loadingTimeoutId) {
            clearTimeout(this.loadingTimeoutId);
            this.loadingTimeoutId = null;
          }
          if (options.showLoader) {
            this.toast.error('Fehler beim Laden der Projekte', {
              position: 'bottom-right',
              duration: 4000,
            });
          }
          this.isLoadingProjects = false;
          this.isLoadingProjectsLock = false;
          this.cdr.detectChanges();
          return of([]);
        }),
        untilDestroyed(this),
      )
      .subscribe({
        next: (assignedProjects) => {
          try {
            this.initializerService.setAllAssignedProjects(assignedProjects);
            const companyProjects = this.initializerService.filterProjectsByClientCompany(assignedProjects);

            // Store existing projects with their reports before replacing
            const existingProjectsMap = new Map<string, Project>();
            this.projects.forEach((p) => {
              if (p.id) {
                existingProjectsMap.set(p.id.toString(), p);
              }
            });

            // Convert AssignedProject to Project interface
            const transformedProjects = companyProjects.map((ap) => {
              const transformed = this.transformAssignedProjectToProject(ap);

              // Restore filters and REPORTS from existing projects if reloaded
              const existingProject = existingProjectsMap.get(transformed.id || '');
              if (existingProject) {
                // Preserve filters
                if (existingProject._reportFilters) {
                  transformed._reportFilters = existingProject._reportFilters;
                }
                // Preserve reports if they exist (don't lose them on refresh)
                if (existingProject.reports && existingProject.reports.length > 0) {
                  transformed.reports = existingProject.reports;
                  transformed.branchesCount = existingProject.branchesCount;
                }
              }

              return transformed;
            });

            // Capture scroll positions before update (both projects and reports tables)
            // This must happen BEFORE any data changes to preserve current scroll position
            const hadExpandedRows = Object.keys(this.expandedRows).length > 0;
            const savedProjectsScroll = this.projectsTableScrollPosition;
            const savedReportsScroll = this.reportsTableScrollPosition;

            // Capture current scroll positions from DOM before data update
            this.captureProjectsTableScrollPosition();
            if (hadExpandedRows) {
              this.captureReportsTableScrollPosition();
            }

            // Use captured positions (or saved if capture didn't work)
            if (this.projectsTableScrollPosition === 0 && savedProjectsScroll > 0) {
              this.projectsTableScrollPosition = savedProjectsScroll;
            }
            if (this.reportsTableScrollPosition === 0 && savedReportsScroll > 0) {
              this.reportsTableScrollPosition = savedReportsScroll;
            }

            // Check if data has changed to avoid unnecessary re-renders and scroll resets
            const hasChanged = JSON.stringify(this.projects) !== JSON.stringify(transformedProjects);

            if (hasChanged) {
              // Update component state
              this.projects = transformedProjects;

              // Pre-calculate _displayedFilialen for all projects before applying filters
              // This ensures the count is available when the template renders
              this.projects.forEach((project) => {
                this.updateProjectDerivedData(project);
              });

              // Apply filters after projects are loaded (before saving state)
              this.applyFilters();

              // Save to store (after filters are applied)
              this.saveState();

              // Restore scroll positions after data update and filters are applied
              // Use multiple attempts with increasing delays to ensure scroll sticks after table re-render
              if (this.projectsTableScrollPosition > 0) {
                const savedProjectsScroll = this.projectsTableScrollPosition;
                // First restore attempt
                setTimeout(() => {
                  this.restoreProjectsTableScrollPosition('auto');
                }, 100);
                // Second restore attempt (table might still be rendering)
                setTimeout(() => {
                  if (this.projectsTableScrollPosition === savedProjectsScroll) {
                    this.restoreProjectsTableScrollPosition('auto');
                  }
                }, 300);
                // Final restore attempt (ensures scroll sticks after all rendering is complete)
                setTimeout(() => {
                  if (this.projectsTableScrollPosition === savedProjectsScroll) {
                    this.restoreProjectsTableScrollPosition('auto');
                  }
                }, 600);
              }

              // Restore reports table scroll if a project is expanded
              if (hadExpandedRows && this.reportsTableScrollPosition > 0) {
                const savedReportsScroll = this.reportsTableScrollPosition;
                const restoreReportsScroll = () => {
                  // Reset the flag to allow restoration
                  this.hasRestoredScrollThisCycle = false;
                  this.onProjectExpanded();
                };

                // First restore attempt
                setTimeout(restoreReportsScroll, 150);
                // Second restore attempt (table might still be rendering)
                setTimeout(() => {
                  if (this.reportsTableScrollPosition === savedReportsScroll) {
                    this.hasRestoredScrollThisCycle = false;
                    this.onProjectExpanded();
                  }
                }, 350);
                // Final restore attempt (ensures scroll sticks after all rendering is complete)
                setTimeout(() => {
                  if (this.reportsTableScrollPosition === savedReportsScroll) {
                    this.hasRestoredScrollThisCycle = false;
                    this.onProjectExpanded();
                  }
                }, 650);
              }
            } else {
            }

            // Check if status filter is in query params - if so, expand all filtered projects
            const queryStatusFilter = this.route.snapshot.queryParamMap.get('status');
            /*
            if (queryStatusFilter) {
              this.statusFilter = this.normalizeStatusFilter(queryStatusFilter);
              const projectId = this.route.snapshot.params['projectId'];
              // If there's a status filter and no specific project selected, expand all filtered projects
              if (!projectId) {
                setTimeout(() => {
                  this.expandAllFilteredProjects();
                }, 100);
              }
            }
            */

            // After projects are loaded, check if we need to expand a specific project
            this.checkAndExpandProjectFromRoute();

            // Restore scroll position after background refresh (if it was a background refresh)
            if (!options.showLoader) {
              if (Object.keys(this.expandedRows).length > 0) {
                setTimeout(() => {
                  this.onProjectExpanded();
                }, 200);
              }
              // Note: Scroll restoration for projects table is handled inside the hasChanged block above
              // or by the initial restore in ngOnInit
            }
          } catch (error) {
            console.error('❌ [loadProjects] Error processing projects data:', error);
            this.toast.error('Fehler bei der Verarbeitung der Projektdaten');
          } finally {
            if (this.loadingTimeoutId) {
              clearTimeout(this.loadingTimeoutId);
              this.loadingTimeoutId = null;
            }
            this.isLoadingProjects = false;
            this.isLoadingProjectsLock = false;
            this.cdr.detectChanges();
          }
        },
        error: (error) => {
          console.error('❌ [loadProjects] Subscribe error handler:', error);
          if (this.loadingTimeoutId) {
            clearTimeout(this.loadingTimeoutId);
            this.loadingTimeoutId = null;
          }
          this.isLoadingProjects = false;
          this.isLoadingProjectsLock = false;
          this.cdr.detectChanges();
        },
        complete: () => {
          if (this.loadingTimeoutId) {
            clearTimeout(this.loadingTimeoutId);
            this.loadingTimeoutId = null;
          }
          // Ensure loading state is reset even if complete fires
          if (this.isLoadingProjects) {
            this.isLoadingProjects = false;
            this.isLoadingProjectsLock = false;
            this.cdr.detectChanges();
          }
        },
      });
  }

  /**
   * Transform AssignedProject from API to Project interface for the component
   */
  private transformAssignedProjectToProject(assignedProject: AssignedProject): Project {
    const startDate = new Date(assignedProject.startDate);
    const endDate = new Date(assignedProject.endDate);

    // Generate date range string
    const zeitraum = `${startDate.getDate().toString().padStart(2, '0')}.${(startDate.getMonth() + 1).toString().padStart(2, '0')}. - ${endDate.getDate().toString().padStart(2, '0')}.${(endDate.getMonth() + 1).toString().padStart(2, '0')}.${endDate.getFullYear()}`;

    // Generate week number
    const calendarWeek = `KW ${this.getWeekNumber(startDate)}`;

    // Generate slug from name
    const slug = assignedProject.name
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');

    // Determine status based on dates if not provided by API
    let status = assignedProject.status || 'running';
    if (!assignedProject.status) {
      const today = new Date();
      if (endDate < today) {
        status = 'completed';
      }
    }

    return {
      id: assignedProject.id.toString(),
      name: assignedProject.name,
      slug: slug,
      clientId: assignedProject.clientCompany?.id?.toString() || '1',
      clientName: assignedProject.clientCompany?.name || 'Unknown Client',
      zeitraum: zeitraum,
      calendarWeek: calendarWeek,
      filialen: 0,
      branchesCount: this.getInitialBranchesCount(assignedProject),
      status: status,
      isFavorite: assignedProject.isFavorite,
      // Keep undefined until reports are actually loaded, so pre-expand counters can use API fallback values.
      reports: undefined,
      reportedPercentage: assignedProject.reportedPercentage,
      startDate: assignedProject.startDate,
      endDate: assignedProject.endDate,
    };
  }

  /**
   * Resolve initial store/branch count from API payload variants.
   * This keeps "Stores" populated before opening/expanding a project.
   */
  private getInitialBranchesCount(assignedProject: AssignedProject): number {
    const rawProject = assignedProject as AssignedProject & {
      filialen?: number;
      storesCount?: number;
      stores?: unknown[];
      branches?: unknown[];
    };

    if (typeof assignedProject.branchesCount === 'number') {
      return assignedProject.branchesCount;
    }
    if (typeof rawProject.filialen === 'number') {
      return rawProject.filialen;
    }
    if (typeof rawProject.storesCount === 'number') {
      return rawProject.storesCount;
    }
    if (Array.isArray(rawProject.branches)) {
      return rawProject.branches.length;
    }
    if (Array.isArray(rawProject.stores)) {
      return rawProject.stores.length;
    }

    return 0;
  }

  /**
   * Get week number for a date
   */
  private getWeekNumber(date: Date): number {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  }

  private setupRouteListener(): void {
    // Listen for route changes
    this.route.params.pipe(untilDestroyed(this)).subscribe((params) => {
      // Restore status filter from query params
      const queryStatusFilter = this.route.snapshot.queryParamMap.get('status');
      if (queryStatusFilter && queryStatusFilter !== 'null') {
        this.statusFilter = this.normalizeStatusFilter(queryStatusFilter);
      } else {
        this.statusFilter = '';
      }

      const projectId = params['projectId'];

      // Reapply filters when route changes (to show/hide specific project)
      this.applyFilters();

      if (projectId && this.projects.length > 0) {
        // Find and expand the specific project
        this.checkAndExpandProjectFromRoute();
      } else if (!projectId) {
        // No projectId in route
        if (this.statusFilter) {
          // If there's a status filter, expand all filtered projects
          // Wait for filteredProjects to be populated
          /*
          setTimeout(() => {
            this.expandAllFilteredProjects();
          }, 100);
          */
        } else {
          // No status filter - collapse any expanded rows
          this.collapseAllProjects();
        }
      }
    });
  }

  private setupNavigationListener(): void {
    this.router.events.pipe(untilDestroyed(this)).subscribe((event) => {
      if (event instanceof NavigationStart) {
        this.nextUrl = event.url;
        // Reset scroll restoration flag for new navigation
        this.hasRestoredScrollThisCycle = false;
        // Only save state if navigating to report detail (to restore when coming back)
        if (this.shouldPersistState() && !this.projectsStateService.preventSave) {
          // Capture scroll positions before navigation
          this.captureReportsTableScrollPosition();
          this.captureProjectsTableScrollPosition();
          // Save state immediately before navigation destroys the view
          this.saveState();
        }
        // Always reset the flag
        this.projectsStateService.preventSave = false;
      }

      if (event instanceof NavigationEnd) {
        const currentUrl = event.urlAfterRedirects;
        const previousUrl = this.previousNavigationUrl;

        // Check if we're navigating to the projects page (with or without projectId)
        if (currentUrl === '/projects' || currentUrl.startsWith('/projects/')) {
          // Check if we came from report-detail or another page
          const cameFromReportDetail = previousUrl && previousUrl.includes('/projects/') && previousUrl.includes('/reports/');
          const cameFromProjects = previousUrl && (previousUrl === '/projects' || previousUrl.startsWith('/projects/'));

          // If we came from a different page (not report-detail and not projects), clear filters
          if (!cameFromReportDetail && !cameFromProjects && previousUrl) {
            this.clearFiltersOnNavigation();
          } else {
            // Restore status filter from query params first (takes precedence)
            const queryStatusFilter = this.route.snapshot.queryParamMap.get('status');
            if (queryStatusFilter && queryStatusFilter !== 'null') {
              this.statusFilter = this.normalizeStatusFilter(queryStatusFilter);
            }

            // Restore filter state only if coming back from report detail (otherwise we might overwrite current state with stale data)
            if (cameFromReportDetail) {
              this.restoreState();
            }

            // Restore projects table scroll position if we have a saved position
            // (This would have been saved when navigating to report detail)
            if (this.projectsTableScrollPosition > 0) {
              setTimeout(() => {
                this.restoreProjectsTableScrollPosition('auto');
              }, 300);
            }

            // If statusFilter exists but not in query params, add it to query params to persist it
            if (this.statusFilter && !queryStatusFilter) {
              this.router.navigate([], {
                relativeTo: this.route,
                queryParams: { status: this.statusFilter },
                queryParamsHandling: 'merge',
                replaceUrl: true,
              });
            }
          }

          // Always ensure loading state is reset when navigating to projects page
          if (this.isLoadingProjects && !this.isLoadingProjectsLock) {
            this.isLoadingProjects = false;
          }

          if (this.projects.length === 0) {
            // Avoid triggering a second load while an initial load (often kicked off by status query params) is in-flight
            if (this.isLoadingProjects || this.isLoadingProjectsLock) {
              return;
            }
            const cachedState = this.projectsStateService.getStateSnapshot();
            if (cachedState && this.projectsStateService.isCacheValid()) {
              this.projects = cachedState.projects || [];

              // Restore per-project filters map and ensure reports are preserved
              if (cachedState.projectReportFilters) {
                this.projects.forEach((p) => {
                  if (p.id && cachedState.projectReportFilters && cachedState.projectReportFilters[p.id]) {
                    p._reportFilters = cachedState.projectReportFilters[p.id];
                  }
                  // Ensure reports from cache are preserved
                  const cachedProject = cachedState.projects?.find((cp) => cp.id === p.id);
                  if (cachedProject && cachedProject.reports && cachedProject.reports.length > 0) {
                    p.reports = cachedProject.reports;
                    // Recalculate branchesCount
                    const uniqueBranches = new Set<string>();
                    p.reports.forEach((report: any) => {
                      if (report.branch?.id) {
                        uniqueBranches.add(report.branch.id.toString());
                      }
                    });
                    p.branchesCount = uniqueBranches.size;
                  }
                });
              }

              this.isLoadingProjects = false;
              this.isLoadingProjectsLock = false;
              this.applyFilters();

              // Check if status filter is in query params - if so, expand all filtered projects
              const queryStatusFilter = this.route.snapshot.queryParamMap.get('status');
              if (queryStatusFilter) {
                this.statusFilter = this.normalizeStatusFilter(queryStatusFilter);
                const projectId = this.route.snapshot.params['projectId'];
                // If there's a status filter and no specific project selected, expand all filtered projects
                /*
                  if (!projectId) {
                    this.expandAllFilteredProjects();
                  }
                  */
              }

              this.checkAndExpandProjectFromRoute();

              // Restore projects table scroll position if we have a saved position
              if (this.projectsTableScrollPosition > 0) {
                setTimeout(() => {
                  this.restoreProjectsTableScrollPosition('auto');
                }, 400);
              }

              // Load fresh data in background
              setTimeout(() => {
                this.loadProjects({ showLoader: false });
              }, 100);
            } else {
              this.loadProjects({ showLoader: true });
            }
          } else {
            this.isLoadingProjects = false;
            this.isLoadingProjectsLock = false;

            // Reapply filters when navigating (to show/hide specific project based on route)
            this.applyFilters();

            // Check if status filter is in query params - if so, expand all filtered projects
            const queryStatusFilter = this.route.snapshot.queryParamMap.get('status');
            if (queryStatusFilter) {
              this.statusFilter = this.normalizeStatusFilter(queryStatusFilter);
              const projectId = this.route.snapshot.params['projectId'];
              // If there's a status filter and no specific project selected, expand all filtered projects
              /*
                if (!projectId) {
                  setTimeout(() => {
                    this.expandAllFilteredProjects();
                  }, 100);
                }
                */
            }

            // this.checkAndExpandProjectFromRoute(); // Removed to prevent re-expansion due to stale snapshot

            // Restore projects table scroll position if we have a saved position
            if (this.projectsTableScrollPosition > 0) {
              setTimeout(() => {
                this.restoreProjectsTableScrollPosition('auto');
              }, 300);
            }
          }
        } else {
          // Not navigating to projects page - ensure we don't leave loading state stuck
          if (this.isLoadingProjects && !this.isLoadingProjectsLock) {
            this.isLoadingProjects = false;
          }
        }

        // Store current URL as previous for next navigation
        this.previousNavigationUrl = currentUrl;
      }
    });
  }

  private checkAndExpandProjectFromRoute(): void {
    // Support both /projects/:projectId and /projects? id=... (dashboard uses query param)
    // Parse the current router URL to avoid stale ActivatedRoute snapshot issues when called asynchronously
    let projectId: string | null = null;
    try {
      // Check if there's a pending navigation to avoid race conditions with stale URLs
      // E.g., when the user clicks to collapse a project while the background data is still loading
      const currentNav = this.router.getCurrentNavigation();
      let activeUrlStr = this.router.url;

      if (currentNav && currentNav.extractedUrl) {
        activeUrlStr = this.router.serializeUrl(currentNav.extractedUrl);
      }

      const urlTree = this.router.parseUrl(activeUrlStr);
      projectId = urlTree.queryParams['id'] || null;

      if (!projectId) {
        const segments = urlTree.root.children['primary']?.segments;
        if (segments && segments.length > 1 && segments[0].path === 'projects') {
          projectId = segments[1].path;
        }
      }
    } catch (e) {
      // Fallback if URL parsing fails
      projectId = this.route.snapshot.queryParamMap.get('id') || this.route.snapshot.params['projectId'];
    }

    if (projectId && this.projects.length > 0) {
      const projectIdStr = projectId.toString();
      const project = this.projects.find((p) => p.id?.toString() === projectIdStr || p.slug === projectIdStr);

      if (project) {
        // Ensure project is visible by switching to 'all' if it doesn't match current filter
        let matchesActiveFilter = true;
        if (this.activeFilter === 'running') {
          matchesActiveFilter = project.status === 'running' || project.status === 'active';
        } else if (this.activeFilter === 'completed') {
          matchesActiveFilter = project.status === 'completed' || project.status === 'closed';
        }

        if (!matchesActiveFilter) {
          this.activeFilter = 'all';
          this.applyFilters();
        }

        // Always collapse all others and expand only the selected project
        this.expandedRows = {};
        const projectIdKey = project.id!.toString();
        this.expandedRows[projectIdKey] = true;
        this.selectedProject = project;
        // Sync UI filters with this project's stored filters
        this.syncUiFiltersFromProject(project);
        // Load reports if not loaded
        if (!project.reports || project.reports.length === 0) {
          this.loadProjectReports(project, { forceRefresh: false });
        }
      }
    } else if (!projectId) {
      this.collapseAllProjects();
    }
  }

  // Navigation methods
  selectProject(project: Project, preserveOtherExpanded: boolean = false): void {
    this.selectedProject = project;

    if (project && project.id) {
      this.updateReportColumnsForProject(project);
      // When explicitly selecting, we might want to close others? HeadOffice does expand multiple if needed, but typically one focus.
      // The UX requirement "open the project" implies expanding.

      // Use route param as source of truth for single expansion if desired, or allow multiple.
      // Assuming we want to match route behavior:
      const projectIdKey = project.id.toString();

      // Ensure we have filters initialized
      if (!project._reportFilters) {
        project._reportFilters = this.cloneProjectFilters(this.defaultReportFilters);
      }

      // Sync UI filters from the selected project
      this.syncUiFiltersFromProject(project);

      // Only clear all expanded rows if preserveOtherExpanded is false AND status filter is not active
      // If status filter is active and we've already expanded all, preserve the expanded state
      if (!preserveOtherExpanded && (!this.statusFilter || !this.hasExpandedAllOnLoad)) {
        this.expandedRows = {}; // Clear previous for single expansion focus based on route
      }
      this.expandedRows[projectIdKey] = true;

      // Load reports for this project (will skip if already loaded)
      this.loadProjectReports(project, { forceRefresh: true });

      // Update route
      const currentProjectId = this.route.snapshot.params['projectId'];
      const projectIdStr = project.id.toString();

      if (currentProjectId?.toString() !== projectIdStr) {
        if (this.statusFilter) {
          this.router.navigate(['/projects', project.id], { queryParams: { status: this.statusFilter } });
        } else {
          this.router.navigate(['/projects', project.id]);
        }
      }

      this.saveState();
    }
  }

  private loadProjectReports(project: Project, options: { forceRefresh?: boolean } = {}): void {
    if (!project?.id) {
      return;
    }

    const projectIdKey = project.id.toString();
    const forceRefresh = !!options.forceRefresh;

    // Set loading state to true immediately if we might need to load data
    // This ensures the loader shows as soon as the row expands
    // We'll set it to false later if we find cached data
    this.loadingReports[projectIdKey] = true;
    this.expandedRows[projectIdKey] = true;

    // Check if we have data in memory
    const hasInMemoryData = project.reports && project.reports.length > 0;

    // Check if we have data in cache/store (check both current projects array and state)
    let hasCachedData = false;
    if (!hasInMemoryData) {
      // First check current projects array (might have been restored from cache)
      const currentProject = this.projects.find((p) => p.id === project.id);
      if (currentProject && currentProject.reports && currentProject.reports.length > 0) {
        project.reports = currentProject.reports;
        project.branchesCount = currentProject.branchesCount;
        hasCachedData = true;
      } else {
        // Check state cache
        const cachedState = this.projectsStateService.getStateSnapshot();
        if (cachedState && cachedState.projects) {
          const cachedProject = cachedState.projects.find((p) => p.id === project.id);
          if (cachedProject && cachedProject.reports && cachedProject.reports.length > 0) {
            project.reports = cachedProject.reports;
            // Calculate branchesCount from cached reports
            const uniqueBranches = new Set<string>();
            project.reports.forEach((report: any) => {
              if (report.branch?.id) {
                uniqueBranches.add(report.branch.id.toString());
              }
            });
            project.branchesCount = uniqueBranches.size;
            // Also update the project in the current projects array
            if (currentProject) {
              currentProject.reports = project.reports;
              currentProject.branchesCount = project.branchesCount;
            }
            hasCachedData = true;
          }
        }
      }
    }

    const hasData = hasInMemoryData || hasCachedData;

    if (!forceRefresh && hasData) {
      // Data already loaded and no refresh requested
      this.updateReportColumnsForProject(project);
      this.updateProjectDerivedData(project);
      this.loadingReports[projectIdKey] = false;
      // Restore scroll position when reports are already available
      // Use setTimeout to ensure table is rendered
      setTimeout(() => {
        this.onProjectExpanded();
      }, 150);
      // Save state to ensure reports are persisted
      this.saveState();
      return;
    }

    // If we have data, don't show loading spinner even if refreshing
    // UNLESS we are forcing refresh (user explicitly wants fresh data)
    if (hasData && !forceRefresh) {
      this.loadingReports[projectIdKey] = false;
    } else {
      // Loading state already set to true above, keep it that way
      // This ensures we show the loader when forcing refresh, even if we have cached data
    }

    // Capture scroll position before loading new data
    const hadScrollPosition = this.reportsTableScrollPosition > 0;
    if (hadScrollPosition) {
      this.captureReportsTableScrollPosition();
    }

    this.reportService.getReportsByProject(project.id!).subscribe({
      next: (reports) => {
        project.reports = reports || [];
        this.updateReportColumnsForProject(project);
        this.updateProjectDerivedData(project);
        // Calculate branchesCount
        const uniqueBranches = new Set<string>();
        project.reports.forEach((report: any) => {
          if (report.branch?.id) {
            uniqueBranches.add(report.branch.id.toString());
          }
        });
        project.branchesCount = uniqueBranches.size;

        this.loadingReports[projectIdKey] = false;
        this.expandedRows[projectIdKey] = true;

        // Re-apply filters to update filteredProjects (in case this project now has matching reports)
        this.applyFilters();

        // Restore scroll position after filters are applied and table is rendered
        // Use multiple attempts with increasing delays to ensure scroll sticks after table re-render
        if (hadScrollPosition && this.reportsTableScrollPosition > 0) {
          const savedReportsScroll = this.reportsTableScrollPosition;
          const restoreReportsScroll = () => {
            // Reset the flag to allow restoration after data load
            this.hasRestoredScrollThisCycle = false;
            this.onProjectExpanded();
          };

          // First restore attempt
          setTimeout(restoreReportsScroll, 100);
          // Second restore attempt (table might still be rendering)
          setTimeout(() => {
            if (this.reportsTableScrollPosition === savedReportsScroll) {
              this.hasRestoredScrollThisCycle = false;
              this.onProjectExpanded();
            }
          }, 300);
          // Final restore attempt (ensures scroll sticks after all rendering is complete)
          setTimeout(() => {
            if (this.reportsTableScrollPosition === savedReportsScroll) {
              this.hasRestoredScrollThisCycle = false;
              this.onProjectExpanded();
            }
          }, 600);
        } else {
          // Just attach listener if no scroll position to restore
          setTimeout(() => {
            this.attachReportsTableListenerOnly();
          }, 250);
        }

        // Save state to persist loaded reports
        this.saveState();
      },
      error: (err) => {
        console.error('❌ [loadProjectReports] Error fetching reports for project:', err);
        // Only clear reports if we didn't have any before
        if (!hasData) {
          project.reports = [];
        }
        this.loadingReports[projectIdKey] = false;

        if (err.status === 403) {
          this.toast.error('Sie haben keine Berechtigung, auf dieses Projekt zuzugreifen.');
          this.router.navigate(['/projects']);
        } else {
          this.toast.error('Fehler beim Laden der Berichte.');
        }
      },
    });
  }

  // Table event handlers
  onRowExpand(event: TableRowExpandEvent): void {
    // When manually expanding via chevron (if enabled), treat as selection
    // But preserve other expanded projects if status filter is active
    if (event.data) {
      const preserveOthers = this.statusFilter && this.hasExpandedAllOnLoad;
      this.selectProject(event.data, preserveOthers);
      // Restore scroll position when project is expanded
      this.onProjectExpanded();
    }
  }

  onRowCollapse(event: TableRowCollapseEvent): void {
    // Capture reports table scroll position BEFORE collapsing
    this.captureReportsTableScrollPosition();

    if (event.data && event.data.id) {
      this.loadingReports[event.data.id] = false;

      // Manually update expandedRows to ensure state is consistent before saving
      // This is necessary because p-table's expandedRowKeys is bound one-way [expandedRowKeys]
      // and we need to update our internal state when the user collapses a row via the chevron
      const projectId = event.data.id.toString();
      // Ensure we're not mutating the original object to trigger change detection properly
      const newExpandedRows = { ...this.expandedRows };
      if (newExpandedRows[projectId]) {
        delete newExpandedRows[projectId];
        this.expandedRows = newExpandedRows;
      }
    }

    if (this.selectedProject && this.selectedProject.id?.toString() === event.data.id?.toString()) {
      this.selectedProject = null;
      // Clear query params
      this.router.navigate(['/projects'], { queryParams: this.statusFilter ? { status: this.statusFilter } : {} });
    }

    // Clean up scroll listener
    if (this.reportsTableScrollListener) {
      this.reportsTableScrollListener();
      this.reportsTableScrollListener = undefined;
    }

    this.saveState();
  }

  collapseProject(): void {
    this.expandedRows = {};
    this.selectedProject = null;
    // Reset the flag when manually collapsing all
    this.hasExpandedAllOnLoad = false;
    this.router.navigate(['/projects'], { queryParams: this.statusFilter ? { status: this.statusFilter } : {} });
    this.saveState();
  }

  getProjectUrl(project: Project): string {
    if (!project?.id) {
      return '';
    }
    return this.router.serializeUrl(this.router.createUrlTree(['/projects', project.id]));
  }

  toggleReportsSidebar(project: Project, event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    this.initialAutoExpandDone = true;
    if (!project?.id) {
      return;
    }
    if (!this.isMobileReportsSidebarView()) {
      this.toggleProject(project, event);
      return;
    }
    const id = project.id.toString();
    if (this.sidebarVisibleProjectId === id) {
      this.closeReportsSidebar();
      return;
    }
    this.sidebarVisibleProjectId = id;
    const preserveOthers = !!(this.statusFilter && this.hasExpandedAllOnLoad);
    this.selectProject(project, preserveOthers);
  }

  private closeReportsSidebarOnDesktop(): void {
    if (!this.isMobileReportsSidebarView() && this.sidebarVisibleProjectId) {
      this.closeReportsSidebar(true);
    }
  }

  closeReportsSidebar(force?: boolean): void {
    if (this.showReportsMobileFilterSheet && !force) {
      return;
    }
    if (this.showColumnFilterModal && !force) {
      return;
    }
    this.showReportsMobileFilterSheet = false;
    this.sidebarVisibleProjectId = null;
  }

  getReportsSidebarFilterBadgeCount(): number {
    const p = this.selectedProject || this.filteredProjects?.find((x) => x.id?.toString() === this.sidebarVisibleProjectId);
    if (!p?.id) {
      return 0;
    }
    let status: string[];
    let merch: string[];
    let fil: string[];
    let plan: string[];
    let gen: { [field: string]: string[] };
    if (this.selectedProject?.id === p.id) {
      status = this.reportStatusFilter || [];
      merch = this.reportMerchandiserFilter || [];
      fil = this.reportFilialenFilter || [];
      plan = this.reportPlannedOnFilter || [];
      gen = this.genericFilterValues || {};
    } else {
      const fl = this.getProjectReportFilters(p);
      status = fl.status || [];
      merch = fl.merchandiser || [];
      fil = fl.filialen || [];
      plan = fl.plannedOn || [];
      gen = fl.generic || {};
    }
    let n = status.length + merch.length + fil.length + plan.length;
    Object.values(gen).forEach((arr) => {
      n += Array.isArray(arr) ? arr.length : 0;
    });
    return n;
  }

  getTotalReportsActiveFilters(): number {
    if (!this.reportMobileFilterValues) {
      return 0;
    }
    let count = 0;
    Object.values(this.reportMobileFilterValues).forEach((arr: string[] | undefined) => {
      count += arr?.length || 0;
    });
    return count;
  }

  openReportsMobileFilterSheet(): void {
    const projectToUse = this.selectedProject || this.filteredProjects?.find((p) => p.id?.toString() === this.sidebarVisibleProjectId);
    if (!projectToUse) {
      return;
    }
    this.selectedProject = projectToUse;
    this.syncUiFiltersFromProject(projectToUse);

    this.reportMobileColumns = [
      { field: 'status', header: 'Status' },
      ...this.excludeConfidentialReportColumns(this.selectedReportColumns || []).map((col) => ({
        field: col.field,
        header: col.header,
      })),
    ];

    this.reportMobileFilterValues = {};
    this.reportMobileFilterValues['status'] = [...(this.reportStatusFilter || [])];
    this.reportMobileFilterValues['plannedOn'] = [...(this.reportPlannedOnFilter || [])];
    this.reportMobileFilterValues['branch.name'] = [...(this.reportFilialenFilter || [])];
    Object.keys(this.genericFilterValues || {}).forEach((k) => {
      if (!this.isConfidentialReportField(k)) {
        this.reportMobileFilterValues[k] = [...(this.genericFilterValues[k] || [])];
      }
    });

    this.reportMobileColumnOptions = {};
    this.reportMobileCanFilterMap = {};

    this.reportMobileColumnOptions['status'] = this.getUniqueReportStatuses(projectToUse).map((o) => ({
      label: o.label,
      value: o.value,
      color: o.color,
    }));
    this.reportMobileCanFilterMap['status'] = (this.reportMobileColumnOptions['status']?.length || 0) > 0 || (this.reportStatusFilter?.length || 0) > 0;

    this.reportMobileColumnOptions['plannedOn'] = this.getUniquePlannedOnDates();
    this.reportMobileCanFilterMap['plannedOn'] = (this.reportMobileColumnOptions['plannedOn']?.length || 0) > 0 || (this.reportPlannedOnFilter?.length || 0) > 0;

    this.reportMobileColumnOptions['branch.name'] = this.getUniqueFilialen();
    this.reportMobileCanFilterMap['branch.name'] = (this.reportMobileColumnOptions['branch.name']?.length || 0) > 0 || (this.reportFilialenFilter?.length || 0) > 0;

    this.excludeConfidentialReportColumns(this.selectedReportColumns || []).forEach((col) => {
      const f = col.field;
      if (f !== 'plannedOn' && f !== 'branch.name') {
        this.reportMobileColumnOptions[f] = this.getUniqueValuesForField(f);
        this.reportMobileCanFilterMap[f] = (this.reportMobileColumnOptions[f]?.length || 0) > 0 || (this.genericFilterValues[f]?.length || 0) > 0;
      }
    });

    this.reportMobileFilterValues = { ...this.reportMobileFilterValues };
    this.showReportsMobileFilterSheet = true;
  }

  onReportsMobileFilterChanged(event: { field: string; values: string[] }): void {
    const projectToUse = this.selectedProject || this.filteredProjects?.find((p) => p.id?.toString() === this.sidebarVisibleProjectId);
    if (!projectToUse) {
      return;
    }

    const f = event.field;
    const v = event.values || [];

    if (f === 'status') {
      this.reportStatusFilter = [...v];
    } else if (f === 'plannedOn') {
      this.reportPlannedOnFilter = [...v];
    } else if (f === 'merchandiser') {
      this.reportMerchandiserFilter = [...v];
    } else if (f === 'branch.name') {
      this.reportFilialenFilter = [...v];
    } else {
      if (!this.genericFilterValues[f]) {
        this.genericFilterValues[f] = [];
      }
      this.genericFilterValues[f] = [...v];
      this.genericFilterValues = { ...this.genericFilterValues };
    }

    this.persistUiFiltersToProject(projectToUse);
    this.reportMobileFilterValues[f] = [...v];
    this.reportMobileFilterValues = { ...this.reportMobileFilterValues };
    this.applyFilters();
    this.saveState();
  }

  onReportsMobileFilterCleared(): void {
    const projectToUse = this.selectedProject || this.filteredProjects?.find((p) => p.id?.toString() === this.sidebarVisibleProjectId);
    if (!projectToUse) {
      return;
    }
    projectToUse._reportFilters = this.cloneProjectFilters(this.defaultReportFilters);
    this.syncUiFiltersFromProject(projectToUse);
    this.reportMobileFilterValues = {};
    this.applyFilters();
    this.saveState();
  }

  toggleProject(project: Project, event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    // User interaction should mark auto-expand as handled to prevent interference from applyFilters logic
    this.initialAutoExpandDone = true;

    if (project && project.id) {
      const projectId = project.id.toString();
      const isExpanded = this.expandedRows[projectId] === true;

      if (isExpanded) {
        // Collapse - allow user to collapse even if status filter is active
        // Create a new reference to trigger change detection
        const newExpandedRows = { ...this.expandedRows };
        delete newExpandedRows[projectId];
        this.expandedRows = newExpandedRows;

        if (this.sidebarVisibleProjectId === projectId) {
          this.sidebarVisibleProjectId = null;
        }

        if (this.selectedProject && this.selectedProject.id?.toString() === projectId) {
          this.selectedProject = null;
          this.router.navigate(['/projects'], { queryParams: this.statusFilter ? { status: this.statusFilter } : {} });
        }
      } else {
        // Expand - preserve other expanded projects when status filter is active and already expanded all
        const preserveOthers = this.statusFilter && this.hasExpandedAllOnLoad;
        this.selectProject(project, preserveOthers);
      }
      this.saveState();
    }
  }

  collapseAllProjects(): void {
    this.expandedRows = {};
    this.sidebarVisibleProjectId = null;
    this.selectedProject = null;
    // Reset the flag when manually collapsing all
    this.hasExpandedAllOnLoad = false;
    // Ensure we don't accidentally re-expand automatically after manual collapse
    this.initialAutoExpandDone = true;
    this.saveState();
  }

  isProjectSelectionLocked(): boolean {
    // Lock selection when status filter is active and we've already expanded all projects
    return !!(this.statusFilter && this.hasExpandedAllOnLoad);
  }

  isProjectExpanded(project: Project): boolean {
    if (!project || !project.id) return false;
    const projectId = project.id.toString();
    return this.expandedRows[projectId] === true;
  }

  private setupClickOutsideListener(popover: any): void {
    // Remove existing listener if any
    if (this.clickOutsideListener) {
      this.clickOutsideListener();
      this.clickOutsideListener = undefined;
    }

    // Wait for the popover to be rendered
    setTimeout(() => {
      this.clickOutsideListener = this.renderer.listen(this.document, 'click', (event: MouseEvent) => {
        const target = event.target as HTMLElement;

        // Find all visible popovers
        const popoverElements = this.document.querySelectorAll('.p-popover:not(.p-popover-hidden)');
        let clickedOutside = true;

        // Check if click is inside any visible popover
        popoverElements.forEach((popoverEl) => {
          if (popoverEl.contains(target)) {
            clickedOutside = false;
          }
        });

        // Check if click is on a filter icon or button that opens a popover
        const isFilterTrigger =
          target.closest('.items-center.cursor-pointer.text-xs') ||
          target.closest('svg')?.parentElement?.classList.contains('cursor-pointer') ||
          target.closest('button[class*="cursor-pointer"]') ||
          target.closest('.p-multiselect') ||
          target.closest('.p-popover');

        // If clicked outside and not on a filter trigger, close the popover
        if (clickedOutside && !isFilterTrigger && popover && popover.hide) {
          popover.hide();
          if (this.clickOutsideListener) {
            this.clickOutsideListener();
            this.clickOutsideListener = undefined;
          }
        }
      });
    }, 100);
  }

  private expandAllFilteredProjects(): void {
    // When status filter is present, expand ALL filtered projects (those with matching reports)
    // Projects with 0 matching reports are already filtered out by applyFilters()
    if (!this.filteredProjects || this.filteredProjects.length === 0) {
      return;
    }

    // Only expand all on initial load, not when user manually interacts
    if (this.hasExpandedAllOnLoad) {
      return;
    }

    // Expand all filtered projects (these already have matching reports)
    this.filteredProjects.forEach((project) => {
      if (project && project.id) {
        const projectIdKey = project.id.toString();
        this.expandedRows[projectIdKey] = true;

        // Load reports for expanded projects if not already loaded
        if (!project.reports || project.reports.length === 0) {
          this.loadProjectReports(project, { forceRefresh: false });
        } else {
        }
      }
    });

    // Mark that we've expanded all on load
    this.hasExpandedAllOnLoad = true;

    this.saveState();
  }

  // Filter methods
  onProjectSearch(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.projectSearchTerm = target.value.toLowerCase();
    this.applyFilters();
  }

  onFilialeSearch(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.filialeSearchTerm = target.value.toLowerCase();
    this.applyFilters();
  }

  clearProjectSearch(): void {
    this.projectSearchTerm = '';
    this.applyFilters();
  }

  clearFilialeSearch(): void {
    this.filialeSearchTerm = '';
    this.applyFilters();
  }

  private applyFilters(): void {
    this.invalidateFilterCaches();

    // Capture scroll positions before filtering (if table is visible and we're not already restoring)
    // This preserves scroll when filteredProjects changes and causes table re-render
    const wasRestoring = this.isRestoringScroll;
    const hadExpandedRows = Object.keys(this.expandedRows).length > 0;
    const scrollPositionToRestore = hadExpandedRows && !wasRestoring ? this.reportsTableScrollPosition : 0;

    // Capture scroll positions before filtering causes table re-render
    if (!wasRestoring) {
      // Always capture projects table scroll
      this.captureProjectsTableScrollPosition();
      // Capture reports table scroll if a project is expanded
      if (hadExpandedRows) {
        this.captureReportsTableScrollPosition();
      }
    }

    // Filter projects based on active filters
    let filtered: Project[] = this.projects.filter((project) => {
      // ...existing code...
      let matchesActiveFilter = true;
      if (this.activeFilter === 'running') {
        matchesActiveFilter = project.status === 'running' || project.status === 'active';
      } else if (this.activeFilter === 'completed') {
        matchesActiveFilter = project.status === 'completed' || project.status === 'closed';
      }

      const matchesProject = !this.projectSearchTerm || (project.name && project.name.toLowerCase().includes(this.projectSearchTerm));
      const matchesFiliale =
        !this.filialeSearchTerm ||
        (project.reports &&
          project.reports.some((report) => {
            const term = this.filialeSearchTerm.toLowerCase();
            const branchName = report.branch?.name?.toLowerCase() || '';
            const cityName = (report.branch as any)?.city?.name?.toLowerCase() || '';
            return branchName.includes(term) || cityName.includes(term);
          }));

      let matchesDateRange = true;
      if (this.dateRange2.start && this.dateRange2.end) {
        if (project.startDate && project.endDate) {
          const projectStartDate = new Date(project.startDate);
          const projectEndDate = new Date(project.endDate);
          const filterStartDate = new Date(this.dateRange2.start);
          const filterEndDate = new Date(this.dateRange2.end);
          projectStartDate.setHours(0, 0, 0, 0);
          projectEndDate.setHours(23, 59, 59, 999);
          filterStartDate.setHours(0, 0, 0, 0);
          filterEndDate.setHours(23, 59, 59, 999);
          matchesDateRange = projectStartDate <= filterEndDate && projectEndDate >= filterStartDate;
        } else {
          matchesDateRange = false;
        }
      }

      let matchesColumnFilters = true;
      this.cols.forEach((col) => {
        const filterValues = this.projectColumnFilterValues[col.field];
        if (filterValues && Array.isArray(filterValues) && filterValues.length > 0) {
          let projectValue: string = '';
          if (col.field === 'formattedZeitraum') {
            projectValue = project.zeitraum || '';
          } else if (col.field === 'filialen') {
            this.updateProjectDerivedData(project);
            const count = project._displayedFilialen ?? project.branchesCount ?? 0;
            projectValue = `${count} Stores`;
          } else if (col.field === 'status') {
            const percentage = project.reportedPercentage ?? 0;
            projectValue = `${percentage}% reported`;
          } else {
            projectValue = project[col.field as keyof Project]?.toString() || '';
          }
          if (!this.matchesFilterSelection(projectValue, filterValues)) {
            matchesColumnFilters = false;
          }
        }
      });

      const projectNameFilter = this.projectColumnFilterValues['name'];
      if (matchesColumnFilters && projectNameFilter && Array.isArray(projectNameFilter) && projectNameFilter.length > 0) {
        const projectName = project.name || '';
        if (!this.matchesFilterSelection(projectName, projectNameFilter)) {
          matchesColumnFilters = false;
        }
      }

      let hasMatchingReports = true;
      if (this.statusFilter) {
        if (project.reports !== undefined && project.reports !== null) {
          const matchingReports = this.filteredReports(project);
          hasMatchingReports = matchingReports && matchingReports.length > 0;
        }
      }

      return matchesActiveFilter && matchesProject && matchesFiliale && matchesDateRange && matchesColumnFilters && hasMatchingReports;
    });

    // Update derived data for all filtered projects to recalculate filialen counts
    filtered.forEach((project) => {
      this.updateProjectDerivedData(project);
    });

    // Sort the new filtered list
    if (this.projectSortField) {
      const field = this.projectSortField;
      const order = this.projectSortOrder;

      filtered.sort((a, b) => {
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

    // Only ref update if the list is different to prevent table re-render and scroll jumps
    const isSameList = this.filteredProjects.length === filtered.length && this.filteredProjects.every((p, i) => p.id === filtered[i].id);

    if (!isSameList) {
      this.filteredProjects = filtered;
    }

    // Auto-expand first project if no visible project is expanded
    const hasVisibleExpanded = this.filteredProjects.some((p) => p.id && this.expandedRows[p.id.toString()]);

    // If we already have visible expanded projects, mark initial auto-expand as done
    if (hasVisibleExpanded) {
      this.initialAutoExpandDone = true;
    }

    const hasActiveSearchTerm = !!(this.projectSearchTerm?.trim() || this.filialeSearchTerm?.trim());

    // For active search, always auto-open the first visible project when no filtered project is expanded.
    // Without this, once initialAutoExpandDone is true, searching a branch can leave results collapsed.
    if (!hasVisibleExpanded && this.filteredProjects.length > 0 && hasActiveSearchTerm) {
      const firstMatchedProject = this.filteredProjects[0];
      if (firstMatchedProject?.id) {
        this.selectProject(firstMatchedProject);
      }
      this.initialAutoExpandDone = true;
    } else if (!hasVisibleExpanded && this.filteredProjects.length > 0 && !this.initialAutoExpandDone) {
      // Check if there is a route param first, if yes, don't override unless it's not in the filtered list
      const routeProjectId = this.route.snapshot.paramMap.get('projectId');
      const isRouteProjectVisible = routeProjectId && this.filteredProjects.some((p) => p.id && p.id.toString() === routeProjectId);

      if (!isRouteProjectVisible) {
        const p = this.filteredProjects[0];
        if (p?.id) {
          this.selectProject(p);
        }
      }
      this.initialAutoExpandDone = true;
    }

    // Restore projects table scroll position after filtering
    // Use multiple attempts with increasing delays to ensure scroll sticks after table re-render
    if (this.projectsTableScrollPosition > 0) {
      const savedProjectsScroll = this.projectsTableScrollPosition;
      // Restore immediately
      setTimeout(() => {
        this.restoreProjectsTableScrollPosition();
      }, 50);
      // Restore again after a longer delay (table might still be rendering)
      setTimeout(() => {
        if (this.projectsTableScrollPosition === savedProjectsScroll) {
          this.restoreProjectsTableScrollPosition();
        }
      }, 200);
      // Final restore attempt (ensures scroll sticks after all rendering is complete)
      setTimeout(() => {
        if (this.projectsTableScrollPosition === savedProjectsScroll) {
          this.restoreProjectsTableScrollPosition();
        }
      }, 500);
    }

    // Restore scroll position after filtering if we had a position to restore
    if (scrollPositionToRestore > 0 && !wasRestoring && hadExpandedRows) {
      let savedReportsScroll = scrollPositionToRestore;
      // Update the position in case it was captured during filtering
      if (this.reportsTableScrollPosition > 0) {
        savedReportsScroll = this.reportsTableScrollPosition;
      } else {
        this.reportsTableScrollPosition = scrollPositionToRestore;
        savedReportsScroll = scrollPositionToRestore;
      }

      // Restore reports scroll multiple times with increasing delays
      const restoreReportsScroll = () => {
        // Reset the flag to allow restoration after filtering
        this.hasRestoredScrollThisCycle = false;
        this.onProjectExpanded();
      };

      // First restore attempt
      setTimeout(restoreReportsScroll, 100);
      // Second restore attempt (table might still be rendering)
      setTimeout(() => {
        if (this.reportsTableScrollPosition === savedReportsScroll) {
          this.hasRestoredScrollThisCycle = false;
          this.onProjectExpanded();
        }
      }, 300);
      // Final restore attempt (ensures scroll sticks after all rendering is complete)
      setTimeout(() => {
        if (this.reportsTableScrollPosition === savedReportsScroll) {
          this.hasRestoredScrollThisCycle = false;
          this.onProjectExpanded();
        }
      }, 600);
    }

    this.refreshProjectsMobileFilterSheetState();
    this.saveState();
  }

  clearFilters(): void {
    this.projectSearchTerm = '';
    this.filialeSearchTerm = '';
    this.activeFilter = 'all';
    this.dateRange = [];
    this.dateRange2 = { start: null, end: null };
    this.reportStatusFilter = [];
    this.reportMerchandiserFilter = [];
    this.reportFilialenFilter = [];
    this.reportPlannedOnFilter = [];
    this.projectColumnFilterValues = {};
    this.genericFilterValues = {};
    this.statusFilter = '';

    // Reset project-specific filters for selected project if any
    if (this.selectedProject) {
      this.selectedProject._reportFilters = this.cloneProjectFilters(this.defaultReportFilters);
      this.syncUiFiltersFromProject(this.selectedProject);
    }

    this.applyFilters();
    this.projectsStateService.clearCache(); // Clear stored state on full reset? Or just update?
    this.saveState(); // Update state with cleared values

    this.router.navigate(['/projects'], { queryParams: {} });
  }

  private clearFiltersOnNavigation(): void {
    this.projectSearchTerm = '';
    this.filialeSearchTerm = '';
    this.activeFilter = 'all';
    this.dateRange = [];
    this.dateRange2 = { start: null, end: null };
    this.reportStatusFilter = [];
    this.reportMerchandiserFilter = [];
    this.reportFilialenFilter = [];
    this.reportPlannedOnFilter = [];
    this.projectColumnFilterValues = {};
    this.genericFilterValues = {};

    // NOTE: Do NOT clear statusFilter here - it should persist until user clicks "Zurücksetzen"
    // this.statusFilter = ''; // REMOVED - keep status filter

    // Reset project-specific filters for all projects
    this.projects.forEach((p) => {
      if (p._reportFilters) {
        p._reportFilters = this.cloneProjectFilters(this.defaultReportFilters);
      }
    });

    // Clear selected project filters
    if (this.selectedProject) {
      this.selectedProject._reportFilters = this.cloneProjectFilters(this.defaultReportFilters);
      this.syncUiFiltersFromProject(this.selectedProject);
    }

    // Clear expanded rows
    this.expandedRows = {};
    this.selectedProject = null;
    this.reportsTableScrollPosition = 0;
    this.projectsTableScrollPosition = 0;

    // Clear sort fields
    this.projectSortField = '';
    this.projectSortOrder = 1;
    this.reportSortField = '';
    this.reportSortOrder = 1;
    this.initialAutoExpandDone = false;

    this.applyFilters();
    this.saveState();

    // Preserve statusFilter in query params when navigating
    const queryParams: any = {};
    if (this.statusFilter) {
      queryParams.status = this.statusFilter;
    }
    this.router.navigate(['/projects'], { queryParams });
  }

  // State Management Methods
  /**
   * Check if we should persist state (only when navigating to report detail)
   */
  private shouldPersistState(): boolean {
    if (!this.nextUrl) return false;
    // Persist state if navigating to reports within the same project context
    return this.nextUrl.includes('/projects/') && this.nextUrl.includes('/reports/') && !this.nextUrl.includes('/edit-report/');
  }

  private saveState(): void {
    // Persist current UI filters to selected project before saving
    if (this.selectedProject) {
      this.persistUiFiltersToProject(this.selectedProject);
    }

    const state: ProjectsState = {
      projects: this.projects,
      expandedRows: this.expandedRows,
      activeFilter: this.activeFilter,
      projectSearchTerm: this.projectSearchTerm,
      filialeSearchTerm: this.filialeSearchTerm,
      statusFilter: this.statusFilter, // Persist status filter
      reportStatusFilter: this.reportStatusFilter,
      reportMerchandiserFilter: this.reportMerchandiserFilter,
      reportFilialenFilter: this.reportFilialenFilter,
      reportPlannedOnFilter: this.reportPlannedOnFilter,
      projectColumnFilterValues: this.projectColumnFilterValues,
      genericFilterValues: this.genericFilterValues,
      dateRange: this.dateRange2,
      projectsVisibleColumns: this.projectsVisibleColumns,
      reportsVisibleColumns: this.reportsVisibleColumns,
      projectsOrderedColumns: this.projectsOrderedColumns,
      reportsOrderedColumns: this.reportsOrderedColumns,
      selectedColumns: this.selectedColumns,
      selectedReportColumns: this.selectedReportColumns,
      projectSortField: this.projectSortField,
      projectSortOrder: this.projectSortOrder,
      reportSortField: this.reportSortField,
      reportSortOrder: this.reportSortOrder,
      projectReportFilters: this.buildProjectFiltersMap(),
      reportsTableScrollPosition: this.reportsTableScrollPosition,
      projectsTableScrollPosition: this.projectsTableScrollPosition,
    };

    this.projectsStateService.setState(state);
  }

  private restoreState(): void {
    const state = this.projectsStateService.getStateSnapshot();
    if (!state) return;

    this.activeFilter = state.activeFilter || 'all';
    this.projectSearchTerm = state.projectSearchTerm || '';
    this.filialeSearchTerm = state.filialeSearchTerm || '';
    this.projectColumnFilterValues = state.projectColumnFilterValues || {};
    this.expandedRows = state.expandedRows || {};

    if (state.dateRange) {
      this.dateRange2 = state.dateRange;
    }

    if (state.projectSortField) {
      this.projectSortField = state.projectSortField;
      this.projectSortOrder = state.projectSortOrder || 1;
    }

    if (state.reportSortField) {
      this.reportSortField = state.reportSortField;
      this.reportSortOrder = state.reportSortOrder || 1;
    }

    // If we have a selected project in mind (via route), we sync filters for it later.
    // But we can restore global/current values here:
    this.reportStatusFilter = state.reportStatusFilter || [];
    this.reportMerchandiserFilter = [];
    this.reportFilialenFilter = state.reportFilialenFilter || [];
    this.reportPlannedOnFilter = state.reportPlannedOnFilter || [];
    this.genericFilterValues = state.genericFilterValues || {};

    // Restore statusFilter from state, but query params take precedence (already set in ngOnInit)
    // Only restore from state if not already set from query params
    if (!this.statusFilter && state.statusFilter) {
      this.statusFilter = this.normalizeStatusFilter(state.statusFilter);
    }

    // Restore column visibility settings
    if (state.projectsVisibleColumns) {
      this.projectsVisibleColumns = { ...state.projectsVisibleColumns };
    }
    if (state.reportsVisibleColumns) {
      this.reportsVisibleColumns = { ...state.reportsVisibleColumns };
      Object.keys(this.reportsVisibleColumns).forEach((field) => {
        if (this.isConfidentialReportField(field)) {
          delete this.reportsVisibleColumns[field];
        }
      });
    }

    // Restore column ordering (validate against current column definitions)
    if (state.projectsOrderedColumns && state.projectsOrderedColumns.length > 0) {
      // Filter to only include columns that still exist in current definitions
      const validOrderedColumns = state.projectsOrderedColumns.filter((col) => this.cols.some((def) => def.field === col.field));
      if (validOrderedColumns.length > 0) {
        this.projectsOrderedColumns = validOrderedColumns;
      }
    }
    if (state.reportsOrderedColumns && state.reportsOrderedColumns.length > 0) {
      const validOrderedColumns = this.excludeConfidentialReportColumns(state.reportsOrderedColumns.filter((col) => this.isAllowedStoredReportColumn(col)));
      if (validOrderedColumns.length > 0) {
        this.reportsOrderedColumns = validOrderedColumns;
      }
    }

    // Restore selected columns (validate against current column definitions)
    if (state.selectedColumns && state.selectedColumns.length > 0) {
      const validSelectedColumns = state.selectedColumns.filter((col) => this.cols.some((def) => def.field === col.field));
      if (validSelectedColumns.length > 0) {
        this.selectedColumns = validSelectedColumns;
        // Update visible columns based on selected columns if not already set
        if (!state.projectsVisibleColumns) {
          Object.keys(this.projectsVisibleColumns).forEach((key) => {
            this.projectsVisibleColumns[key] = false;
          });
          validSelectedColumns.forEach((col) => {
            this.projectsVisibleColumns[col.field] = true;
          });
        }
      }
    }
    if (state.selectedReportColumns && state.selectedReportColumns.length > 0) {
      const validSelectedReportColumns = this.excludeConfidentialReportColumns(state.selectedReportColumns.filter((col) => this.isAllowedStoredReportColumn(col)));
      if (validSelectedReportColumns.length > 0) {
        this.selectedReportColumns = validSelectedReportColumns;
        // Update visible columns based on selected columns if not already set
        if (!state.reportsVisibleColumns) {
          Object.keys(this.reportsVisibleColumns).forEach((key) => {
            this.reportsVisibleColumns[key] = false;
          });
          validSelectedReportColumns.forEach((col) => {
            this.reportsVisibleColumns[col.field] = true;
          });
        }
      }
    }

    // Restore reports table scroll position
    if (state.reportsTableScrollPosition !== undefined && state.reportsTableScrollPosition > 0) {
      this.reportsTableScrollPosition = state.reportsTableScrollPosition;
    }

    if (state.projectsTableScrollPosition !== undefined && state.projectsTableScrollPosition > 0) {
      this.projectsTableScrollPosition = state.projectsTableScrollPosition;
    }

    this.sanitizeReportColumnState();
  }

  // Filter Logic Helpers matching HeadOffice
  private cloneGenericFilters(source: { [field: string]: string[] } = {}): { [field: string]: string[] } {
    const clone: Record<string, string[]> = {};
    Object.keys(source || {}).forEach((key) => {
      clone[key] = [...(source[key] || [])];
    });
    return clone;
  }

  private cloneProjectFilters(filters: ProjectReportFilters): ProjectReportFilters {
    return {
      status: [...(filters?.status || [])],
      merchandiser: [...(filters?.merchandiser || [])],
      filialen: [...(filters?.filialen || [])],
      plannedOn: [...(filters?.plannedOn || [])],
      generic: this.cloneGenericFilters(filters?.generic),
    };
  }

  private getProjectReportFilters(project?: Project | null): ProjectReportFilters {
    const baseFilters = this.cloneProjectFilters(this.defaultReportFilters);
    if (!project) {
      return baseFilters;
    }

    if (!project._reportFilters) {
      project._reportFilters = this.cloneProjectFilters(baseFilters);
    }

    return project._reportFilters;
  }

  private syncUiFiltersFromProject(project?: Project | null): void {
    const filters = this.getProjectReportFilters(project);
    this.reportStatusFilter = [...filters.status];
    this.reportMerchandiserFilter = [];
    this.reportFilialenFilter = [...filters.filialen];
    this.reportPlannedOnFilter = [...filters.plannedOn];
    this.genericFilterValues = this.cloneGenericFilters(filters.generic);
    Object.keys(this.genericFilterValues).forEach((field) => {
      if (this.isConfidentialReportField(field)) {
        delete this.genericFilterValues[field];
      }
    });
  }

  private persistUiFiltersToProject(project?: Project | null): void {
    const targetProject = project || this.selectedProject;
    if (targetProject) {
      const filters = this.getProjectReportFilters(targetProject);
      filters.status = [...this.reportStatusFilter];
      filters.merchandiser = [];
      filters.filialen = [...this.reportFilialenFilter];
      filters.plannedOn = [...this.reportPlannedOnFilter];
      filters.generic = this.cloneGenericFilters(this.genericFilterValues);
      Object.keys(filters.generic).forEach((field) => {
        if (this.isConfidentialReportField(field)) {
          delete filters.generic[field];
        }
      });
    }
  }

  private buildProjectFiltersMap(): { [projectId: string]: ProjectReportFilters } {
    const map: { [projectId: string]: ProjectReportFilters } = {};
    (this.projects || []).forEach((proj) => {
      if (proj?.id) {
        map[proj.id.toString()] = this.cloneProjectFilters(this.getProjectReportFilters(proj));
      }
    });
    return map;
  }

  filteredReports(project: Project, excludeFilterType?: string): Report[] {
    if (!project.reports) {
      return [];
    }

    const cacheKey = `${project.id ?? project.name ?? 'unknown'}::${excludeFilterType ?? ''}::${this.getReportFilterSignature(project)}`;
    const cached = this.filteredReportsCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    let filtered = project.reports;

    // Always use per-project filters for each project
    // If the project is the currently selected one, use the component UI filter properties (which are synced).
    // If it's not selected, use its internal _reportFilters.

    let filters: ProjectReportFilters;

    if (this.selectedProject && this.selectedProject.id === project.id) {
      // Use current UI state which is being edited
      filters = {
        status: this.reportStatusFilter,
        merchandiser: this.reportMerchandiserFilter,
        filialen: this.reportFilialenFilter,
        plannedOn: this.reportPlannedOnFilter,
        generic: this.genericFilterValues,
      };
    } else {
      // Use stored per-project filters
      filters = this.getProjectReportFilters(project);
    }

    // Apply general status filter from query params (global)
    if (excludeFilterType !== 'status' && this.statusFilter) {
      filtered = filtered.filter((report) => this.reportMatchesStatus(report, this.statusFilter));
    }

    // Filter by Filiale Search Term (Global)
    if (excludeFilterType !== 'filialeSearch' && this.filialeSearchTerm) {
      const term = this.filialeSearchTerm.toLowerCase();
      filtered = filtered.filter((report) => {
        const branchName = report.branch?.name?.toLowerCase() || '';
        const cityName = (report.branch as any)?.city?.name?.toLowerCase() || '';
        return branchName.includes(term) || cityName.includes(term);
      });
    }

    // Filter by Status
    if (excludeFilterType !== 'status' && filters.status && filters.status.length > 0) {
      filtered = filtered.filter((report) => {
        return this.matchesFilterSelection(report.status?.name, filters.status);
      });
    }

    // Filter by Merchandiser
    if (excludeFilterType !== 'merchandiser' && filters.merchandiser && filters.merchandiser.length > 0) {
      filtered = filtered.filter((report) => {
        const merchandiserName = this.getReportMerchandiserName(report);
        return this.matchesFilterSelection(merchandiserName, filters.merchandiser);
      });
    }

    // Filter by Filialen
    if (excludeFilterType !== 'branch.name' && filters.filialen && filters.filialen.length > 0) {
      filtered = filtered.filter((report) => {
        return this.matchesFilterSelection(report.branch?.name, filters.filialen);
      });
    }

    // Filter by Date Range (Global)
    if (this.dateRange2.start && this.dateRange2.end) {
      filtered = filtered.filter((report) => {
        if (!report.plannedOn) return false;
        const reportDate = new Date(report.plannedOn);
        const startDate = new Date(this.dateRange2.start!);
        const endDate = new Date(this.dateRange2.end!);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        reportDate.setHours(12, 0, 0, 0);
        return reportDate >= startDate && reportDate <= endDate;
      });
    }

    // Filter by PlannedOn (Column)
    if (excludeFilterType !== 'plannedOn' && filters.plannedOn && filters.plannedOn.length > 0) {
      filtered = filtered.filter((report) => {
        const formattedDate = this.formatDateForFilter(report.plannedOn);
        return this.matchesFilterSelection(formattedDate, filters.plannedOn);
      });
    }

    // Generic Filters
    Object.keys(filters.generic || {}).forEach((field) => {
      if (excludeFilterType === field) return;
      const values = filters.generic[field];
      if (values && Array.isArray(values) && values.length > 0) {
        filtered = filtered.filter((report) => {
          const value = this.getReportFieldValue(report, field);
          return this.matchesFilterSelection(value, values);
        });
      }
    });

    this.filteredReportsCache.set(cacheKey, filtered);
    return filtered;
  }

  // Handlers for Column Filters that need to update UI state and persist
  onReportStatusFilterChange(): void {
    // Persist UI filters to the selected project (per-project filter)
    this.persistUiFiltersToProject(this.selectedProject);
    // Update derived data for the selected project
    if (this.selectedProject) {
      this.updateProjectDerivedData(this.selectedProject);
    }
    // Apply filters to update the display
    this.applyFilters();
    // Save state
    this.saveState();
  }

  onReportMerchandiserFilterChange(): void {
    // Persist UI filters to the selected project (per-project filter)
    this.persistUiFiltersToProject(this.selectedProject);
    // Apply filters to update the display
    this.applyFilters();
    // Save state
    this.saveState();
  }

  onReportFilialenFilterChange(): void {
    // Persist UI filters to the selected project (per-project filter)
    this.persistUiFiltersToProject(this.selectedProject);
    // Apply filters to update the display
    this.applyFilters();
    // Save state
    this.saveState();
  }

  onReportPlannedOnFilterChange(): void {
    // Persist UI filters to the selected project (per-project filter)
    this.persistUiFiltersToProject(this.selectedProject);
    // Apply filters to update the display
    this.applyFilters();
    // Save state
    this.saveState();
  }

  onGenericFilterChange(): void {
    // Persist UI filters to the selected project
    this.persistUiFiltersToProject(this.selectedProject);
    // Apply filters to update the display
    this.applyFilters();
    // Save state
    this.saveState();
  }

  onProjectColumnFilterChange(): void {
    // Normalize null to empty array (PrimeNG clear can set null)
    if (this.currentProjectFilterField && !this.projectColumnFilterValues[this.currentProjectFilterField]) {
      this.projectColumnFilterValues[this.currentProjectFilterField] = [];
    }
    this.applyFilters();
    this.saveState();
  }

  onProjectColumnFilterClear(field?: string): void {
    const key = field || this.currentProjectFilterField;
    if (key) {
      this.projectColumnFilterValues[key] = [];
    }
    this.applyFilters();
    this.saveState();
  }

  onGenericFilterClear(field?: string): void {
    const key = field || this.currentFilterField;
    if (key) {
      this.genericFilterValues[key] = [];
    }
    // Persist cleared state to the selected project (since generic filters are per-project)
    this.persistUiFiltersToProject(this.selectedProject);
    this.applyFilters();
    this.saveState();
  }

  // ... Existing sort and helper methods ...
  // (Keeping existing implementation for sort, helpers, etc. as they are largely compatible)

  onProjectSort(field: string, event?: Event): void {
    if (event) event.stopPropagation();
    if (this.projectSortField === field) {
      this.projectSortOrder = this.projectSortOrder * -1;
    } else {
      this.projectSortField = field;
      this.projectSortOrder = 1;
    }
    this.sortProjects(field, this.projectSortOrder);
    this.saveState();
  }

  onReportSort(field: string, project: Project, event?: Event): void {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    if (this.reportSortField === field) {
      this.reportSortOrder = this.reportSortOrder * -1;
    } else {
      this.reportSortField = field;
      this.reportSortOrder = 1;
    }
    if (project && project.reports) {
      this.sortReports(project.reports, field, this.reportSortOrder);
    }
    this.saveState();
  }

  private sortProjects(field: string, order: number): void {
    this.filteredProjects.sort((a, b) => {
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

  private sortReports(reports: Report[], field: string, order: number): void {
    reports.sort((a, b) => {
      const valueA = this.getReportField(a, field);
      const valueB = this.getReportField(b, field);
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
    if (field === 'filialen') {
      return this.computeDisplayedFilialenCount(project);
    }
    if (field === 'status') return this.getReportedPercentage(project);
    return project[field as keyof Project] || '';
  }

  private getReportField(report: Report, field: string): any {
    if (field === 'status') return report.status?.name || '';
    if (field === 'feedback') {
      return report.feedback === true || report.feedback === 'true' ? 'Ja' : 'Nein';
    }
    if (field.startsWith('question_')) {
      return (report as any)[field] || '';
    }
    if (field === 'branch.client.name') return report.branch?.client?.name || '';
    if (field === 'address') return this.getReportAddress(report);
    if (field === 'reportTo') return this.formatDateForFilter(report.reportTo);
    if (field === 'plannedOn') return this.formatDateForFilter(report.plannedOn);
    return report[field as keyof Report] || '';
  }

  getReportedPercentage(project: Project): number {
    return project.reportedPercentage ?? 0;
  }

  /**
   * Generate address string for a report using street, zipCode, branch city, and country
   * Format: STREET + HOUSE NUMBER, ZIP CODE, CITY, COUNTRY
   */
  getReportAddress(report: Report): string {
    const street = (report.street || report.branch?.street || '').trim();
    const zip = (report.zipCode || report.branch?.zipCode || '').trim();

    let city = '';
    if (report.branch?.city?.name) {
      city = report.branch.city.name.trim();
    }

    let country = '';
    if (report.branch?.city?.country) {
      const countryName = report.branch.city.country.name;
      country = (typeof countryName === 'string' ? countryName : countryName?.de || '').trim();
    }

    const parts = [street, zip, city, country].filter(Boolean);
    return parts.join(', ');
  }

  getReportMerchandiserName(report: Report): string {
    if (report.merchandiser && report.merchandiser.user) {
      const user = report.merchandiser.user;
      return [user.firstName, user.lastName].filter(Boolean).join(' ');
    }
    return '';
  }

  // Column management methods
  getProjectColumnMinWidth(field: string): string {
    if (field === 'name') {
      return '200px';
    }

    if (field === 'formattedZeitraum') {
      return '260px';
    }

    if (field === 'filialen' || field === 'status') {
      return '180px';
    }

    return '200px';
  }

  getProjectsVisibleColumns(): StoredColumn[] {
    return this.projectsOrderedColumns.filter((col) => this.projectsVisibleColumns[col.field]);
  }

  getProjectsTableStyle(): Record<string, string> {
    const visibleColumns = this.getProjectsVisibleColumns();
    const visibleCount = visibleColumns?.length ?? 0;
    const columnCount = 2 + visibleCount;
    const minWidthRem = Math.max(32, columnCount * 11);
    return {
      width: '100%',
      'min-width': `${minWidthRem}rem`,
      'table-layout': 'fixed',
    };
  }

  getProjectsExpandedColspan(): number {
    const visibleColumns = this.getProjectsVisibleColumns();
    return 2 + (visibleColumns?.length ?? 0);
  }

  getReportsVisibleColumns(project?: Project): StoredColumn[] {
    const baseColumns = this.reportsOrderedColumns.filter((col) => !col.field.startsWith('question_') && !this.isConfidentialReportField(col.field) && this.reportsVisibleColumns[col.field]);

    const questionColumns = project ? this.getOverviewQuestionColumns(project) : this.reportsOrderedColumns.filter((col) => col.field.startsWith('question_') && this.reportsVisibleColumns[col.field]);

    return [...baseColumns, ...questionColumns];
  }

  onProjectsColReorder(event: any): void {
    if (event && typeof event.dragIndex === 'number' && typeof event.dropIndex === 'number') {
      const movedColumn = this.projectsOrderedColumns[event.dragIndex];
      const newOrderedColumns = [...this.projectsOrderedColumns];
      newOrderedColumns.splice(event.dragIndex, 1);
      newOrderedColumns.splice(event.dropIndex, 0, movedColumn);
      this.projectsOrderedColumns = newOrderedColumns;
      this.saveState();
    }
  }

  onReportsColReorder(event: any): void {
    if (event && typeof event.dragIndex === 'number' && typeof event.dropIndex === 'number') {
      const movedColumn = this.reportsOrderedColumns[event.dragIndex];
      const newOrderedColumns = [...this.reportsOrderedColumns];
      newOrderedColumns.splice(event.dragIndex, 1);
      newOrderedColumns.splice(event.dropIndex, 0, movedColumn);
      this.reportsOrderedColumns = newOrderedColumns;
      this.saveState();
    }
  }

  onProjectsColumnsChange(selectedColumns: StoredColumn[]): void {
    this.selectedColumns = selectedColumns;
    Object.keys(this.projectsVisibleColumns).forEach((key) => {
      this.projectsVisibleColumns[key] = false;
    });
    selectedColumns.forEach((col) => {
      this.projectsVisibleColumns[col.field] = true;
    });
    this.saveState();
  }

  onReportsColumnsChange(selectedColumns: StoredColumn[]): void {
    this.selectedReportColumns = this.excludeConfidentialReportColumns(selectedColumns);
    Object.keys(this.reportsVisibleColumns).forEach((key) => {
      this.reportsVisibleColumns[key] = false;
    });
    this.selectedReportColumns.forEach((col) => {
      this.reportsVisibleColumns[col.field] = true;
    });
    this.saveState();
  }

  // Helper to check filters
  hasProjectColumnFilters(): boolean {
    return Object.keys(this.projectColumnFilterValues).some((field) => {
      const values = this.projectColumnFilterValues[field];
      return values && Array.isArray(values) && values.length > 0;
    });
  }

  hasReportColumnFilters(): boolean {
    return (
      (this.reportStatusFilter && this.reportStatusFilter.length > 0) ||
      (this.reportMerchandiserFilter && this.reportMerchandiserFilter.length > 0) ||
      (this.reportFilialenFilter && this.reportFilialenFilter.length > 0) ||
      (this.reportPlannedOnFilter && this.reportPlannedOnFilter.length > 0) ||
      this.hasGenericFilters()
    );
  }

  hasGenericFilters(): boolean {
    return Object.keys(this.genericFilterValues).some((field) => {
      const values = this.genericFilterValues[field];
      return values && Array.isArray(values) && values.length > 0;
    });
  }

  private normalizeStatusFilter(status: string | null | undefined): string {
    if (!status || status === 'null') {
      return '';
    }

    const normalized = status.toLowerCase();
    if (normalized === 'offene' || normalized === 'open') {
      return 'ongoing';
    }

    return normalized;
  }

  getStatusFilterDisplay(): string {
    if (!this.statusFilter) {
      return '';
    }
    const statusLower = this.statusFilter.toLowerCase();
    if (statusLower === 'new') return 'Neue Reports';
    if (statusLower === 'ongoing' || statusLower === 'offene' || statusLower === 'open') return 'offene Reports';
    if (statusLower === 'completed') return 'abgeschlossene Reports';
    return this.statusFilter.charAt(0).toUpperCase() + this.statusFilter.slice(1).toLowerCase();
  }

  getTotalReportsCount(): number {
    if (!this.filteredProjects) return 0;
    return this.filteredProjects.reduce((sum, project) => sum + this.getDisplayedFilialen(project), 0);
  }

  // #region Missing Helper Methods for Template

  isMobileColumnFilter(): boolean {
    return typeof window !== 'undefined' && window.innerWidth < 1024;
  }

  /** Desktop table layout (lg+): inline expanded rows, no right Aufträge panel */
  isMobileReportsSidebarView(): boolean {
    return this.isMobileColumnFilter();
  }

  isReportsSidebarVisible(project: Project): boolean {
    if (!this.isMobileReportsSidebarView() || !project?.id || !this.sidebarVisibleProjectId) {
      return false;
    }
    return project.id.toString() === this.sidebarVisibleProjectId;
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    if (!this.isMobileReportsSidebarView() && this.sidebarVisibleProjectId) {
      this.closeReportsSidebar(true);
    }
  }

  openColumnFilterModal(): void {
    this.showColumnFilterModal = true;
    this.cdr.detectChanges();
  }

  closeColumnFilterModal(): void {
    this.showColumnFilterModal = false;
    this.cdr.detectChanges();
  }

  getColumnFilterModalTitle(): string {
    if (this.columnFilterModalType === 'project' && this.currentProjectFilterField) {
      return this.getProjectColumnHeader(this.currentProjectFilterField);
    }
    if (this.columnFilterModalType === 'reportStatus') return 'Status';
    if (this.columnFilterModalType === 'reportMerchandiser') return 'Merchandiser';
    if (this.columnFilterModalType === 'reportFilialen') return 'Filiale';
    if (this.columnFilterModalType === 'reportPlannedOn') return 'Geplant';
    if (this.columnFilterModalType === 'reportGeneric' && this.currentFilterField) {
      return this.getColumnHeader(this.currentFilterField);
    }
    return 'Filter';
  }

  getGenericFilterPopoverTitle(): string {
    if (this.currentFilterField) {
      return this.getColumnHeader(this.currentFilterField);
    }
    return 'Filter';
  }

  hasColumnFilterModalSelection(): boolean {
    if (this.columnFilterModalType === 'project' && this.currentProjectFilterField) {
      return (this.projectColumnFilterValues[this.currentProjectFilterField] || []).length > 0;
    }
    if (this.columnFilterModalType === 'reportStatus') {
      return (this.reportStatusFilter || []).length > 0;
    }
    if (this.columnFilterModalType === 'reportMerchandiser') {
      return (this.reportMerchandiserFilter || []).length > 0;
    }
    if (this.columnFilterModalType === 'reportFilialen') {
      return (this.reportFilialenFilter || []).length > 0;
    }
    if (this.columnFilterModalType === 'reportPlannedOn') {
      return (this.reportPlannedOnFilter || []).length > 0;
    }
    if (this.columnFilterModalType === 'reportGeneric' && this.currentFilterField) {
      return (this.genericFilterValues[this.currentFilterField] || []).length > 0;
    }
    return false;
  }

  clearCurrentColumnFilterModal(): void {
    if (this.columnFilterModalType === 'project' && this.currentProjectFilterField) {
      this.projectColumnFilterValues[this.currentProjectFilterField] = [];
      this.onProjectColumnFilterChange();
      return;
    }
    if (this.columnFilterModalType === 'reportStatus') {
      this.reportStatusFilter = [];
      this.onReportStatusFilterChange();
      return;
    }
    if (this.columnFilterModalType === 'reportMerchandiser') {
      this.reportMerchandiserFilter = [];
      this.onReportMerchandiserFilterChange();
      return;
    }
    if (this.columnFilterModalType === 'reportFilialen') {
      this.reportFilialenFilter = [];
      this.onReportFilialenFilterChange();
      return;
    }
    if (this.columnFilterModalType === 'reportPlannedOn') {
      this.reportPlannedOnFilter = [];
      this.onReportPlannedOnFilterChange();
      return;
    }
    if (this.columnFilterModalType === 'reportGeneric' && this.currentFilterField) {
      this.genericFilterValues[this.currentFilterField] = [];
      this.onGenericFilterChange();
    }
  }

  openProjectColumnFilter(field: string, event: Event) {
    event.stopPropagation();
    const targetElement = (event.currentTarget || event.target) as HTMLElement;
    if (!targetElement) {
      return;
    }

    const previousField = this.currentProjectFilterField;

    if (this.isMobileColumnFilter()) {
      const isSameField = previousField === field;
      if (isSameField && this.showColumnFilterModal && this.columnFilterModalType === 'project') {
        this.closeColumnFilterModal();
        return;
      }
      if (this.showColumnFilterModal) {
        this.currentProjectFilterField = field;
        this.currentProjectColumnOptions = this.calculateUniqueValuesForProjectColumn(field);
        if (!this.projectColumnFilterValues[field]) {
          this.projectColumnFilterValues[field] = [];
        }
        this.columnFilterModalType = 'project';
        this.cdr.detectChanges();
        return;
      }
    }

    this.currentProjectFilterField = field;
    this.currentProjectColumnOptions = this.calculateUniqueValuesForProjectColumn(field);
    if (!this.projectColumnFilterValues[field]) {
      this.projectColumnFilterValues[field] = [];
    }

    if (this.isMobileColumnFilter()) {
      this.columnFilterModalType = 'project';
      this.openColumnFilterModal();
      return;
    }

    this.openFilterPopover(this.projectColumnFilterPopover, targetElement, `project-column-${field}`);
  }

  openReportStatusFilter(event: Event) {
    const targetElement = (event.currentTarget || event.target) as HTMLElement;
    if (!targetElement) return;

    this.currentReportStatusOptions = this.getUniqueReportStatuses();
    event.stopPropagation();
    this.openFilterPopover(this.reportStatusFilterPopover, targetElement, 'report-status-filter');
  }

  openReportMerchandiserFilter(event: Event) {
    const targetElement = (event.currentTarget || event.target) as HTMLElement;
    if (!targetElement) return;

    this.currentReportMerchandiserOptions = this.getUniqueMerchandisers();
    event.stopPropagation();
    this.openFilterPopover(this.reportMerchandiserFilterPopover, targetElement, 'report-merchandiser-filter');
  }

  openReportFilialenFilter(event: Event) {
    const targetElement = (event.currentTarget || event.target) as HTMLElement;
    if (!targetElement) return;

    this.currentReportBranchOptions = this.getUniqueFilialen();
    event.stopPropagation();
    this.openFilterPopover(this.reportFilialenFilterPopover, targetElement, 'report-filialen-filter');
  }

  openReportPlannedDateFilter(event: Event) {
    const targetElement = (event.currentTarget || event.target) as HTMLElement;
    if (!targetElement) return;

    this.currentReportPlannedDateOptions = this.getUniquePlannedOnDates();
    event.stopPropagation();
    this.openFilterPopover(this.reportPlannedDateFilterPopover, targetElement, 'report-planned-date-filter');
  }

  openReportDoneDateFilter(event: Event) {
    const targetElement = (event.currentTarget || event.target) as HTMLElement;
    if (!targetElement) return;

    this.currentReportDoneDateOptions = this.getUniqueDoneOnDates();
    event.stopPropagation();
    this.openFilterPopover(this.reportDoneDateFilterPopover, targetElement, 'report-done-date-filter');
  }

  getProjectColumnFilterValue(field: string): string[] {
    return this.projectColumnFilterValues[field] || [];
  }

  getUniqueValuesForProjectColumn(field: string): { label: string; value: string }[] {
    if (field === this.currentProjectFilterField && this.currentProjectColumnOptions.length > 0) {
      return this.currentProjectColumnOptions;
    }
    return this.calculateUniqueValuesForProjectColumn(field);
  }

  calculateUniqueValuesForProjectColumn(field: string): { label: string; value: string }[] {
    const cacheKey = `${field}::${this.getFilterOptionsSignature()}`;
    const cached = this.projectColumnOptionsCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const values = new Set<string>();
    let hasEmptyValue = false;
    // Mirror HeadOffice logic: use all current filters except the column being edited
    const projectsToUse = this.getFilteredProjectsForOptions(field);

    projectsToUse.forEach((p) => {
      let val = '';
      if (field === 'formattedZeitraum') {
        val = p.zeitraum || '';
      } else if (field === 'filialen') {
        val = `${this.computeDisplayedFilialenCount(p, field)} Stores`;
      } else if (field === 'status') {
        val = `${p.reportedPercentage ?? 0}% reported`;
      } else {
        val = this.getProjectField(p, field)?.toString() || '';
      }
      if (this.isEmptyFilterValue(val)) {
        hasEmptyValue = true;
      } else {
        values.add(val);
      }
    });
    const options = Array.from(values)
      .sort()
      .map((val) => ({ label: val, value: val }));
    if (hasEmptyValue) {
      options.unshift({
        label: ProjectsComponent.EMPTY_FILTER_LABEL,
        value: ProjectsComponent.EMPTY_FILTER_VALUE,
      });
    }
    this.projectColumnOptionsCache.set(cacheKey, options);
    return options;
  }

  hasProjectColumnData(field: string): boolean {
    const cacheKey = `${field}::${this.getFilterOptionsSignature()}`;
    if (this.projectColumnDataCache.has(cacheKey)) {
      return this.projectColumnDataCache.get(cacheKey)!;
    }

    const result = (this.filteredProjects || this.projects || []).some((project) => {
      if (field === 'filialen') {
        return this.computeDisplayedFilialenCount(project) > 0;
      }
      if (field === 'status') {
        return project.reportedPercentage !== undefined && project.reportedPercentage !== null;
      }
      const value = this.getProjectField(project, field);
      return !this.isEmptyFilterValue(value);
    });

    this.projectColumnDataCache.set(cacheKey, result);
    return result;
  }

  /**
   * Build a project list for option dropdowns, applying all current filters except the specified column.
   */
  private getFilteredProjectsForOptions(excludeField?: string): Project[] {
    return (this.projects || []).filter((project) => {
      // Active filter (all, running, completed)
      let matchesActiveFilter = true;
      if (this.activeFilter === 'running') {
        matchesActiveFilter = project.status === 'running' || project.status === 'active';
      } else if (this.activeFilter === 'completed') {
        matchesActiveFilter = project.status === 'completed' || project.status === 'closed';
      }

      // Project search
      const matchesProject = !this.projectSearchTerm || (project.name && project.name.toLowerCase().includes(this.projectSearchTerm));

      // Filiale search
      const matchesFiliale =
        !this.filialeSearchTerm ||
        (project.reports &&
          project.reports.some((report) => {
            const term = this.filialeSearchTerm.toLowerCase();
            const branchName = report.branch?.name?.toLowerCase() || '';
            const cityName = (report.branch as any)?.city?.name?.toLowerCase() || '';
            return branchName.includes(term) || cityName.includes(term);
          }));

      // Date range filter
      let matchesDateRange = true;
      if (this.dateRange2.start && this.dateRange2.end) {
        if (project.startDate && project.endDate) {
          const projectStartDate = new Date(project.startDate);
          const projectEndDate = new Date(project.endDate);
          const filterStartDate = new Date(this.dateRange2.start);
          const filterEndDate = new Date(this.dateRange2.end);

          projectStartDate.setHours(0, 0, 0, 0);
          projectEndDate.setHours(23, 59, 59, 999);
          filterStartDate.setHours(0, 0, 0, 0);
          filterEndDate.setHours(23, 59, 59, 999);

          matchesDateRange = projectStartDate <= filterEndDate && projectEndDate >= filterStartDate;
        } else {
          matchesDateRange = false;
        }
      }

      // Project column filters (skip the one being edited)
      let matchesColumnFilters = true;
      this.cols.forEach((col) => {
        if (col.field === excludeField) return;

        const filterValues = this.projectColumnFilterValues[col.field];
        if (filterValues && Array.isArray(filterValues) && filterValues.length > 0) {
          let projectValue: string = '';

          if (col.field === 'formattedZeitraum') {
            projectValue = project.zeitraum || '';
          } else if (col.field === 'filialen') {
            projectValue = `${this.computeDisplayedFilialenCount(project, excludeField)} Stores`;
          } else if (col.field === 'status') {
            const percentage = project.reportedPercentage ?? 0;
            projectValue = `${percentage}% reported`;
          } else {
            projectValue = project[col.field as keyof Project]?.toString() || '';
          }

          if (!this.matchesFilterSelection(projectValue, filterValues)) {
            matchesColumnFilters = false;
          }
        }
      });

      if (excludeField !== 'name') {
        const projectNameFilter = this.projectColumnFilterValues['name'];
        if (matchesColumnFilters && projectNameFilter && Array.isArray(projectNameFilter) && projectNameFilter.length > 0) {
          const projectName = project.name || '';
          if (!this.matchesFilterSelection(projectName, projectNameFilter)) {
            matchesColumnFilters = false;
          }
        }
      }

      // Status filter requires the project to have at least one matching report (if reports are loaded)
      let hasMatchingReports = true;
      if (this.statusFilter) {
        if (project.reports !== undefined && project.reports !== null) {
          const matchingReports = this.filteredReports(project, excludeField === 'status' ? 'status' : undefined);
          hasMatchingReports = matchingReports && matchingReports.length > 0;
        }
      }

      return matchesActiveFilter && matchesProject && matchesFiliale && matchesDateRange && matchesColumnFilters && hasMatchingReports;
    });
  }

  toggleProjectSettingsPopover(event: Event) {
    this.toggleSettingsPopover(this.op, event);
  }

  getDisplayedFilialen(project: Project): number {
    // Use cached value if available
    if (project._displayedFilialen !== undefined) {
      return project._displayedFilialen;
    }

    const count = this.computeDisplayedFilialenCount(project);
    project._displayedFilialen = count;
    return count;
  }

  private computeDisplayedFilialenCount(project: Project, excludeFilterType?: string): number {
    if (!project.reports) {
      return project.branchesCount ?? 0;
    }

    const filtered = this.filteredReports(project, excludeFilterType);
    if (!filtered || filtered.length === 0) {
      return project.branchesCount ?? 0;
    }

    const uniqueBranches = new Set<string>();
    filtered.forEach((report) => {
      if (report.branch?.id) {
        uniqueBranches.add(report.branch.id.toString());
      }
    });

    return uniqueBranches.size > 0 ? uniqueBranches.size : (project.branchesCount ?? 0);
  }

  /**
   * Update derived data for a project (filtered reports, displayed filialen)
   * This should be called when filters change to recalculate cached values
   */
  private updateProjectDerivedData(project: Project): void {
    this.syncProjectQuestions(project);

    const overviewQuestions = this.getOverviewQuestions(project);
    if (project.reports?.length && overviewQuestions.length > 0) {
      project.reports.forEach((report) => {
        overviewQuestions.forEach((question) => {
          const answers = (report.answers || []).filter((answer: any) => answer.question?.id === question.id || answer.questionId === question.id);
          (report as any)[`question_${question.id}`] = answers.length ? this.formatAnswerValue(answers, question.answerType?.name || '') : '';
        });
      });
    }

    project._displayedFilialen = this.computeDisplayedFilialenCount(project);
    this.updateReportFilterMetadata(project);
  }

  downloadProjectCsv(project: Project) {
    if (!project || !project.id) return;

    // Prevent multiple simultaneous downloads for the same project
    if (this.downloadingExcel[project.id]) {
      return;
    }

    // Set loading state
    this.downloadingExcel[project.id] = true;

    // Pass the status filter if it exists
    this.reportService.exportProjectReportsAsExcel(project.id, this.statusFilter).subscribe({
      next: (blob: Blob) => {
        // Create download link
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

        // Show success message
        this.toast.success('Excel-Export erfolgreich heruntergeladen');
      },
      error: (error) => {
        console.error('❌ Error exporting Excel:', error);

        // Clear loading state
        this.downloadingExcel[project.id] = false;

        // Check if it's a "no data" error
        if (error.status === 404 || error.error?.error === 'NO_DATA_FOUND' || (error.status === 400 && error.error?.message?.includes('Keine Daten'))) {
          this.toast.error('Keine Daten zum Exportieren vorhanden.');
        } else {
          this.toast.error('Excel-Export fehlgeschlagen!');
        }
      },
    });
  }

  openStatusFilter(event: Event, project?: Project) {
    const targetElement = (event.currentTarget || event.target) as HTMLElement;
    if (!targetElement) return;

    event.stopPropagation();

    if (project) {
      this.selectedProject = project;
    }

    this.syncUiFiltersFromProject(project || this.selectedProject);
    this.currentReportStatusOptions = this.getUniqueReportStatuses(project || this.selectedProject || undefined);

    if (this.isMobileColumnFilter()) {
      this.columnFilterModalType = 'reportStatus';
      this.openColumnFilterModal();
      return;
    }
    this.openFilterPopover(this.statusFilterPopover, targetElement, 'status');
  }

  onPlannedOnColumnClick(event: Event, project?: Project) {
    if (project) {
      this.selectedProject = project;
    }
    event.stopPropagation();
    this.openPlannedOnFilter(event, project);
  }

  openPlannedOnFilter(event: Event, project?: Project) {
    const targetElement = (event.currentTarget || event.target) as HTMLElement;
    if (!targetElement) return;

    event.stopPropagation();

    if (project) {
      this.selectedProject = project;
    }

    this.syncUiFiltersFromProject(project || this.selectedProject);
    this.currentReportPlannedDateOptions = this.getUniquePlannedOnDates();

    if (this.isMobileColumnFilter()) {
      this.columnFilterModalType = 'reportPlannedOn';
      this.openColumnFilterModal();
      return;
    }
    this.openFilterPopover(this.plannedOnFilterPopover, targetElement, 'plannedOn');
  }

  openMerchandiserFilter(event: Event, project?: Project) {
    const targetElement = (event.currentTarget || event.target) as HTMLElement;
    if (!targetElement) return;

    event.stopPropagation();

    if (project) {
      this.selectedProject = project;
    }

    this.syncUiFiltersFromProject(project || this.selectedProject);
    this.currentReportMerchandiserOptions = this.getUniqueMerchandisers();

    if (this.isMobileColumnFilter()) {
      this.columnFilterModalType = 'reportMerchandiser';
      this.openColumnFilterModal();
      return;
    }
    this.openFilterPopover(this.merchandiserFilterPopover, targetElement, 'merchandiser');
  }

  openFilialenFilter(event: Event, project?: Project) {
    const targetElement = (event.currentTarget || event.target) as HTMLElement;
    if (!targetElement) return;

    event.stopPropagation();

    if (project) {
      this.selectedProject = project;
    }

    this.syncUiFiltersFromProject(project || this.selectedProject);
    this.currentReportBranchOptions = this.getUniqueFilialen();

    if (this.isMobileColumnFilter()) {
      this.columnFilterModalType = 'reportFilialen';
      this.openColumnFilterModal();
      return;
    }
    this.openFilterPopover(this.filialenFilterPopover, targetElement, 'filialen');
  }

  getUniqueValuesForField(field: string): { label: string; value: string }[] {
    const values = new Set<string>();
    let hasEmptyValue = false;

    const projectsToScan = this.selectedProject ? [this.selectedProject] : this.filteredProjects && this.filteredProjects.length > 0 ? this.filteredProjects : this.projects || [];

    projectsToScan.forEach((project) => {
      const reports = this.filteredReports(project, field);
      reports.forEach((r) => {
        let val: string | undefined;
        if (field === 'reportTo') {
          val = this.formatDateForFilter(r.reportTo);
        } else if (field === 'plannedOn') {
          val = this.formatDateForFilter(r.plannedOn);
        } else {
          val = this.getReportFieldValue(r, field);
        }

        if (val === '-') {
          // Keep "-" as an explicit non-empty value if backend uses it as placeholder.
          values.add(val);
        } else if (this.isEmptyFilterValue(val)) {
          hasEmptyValue = true;
        } else {
          values.add(val);
        }
      });
    });
    const options = Array.from(values)
      .sort()
      .map((val) => ({ label: val, value: val }));
    if (hasEmptyValue) {
      options.unshift({
        label: ProjectsComponent.EMPTY_FILTER_LABEL,
        value: ProjectsComponent.EMPTY_FILTER_VALUE,
      });
    }
    return options;
  }

  private isEmptyFilterValue(value: unknown): boolean {
    if (value === null || value === undefined) {
      return true;
    }

    if (typeof value === 'string') {
      return value.trim() === '';
    }

    return false;
  }

  private normalizeFilterValue(value: unknown): string {
    if (this.isEmptyFilterValue(value)) {
      return ProjectsComponent.EMPTY_FILTER_VALUE;
    }
    return String(value);
  }

  private matchesFilterSelection(value: unknown, selectedValues: string[]): boolean {
    const normalized = this.normalizeFilterValue(value);
    return selectedValues.includes(normalized);
  }

  openGenericFilter(field: string, event: Event, project?: Project) {
    const targetElement = (event.currentTarget || event.target) as HTMLElement;
    if (!targetElement) {
      return;
    }

    event.stopPropagation();

    if (project) {
      this.selectedProject = project;
    }

    const projectForFilters = project || this.selectedProject;
    this.syncUiFiltersFromProject(projectForFilters);
    this.currentFilterField = field;
    this.currentGenericOptions = this.getUniqueValuesForField(field);

    if (!this.genericFilterValues[field]) {
      this.genericFilterValues[field] = [];
    }

    if (this.isMobileColumnFilter()) {
      this.columnFilterModalType = 'reportGeneric';
      this.openColumnFilterModal();
      return;
    }
    this.openFilterPopover(this.genericFilterPopover, targetElement, `generic-${field}`);
  }

  handleGenericFilterClick(field: string, project: Project, event: Event) {
    this.openGenericFilter(field, event, project);
  }

  getGenericFilterValue(field: string): string[] {
    return this.genericFilterValues[field] || [];
  }

  /**
   * Check if a project has a status filter
   */
  hasReportStatusFilter(project?: Project): boolean {
    const proj = project || this.selectedProject;
    if (!proj) return false;
    const filters = this.getProjectReportFilters(proj);
    return filters.status && filters.status.length > 0;
  }

  /**
   * Check if a project has a merchandiser filter
   */
  hasReportMerchandiserFilter(project?: Project): boolean {
    const proj = project || this.selectedProject;
    if (!proj) return false;
    const filters = this.getProjectReportFilters(proj);
    return filters.merchandiser && filters.merchandiser.length > 0;
  }

  /**
   * Check if a project has a filialen filter
   */
  hasReportFilialenFilter(project?: Project): boolean {
    const proj = project || this.selectedProject;
    if (!proj) return false;
    const filters = this.getProjectReportFilters(proj);
    return filters.filialen && filters.filialen.length > 0;
  }

  /**
   * Check if a project has a plannedOn filter
   */
  hasReportPlannedOnFilter(project?: Project): boolean {
    const proj = project || this.selectedProject;
    if (!proj) return false;
    const filters = this.getProjectReportFilters(proj);
    return filters.plannedOn && filters.plannedOn.length > 0;
  }

  /**
   * Check if a project has a generic filter for a specific field
   */
  hasReportGenericFilter(field: string, project: Project): boolean {
    const filters = this.getProjectReportFilters(project);
    return filters.generic[field] && Array.isArray(filters.generic[field]) && filters.generic[field].length > 0;
  }

  getReportStatusFilterCount(project: Project): number {
    const filters = this.getProjectReportFilters(project);
    return filters.status?.length || 0;
  }

  getReportPlannedOnFilterCount(project: Project): number {
    const filters = this.getProjectReportFilters(project);
    return filters.plannedOn?.length || 0;
  }

  getReportMerchandiserFilterCount(project: Project): number {
    const filters = this.getProjectReportFilters(project);
    return filters.merchandiser?.length || 0;
  }

  getReportFilialenFilterCount(project: Project): number {
    const filters = this.getProjectReportFilters(project);
    return filters.filialen?.length || 0;
  }

  getReportGenericFilterCount(field: string, project: Project): number {
    const filters = this.getProjectReportFilters(project);
    const values = filters.generic[field];
    return Array.isArray(values) ? values.length : 0;
  }

  getColumnFilterTooltip(header: string, selectedCount: number): string {
    if (selectedCount > 0) {
      return `Filter: ${header} (${selectedCount} ausgewählt)`;
    }
    return `Filter: ${header}`;
  }

  getReportFilterSelectedCount(project: Project | null | undefined, columnField: string): number {
    if (!project) {
      return 0;
    }

    const cached = project._reportFilterCounts?.[columnField];
    if (cached !== undefined) {
      return cached;
    }

    const filters = this.getProjectReportFilters(project);
    if (columnField === 'status') return filters.status?.length ?? 0;
    if (columnField === 'merchandiser') return filters.merchandiser?.length ?? 0;
    if (columnField === 'branch.name') return filters.filialen?.length ?? 0;
    if (columnField === 'plannedOn') return filters.plannedOn?.length ?? 0;
    return filters.generic?.[columnField]?.length ?? 0;
  }

  hasReportColumnData(field: string, project?: Project): boolean {
    if (!project || !project.reports || project.reports.length === 0) {
      return false;
    }

    const cached = project._reportCanFilter?.[field];
    if (cached !== undefined) {
      return cached;
    }

    return this.computeReportColumnHasData(project, field);
  }

  private computeReportColumnHasData(project: Project, field: string): boolean {
    return project.reports!.some((report) => {
      if (field === 'status') {
        return report.status && report.status.name;
      }
      if (field === 'merchandiser') {
        return report.merchandiser && report.merchandiser.user;
      }
      if (field === 'branch.name') {
        return report.branch && report.branch.name;
      }
      if (field === 'plannedOn') {
        return !!report.plannedOn;
      }
      const val = this.getReportFieldValue(report, field);
      return val !== null && val !== undefined && val !== '' && val !== '-';
    });
  }

  private updateReportFilterMetadata(project: Project): void {
    if (!project) {
      return;
    }

    const filters = this.getProjectReportFilters(project);
    const counts: { [field: string]: number } = {
      status: filters.status?.length ?? 0,
      merchandiser: filters.merchandiser?.length ?? 0,
      'branch.name': filters.filialen?.length ?? 0,
      plannedOn: filters.plannedOn?.length ?? 0,
    };

    Object.keys(filters.generic || {}).forEach((field) => {
      counts[field] = filters.generic[field]?.length ?? 0;
    });

    const canFilter: { [field: string]: boolean } = {};
    if (project.reports?.length) {
      ['status', 'merchandiser', 'branch.name', 'plannedOn'].forEach((field) => {
        canFilter[field] = this.computeReportColumnHasData(project, field);
      });

      this.excludeConfidentialReportColumns(this.selectedReportColumns || []).forEach((col) => {
        if (!['plannedOn', 'merchandiser', 'branch.name'].includes(col.field)) {
          canFilter[col.field] = this.computeReportColumnHasData(project, col.field);
        }
      });
    }

    project._reportFilterCounts = counts;
    project._reportCanFilter = canFilter;
  }

  canFilterStatus(project?: Project): boolean {
    return this.hasReportColumnData('status', project);
  }

  canFilterMerchandiser(project?: Project): boolean {
    return this.hasReportColumnData('merchandiser', project);
  }

  canFilterFilialen(project?: Project): boolean {
    return this.hasReportColumnData('branch.name', project);
  }

  canFilterPlannedOn(project?: Project): boolean {
    return this.hasReportColumnData('plannedOn', project);
  }

  /**
   * Check if a field can be filtered (has unique values)
   */
  canFilterGenericField(field: string, project?: Project): boolean {
    return this.hasReportColumnData(field, project);
  }

  toggleReportSettingsPopover(event: Event) {
    this.toggleSettingsPopover(this.reportColumnsPopover, event);
  }

  onReportRowClick(report: Report, project: Project): void {
    if (project?.id && report?.id) {
      this.router.navigate(['/projects', project.id, 'reports', report.id]);
    }
  }

  /**
   * Get unique status values from all projects' reports
   * @param project The project to get statuses from (optional, defaults to selectedProject or all projects)
   * @returns Array of unique status objects with name and color
   */
  getUniqueReportStatuses(project?: Project): Array<{ label: string; value: string; name: string; color: string }> {
    const statusMap = new Map<string, string>();
    let hasEmptyValue = false;

    const projectsToUse = project ? [project] : this.selectedProject ? [this.selectedProject] : this.filteredProjects && this.filteredProjects.length > 0 ? this.filteredProjects : this.projects || [];

    projectsToUse.forEach((proj) => {
      // Use filteredReports to respect other filters (except status)
      const reports = this.filteredReports(proj, 'status');
      reports.forEach((report) => {
        if (report.status?.name) {
          statusMap.set(report.status.name, report.status.color || '#cccccc');
        } else {
          hasEmptyValue = true;
        }
      });
    });

    const result = Array.from(statusMap.entries())
      .map(([name, color]) => ({
        label: name,
        value: name,
        name: name,
        color: color,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    if (hasEmptyValue) {
      result.unshift({
        label: ProjectsComponent.EMPTY_FILTER_LABEL,
        value: ProjectsComponent.EMPTY_FILTER_VALUE,
        name: ProjectsComponent.EMPTY_FILTER_LABEL,
        color: '#9ca3af',
      });
    }

    return result;
  }

  getUniqueMerchandisers(): any[] {
    if (!this.selectedProject || !this.selectedProject.reports) return [];
    const values = new Set<string>();
    let hasEmptyValue = false;
    const reports = this.filteredReports(this.selectedProject, 'merchandiser');
    reports.forEach((r) => {
      const name = this.getReportMerchandiserName(r);
      if (this.isEmptyFilterValue(name)) {
        hasEmptyValue = true;
      } else {
        values.add(name);
      }
    });
    const options = Array.from(values)
      .sort()
      .map((s) => ({ label: s, value: s }));
    if (hasEmptyValue) {
      options.unshift({
        label: ProjectsComponent.EMPTY_FILTER_LABEL,
        value: ProjectsComponent.EMPTY_FILTER_VALUE,
      });
    }
    return options;
  }

  getUniqueFilialen(): any[] {
    if (!this.selectedProject || !this.selectedProject.reports) return [];
    const values = new Set<string>();
    let hasEmptyValue = false;
    const reports = this.filteredReports(this.selectedProject, 'branch.name');
    reports.forEach((r) => {
      const name = r.branch?.name;
      if (this.isEmptyFilterValue(name)) {
        hasEmptyValue = true;
      } else {
        values.add(name);
      }
    });
    const options = Array.from(values)
      .sort()
      .map((s) => ({ label: s, value: s }));
    if (hasEmptyValue) {
      options.unshift({
        label: ProjectsComponent.EMPTY_FILTER_LABEL,
        value: ProjectsComponent.EMPTY_FILTER_VALUE,
      });
    }
    return options;
  }

  getUniquePlannedOnDates(): any[] {
    if (!this.selectedProject || !this.selectedProject.reports) return [];
    const values = new Set<string>();
    let hasEmptyValue = false;
    const reports = this.filteredReports(this.selectedProject, 'plannedOn');
    reports.forEach((r) => {
      const val = this.formatDateForFilter(r.plannedOn);
      if (this.isEmptyFilterValue(val)) {
        hasEmptyValue = true;
      } else {
        values.add(val);
      }
    });
    const options = Array.from(values)
      .sort()
      .map((s) => ({ label: s, value: s }));
    if (hasEmptyValue) {
      options.unshift({
        label: ProjectsComponent.EMPTY_FILTER_LABEL,
        value: ProjectsComponent.EMPTY_FILTER_VALUE,
      });
    }
    return options;
  }

  getUniqueDoneOnDates(): any[] {
    if (!this.selectedProject || !this.selectedProject.reports) return [];
    const values = new Set<string>();
    const reports = this.filteredReports(this.selectedProject, 'reportTo');
    reports.forEach((r) => {
      const val = this.formatDateForFilter(r.reportTo);
      if (val) values.add(val);
    });
    return Array.from(values)
      .sort()
      .map((s) => ({ label: s, value: s }));
  }

  getProjectColumnHeader(field: string): string {
    const col = this.cols.find((c) => c.field === field);
    return col ? col.header : field;
  }

  getColumnHeader(field: string): string {
    const col = this.reportCols.find((c) => c.field === field);
    return col ? col.header : field;
  }

  /**
   * Check if a report matches the specified status filter
   * @param report The report to check
   * @param statusFilter The status filter value
   * @returns true if the report matches the status filter
   */
  reportMatchesStatus(report: Report, statusFilter: string): boolean {
    if (!statusFilter) return true;
    if (!report.status) {
      return false;
    }

    // Convert status id to number for comparison (handles both string and number types from API)
    const statusId = Number(report.status.id);

    // Handle different status filter values - matching backend logic using enum
    switch (statusFilter.toLowerCase()) {
      case 'new':
        return categorizeReportForClient(statusId) === 'new';

      case 'completed':
        return categorizeReportForClient(statusId) === 'completed';

      case 'ongoing':
        return categorizeReportForClient(statusId) === 'ongoing';

      case 'offene':
      case 'open':
        return categorizeReportForClient(statusId) === 'ongoing';

      default:
        // For any other status, do exact match by name
        return report.status.name?.toLowerCase() === statusFilter.toLowerCase();
    }
  }

  formatDateForFilter(date: string | Date | undefined): string {
    if (!date) return '';
    const d = new Date(date);
    return `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1).toString().padStart(2, '0')}.${d.getFullYear()}`;
  }

  getReportFieldValue(report: Report, field: string): any {
    return this.getReportField(report, field);
  }

  // #endregion

  /**
   * Capture reports table scroll position before navigation or collapse
   */
  private captureReportsTableScrollPosition(): void {
    const expandedRowCell = document.querySelector('.expanded-row-cell');

    if (expandedRowCell) {
      // Try multiple selectors to find the scrollable element (same order as restore)
      const selectors = ['.p-datatable-scrollable-body', '.p-datatable-wrapper', '.p-scroller', '.p-datatable-table-container', '.p-virtualscroller', 'cdk-virtual-scroll-viewport'];

      for (const selector of selectors) {
        const el = expandedRowCell.querySelector(selector) as HTMLElement;
        if (el) {
          const style = window.getComputedStyle(el);
          const isScrollable = el.scrollHeight > el.clientHeight && (style.overflowY === 'auto' || style.overflowY === 'scroll' || style.overflow === 'auto' || style.overflow === 'scroll');
          if (isScrollable && el.scrollTop > 0) {
            this.reportsTableScrollPosition = el.scrollTop;
            this.saveState(); // Save immediately
            return;
          }
        }
      }

      // Fallback - check all scrollable divs
      const divs = expandedRowCell.querySelectorAll('div');
      for (let i = 0; i < divs.length; i++) {
        const div = divs[i] as HTMLElement;
        const style = window.getComputedStyle(div);
        if ((style.overflowY === 'auto' || style.overflowY === 'scroll') && div.scrollHeight > div.clientHeight && div.scrollTop > 0) {
          this.reportsTableScrollPosition = div.scrollTop;
          this.saveState(); // Save immediately
          return;
        }
      }
    }
  }

  /**
   * Restore reports table scroll position
   */
  private restoreReportsTableScrollPosition(): void {
    const targetPosition = this.reportsTableScrollPosition;

    // Skip if no position to restore
    if (!targetPosition || targetPosition <= 0) {
      // Still attach listener for future scrolls
      this.attachReportsTableListenerOnly();
      return;
    }

    // Set flag to prevent multiple simultaneous restores
    if (this.isRestoringScroll) {
      return;
    }

    this.isRestoringScroll = true;

    let attempts = 0;
    const maxAttempts = 50;

    const checkAndRestore = () => {
      let scrollableBody: HTMLElement | null = null;

      const expandedRowCell = document.querySelector('.expanded-row-cell');

      if (expandedRowCell) {
        // Try multiple selectors to find the scrollable element
        const selectors = ['.p-datatable-scrollable-body', '.p-datatable-wrapper', '.p-scroller', '.p-datatable-table-container', '.p-virtualscroller', 'cdk-virtual-scroll-viewport'];

        for (const selector of selectors) {
          const el = expandedRowCell.querySelector(selector) as HTMLElement;
          if (el) {
            const style = window.getComputedStyle(el);
            const isScrollable = el.scrollHeight > el.clientHeight && (style.overflowY === 'auto' || style.overflowY === 'scroll' || style.overflow === 'auto' || style.overflow === 'scroll');
            if (isScrollable || el.scrollHeight > el.clientHeight) {
              scrollableBody = el;
              break;
            }
          }
        }

        // Fallback - check all scrollable divs
        if (!scrollableBody) {
          const divs = expandedRowCell.querySelectorAll('div');
          for (let i = 0; i < divs.length; i++) {
            const div = divs[i] as HTMLElement;
            const style = window.getComputedStyle(div);
            if ((style.overflowY === 'auto' || style.overflowY === 'scroll') && div.scrollHeight > div.clientHeight) {
              scrollableBody = div;
              break;
            }
          }
        }
      }

      if (scrollableBody) {
        this.attachReportsTableScrollListener(scrollableBody);

        const beforeScroll = scrollableBody.scrollTop;
        // Use instant scroll first to prevent visible jump, then smooth if needed
        scrollableBody.scrollTop = targetPosition;

        // Verify and retry if needed (handles virtual scrolling and dynamic content loading)
        const verifyAndRetry = () => {
          if (scrollableBody) {
            const currentScroll = scrollableBody.scrollTop;
            const difference = Math.abs(currentScroll - targetPosition);

            // If we're close enough (within 10px), consider it successful
            if (difference <= 10) {
              this.hasRestoredScrollThisCycle = true;
              setTimeout(() => {
                this.isRestoringScroll = false;
              }, 500);
              return;
            }

            // If not close enough and we have more attempts, try again
            if (attempts < maxAttempts) {
              attempts++;
              scrollableBody.scrollTop = targetPosition;
              setTimeout(verifyAndRetry, 100);
            } else {
              // Max attempts reached, mark as restored anyway
              this.hasRestoredScrollThisCycle = true;
              setTimeout(() => {
                this.isRestoringScroll = false;
              }, 500);
            }
          }
        };

        // Start verification after a short delay
        setTimeout(verifyAndRetry, 50);
      } else if (attempts < maxAttempts) {
        attempts++;
        setTimeout(() => {
          checkAndRestore();
        }, 50);
      } else {
        this.isRestoringScroll = false;
        // Mark as restored even if we couldn't find the element (to prevent retries)
        this.hasRestoredScrollThisCycle = true;
      }
    };

    checkAndRestore();

    // Reset flag after max attempts (safety net)
    setTimeout(() => {
      this.isRestoringScroll = false;
    }, 3000);
  }

  /**
   * Attach scroll listener to reports table
   */
  private attachReportsTableScrollListener(element: HTMLElement): void {
    // Remove existing listener
    if (this.reportsTableScrollListener) {
      this.reportsTableScrollListener();
      this.reportsTableScrollListener = undefined;
    }

    this.reportsTableScrollListener = this.renderer.listen(element, 'scroll', (event) => {
      // Don't update scroll position if we're currently restoring (prevents reset)
      if (this.isRestoringScroll) {
        return;
      }

      const target = event.target as HTMLElement;
      this.reportsTableScrollPosition = target.scrollTop;
      this.saveState();
    });
  }

  /**
   * Called when a project is expanded to restore scroll position
   */
  onProjectExpanded(): void {
    // Prevent multiple simultaneous restores
    if (this.isRestoringScroll) {
      return;
    }

    // Prevent restoring scroll multiple times in the same navigation cycle
    if (this.hasRestoredScrollThisCycle) {
      // Still attach listener for future scrolls
      this.attachReportsTableListenerOnly();
      return;
    }

    // Clear previous listener if any
    if (this.reportsTableScrollListener) {
      this.reportsTableScrollListener();
      this.reportsTableScrollListener = undefined;
    }

    // Use requestAnimationFrame for fastest possible response
    // This will restore scroll if there's a saved position (from returning from report detail)
    requestAnimationFrame(() => {
      this.restoreReportsTableScrollPosition();
    });
  }

  /**
   * Attach reports table scroll listener without restoring position
   */
  private attachReportsTableListenerOnly(): void {
    let attempts = 0;
    const maxAttempts = 20;

    const tryAttach = () => {
      const expandedRowCell = document.querySelector('.expanded-row-cell');

      if (expandedRowCell) {
        const selectors = ['.p-scroller', '.p-datatable-wrapper', '.p-datatable-scrollable-body'];
        for (const selector of selectors) {
          const el = expandedRowCell.querySelector(selector) as HTMLElement;
          if (el && el.scrollHeight > el.clientHeight) {
            this.attachReportsTableScrollListener(el);
            return;
          }
        }
      }

      if (attempts < maxAttempts) {
        attempts++;
        requestAnimationFrame(tryAttach);
      }
    };

    tryAttach();
  }

  private captureProjectsTableScrollPosition(): void {
    const el = this.document.querySelector('.projects-table .p-scroller-viewport') || this.document.querySelector('.projects-table .p-datatable-scrollable-body');
    if (el) {
      // Only update if we have a positive scroll value, to avoid overwriting a pending restore target with 0
      // This is crucial when background loading happens before the initial scroll restoration completes
      if (el.scrollTop > 0) {
        this.projectsTableScrollPosition = el.scrollTop;
      }
    }
  }

  private projectsTableScrollListener?: () => void;

  private attachProjectsTableScrollListener(element: HTMLElement): void {
    if (this.projectsTableScrollListener) {
      return;
    }

    this.projectsTableScrollListener = this.renderer.listen(element, 'scroll', (event) => {
      const target = event.target as HTMLElement;
      this.projectsTableScrollPosition = target.scrollTop;
    });
  }

  private restoreProjectsTableScrollPosition(behavior: ScrollBehavior = 'auto'): void {
    const targetPosition = this.projectsTableScrollPosition;
    if (targetPosition <= 0) return;

    if (this.isRestoringProjectsScroll) return;
    this.isRestoringProjectsScroll = true;

    let attempts = 0;
    const maxAttempts = 30;

    const checkAndRestore = () => {
      const el =
        this.document.querySelector('.projects-table .p-scroller-viewport') ||
        this.document.querySelector('.projects-table .p-datatable-scrollable-body') ||
        this.document.querySelector('.projects-table .p-datatable-wrapper');

      if (el) {
        // Attach listener if not already attached
        this.attachProjectsTableScrollListener(el as HTMLElement);

        // Only restore if scrollHeight allows it
        if (el.scrollHeight > el.clientHeight) {
          // Use direct assignment for 'auto' (instant) to prevent jumping during data reload
          // Use scrollTo for 'smooth' if explicitly requested (e.g. initial load)
          if (behavior === 'smooth') {
            el.scrollTo({ top: targetPosition, behavior: 'smooth' });
          } else {
            el.scrollTop = targetPosition;
          }

          // Verify if scroll worked
          if (Math.abs(el.scrollTop - targetPosition) < 50) {
            this.isRestoringProjectsScroll = false;
            return;
          }
        }
      }

      if (attempts < maxAttempts) {
        attempts++;
        requestAnimationFrame(checkAndRestore);
      } else {
        this.isRestoringProjectsScroll = false;
      }
    };

    requestAnimationFrame(checkAndRestore);
  }

  private toggleSettingsPopover(popoverRef: any, event: Event): void {
    const targetElement = (event.currentTarget || event.target) as HTMLElement;
    if (!popoverRef || !targetElement) {
      return;
    }

    event.stopPropagation();

    if (this.activeSettingsPopover === popoverRef) {
      popoverRef.hide();
      this.activeSettingsPopover = null;
      return;
    }

    this.hideFilterPopovers();
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
      this.scheduleOpenFirstDropdown(popoverRef);
    }, 120);
  }

  private hideSettingsPopovers(except?: any): void {
    const popovers = [this.op, this.reportColumnsPopover];

    popovers.forEach((popover) => {
      if (popover && popover !== except) {
        popover.hide();
      }
    });

    if (!except) {
      this.activeSettingsPopover = null;
    } else if (this.activeSettingsPopover && this.activeSettingsPopover !== except) {
      this.activeSettingsPopover = null;
    }
  }

  private openFilterPopover(popoverRef: any, targetElement: HTMLElement, uniqueId?: string): void {
    if (!popoverRef || !targetElement) {
      return;
    }

    // Check if the same popover AND same ID is already open
    const isSamePopover = this.activeFilterPopover === popoverRef;
    const isSameId = uniqueId ? this.activeFilterId === uniqueId : true;
    const isPopoverVisible = this.isPopoverVisible(popoverRef);

    // If clicking on the same popover/field that's already open, just close it
    if (isSamePopover && isSameId && isPopoverVisible) {
      this.hideFilterPopovers();
      return;
    }

    this.hideSettingsPopovers();
    // Hide ALL filter popovers first
    this.hideFilterPopovers();

    // Then show the new one
    this.showFilterPopover(popoverRef, targetElement, uniqueId);
  }

  private isPopoverVisible(popoverRef: any): boolean {
    if (!popoverRef) {
      return false;
    }

    if (typeof popoverRef.visible === 'boolean') {
      return popoverRef.visible;
    }

    if (typeof popoverRef.overlayVisible === 'boolean') {
      return popoverRef.overlayVisible;
    }

    const overlayElement: HTMLElement | null = popoverRef?.overlay?.nativeElement ?? null;
    if (!overlayElement) {
      return false;
    }

    return document.body.contains(overlayElement) && overlayElement.offsetParent !== null;
  }

  private hideFilterPopovers(except?: any): void {
    const popovers = [this.genericFilterPopover, this.projectColumnFilterPopover, this.statusFilterPopover, this.merchandiserFilterPopover, this.filialenFilterPopover, this.plannedOnFilterPopover];

    popovers.forEach((popover) => {
      if (popover && popover !== except) {
        popover.hide();
      }
    });

    if (!except) {
      this.activeFilterPopover = null;
      this.activeFilterId = null;
    } else if (this.activeFilterPopover && this.activeFilterPopover !== except) {
      this.activeFilterPopover = null;
      this.activeFilterId = null;
    }
  }

  private showFilterPopover(popoverRef: any, targetElement: HTMLElement, uniqueId?: string): void {
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

    // Ensure popover is hidden first
    popoverRef.hide();
    this.activeFilterPopover = null;
    this.activeFilterId = null;
    this.cdr.detectChanges();

    requestAnimationFrame(() => {
      popoverRef.show(positioningEvent);
      this.activeFilterPopover = popoverRef;
      this.activeFilterId = uniqueId || null;
      this.scheduleOpenFirstDropdown(popoverRef);
      this.cdr.detectChanges();
    });
  }

  private invalidateFilterCaches(): void {
    this.filterOptionsSignature = '';
    this.projectColumnOptionsCache.clear();
    this.projectColumnDataCache.clear();
    this.filteredReportsCache.clear();
  }

  private formatFilterArray(values?: string[]): string {
    if (!values || values.length === 0) {
      return '';
    }

    return values
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      .map((value) => value.trim())
      .sort((a, b) => a.localeCompare(b))
      .join(',');
  }

  private getFilterOptionsSignature(): string {
    if (this.filterOptionsSignature) {
      return this.filterOptionsSignature;
    }

    const projectColumnSignature = Object.keys(this.projectColumnFilterValues)
      .sort()
      .map((key) => `${key}:${this.formatFilterArray(this.projectColumnFilterValues[key])}`)
      .join('|');

    this.filterOptionsSignature = [
      this.activeFilter,
      this.projectSearchTerm || '',
      this.filialeSearchTerm || '',
      this.statusFilter || '',
      this.dateRange2.start ? this.dateRange2.start.toISOString() : '',
      this.dateRange2.end ? this.dateRange2.end.toISOString() : '',
      projectColumnSignature,
      (this.filteredProjects || []).map((project) => project.id).join(','),
    ].join('::');

    return this.filterOptionsSignature;
  }

  private getReportFilterSignature(project: Project): string {
    const filters = this.getProjectReportFilters(project);
    const genericKeys = Object.keys(filters.generic || {}).sort();
    const genericSignature = genericKeys.map((key) => `${key}:${this.formatFilterArray(filters.generic[key])}`).join('|');
    const isSelected = this.selectedProject?.id === project.id;

    return [
      project.reports?.length ?? 0,
      this.statusFilter || '',
      this.filialeSearchTerm || '',
      this.dateRange2.start ? this.dateRange2.start.toISOString() : '',
      this.dateRange2.end ? this.dateRange2.end.toISOString() : '',
      isSelected ? this.formatFilterArray(this.reportStatusFilter) : this.formatFilterArray(filters.status),
      isSelected ? this.formatFilterArray(this.reportMerchandiserFilter) : this.formatFilterArray(filters.merchandiser),
      isSelected ? this.formatFilterArray(this.reportFilialenFilter) : this.formatFilterArray(filters.filialen),
      isSelected ? this.formatFilterArray(this.reportPlannedOnFilter) : this.formatFilterArray(filters.plannedOn),
      isSelected ? JSON.stringify(this.genericFilterValues) : JSON.stringify(filters.generic || {}),
      genericSignature,
    ].join('||');
  }

  private scheduleOpenFirstDropdown(popoverRef: any): void {
    // Try a few times to catch the overlay once it is rendered
    [0, 50, 120].forEach((delay) => setTimeout(() => this.tryOpenFirstDropdown(popoverRef), delay));
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

  ngOnDestroy(): void {
    // Clean up click outside listener
    if (this.clickOutsideListener) {
      this.clickOutsideListener();
      this.clickOutsideListener = undefined;
    }

    // Clean up reports table scroll listener
    if (this.reportsTableScrollListener) {
      this.reportsTableScrollListener();
    }

    // Clean up projects table scroll listener
    if (this.projectsTableScrollListener) {
      this.projectsTableScrollListener();
    }

    // Clean up filter popover timeout
    if (this.filterPopoverTimeout) {
      clearTimeout(this.filterPopoverTimeout);
      this.filterPopoverTimeout = null;
    }
  }
}
