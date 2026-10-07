import { Component, OnInit, OnDestroy, ViewChild, ElementRef, HostListener } from '@angular/core';
import { Location } from '@angular/common';
import { ActivatedRoute, Router, NavigationStart, NavigationEnd } from '@angular/router';
import { ClientService } from '@app/@core/services/client.service';
import { ClientCompanyService, ClientCompany } from '@app/@core/services/client-company.service';
import { TableRowCollapseEvent, TableRowExpandEvent } from 'primeng/table';
import { ProjectService } from '@app/@core/services/project.service';
import { ReportService } from '@app/@core/services/report.service';
import { NotificationsService } from '@app/core/services/notifications.service';
import { ClientDetailStateService, ClientDetailState } from './client-detail-state.service';
import { catchError, finalize, of, filter } from 'rxjs';
import { ReportStatusEnum } from '@app/@core/enums/status.enum';
import { categorizeReportForMerchandiser } from '@app/@core/utils/report-merchandiser-status.util';
import { isPendingMerchandiserAcceptance } from '@app/@core/utils/report-merchandiser-status.util';
import { HotToastService } from '@ngneat/hot-toast';
import { Subject, Subscription } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

interface Report {
  id?: number;
  project?: {
    id?: number;
    name?: string;
    startDate?: string;
    endDate?: string;
    createdAt?: string;
    updatedAt?: string;
  };
  status?: {
    id?: number;
    name?: string;
    color?: string;
  };
  clientCompany?: {
    id?: number;
    logo?: {
      id?: string;
      path?: string;
    };
    name?: string;
    createdAt?: string;
    updatedAt?: string;
  };
  branch?: {
    id?: number;
    name?: string;
    branchNumber?: string;
    street?: string;
    zipCode?: string;
    phone?: string;
    city?: {
      id?: number;
      name?: string;
      country?: {
        name?: string | { de?: string };
      };
    };
    client?: {
      id?: number;
      logo?: {
        id?: string;
        path?: string;
      };
      name?: string;
      createdAt?: string;
      updatedAt?: string;
    };
    createdAt?: string;
    updatedAt?: string;
  };
  street?: string;
  zipCode?: string;
  phone?: string;
  address?: string;
  plannedOn?: string;
  note?: string;
  reportTo?: string;
  feedback?: string | boolean;
  isFavorite?: boolean;
  accepted?: boolean;
  createdAt?: string;
  updatedAt?: string;
  merchandiser?: any;
}

interface ProjectReportFilters {
  status: string[];
  merchandiser: string[];
  filialen: string[];
  plannedOn: string[];
  reportTo: string[];
  generic: { [field: string]: string[] };
}

interface Project {
  id?: string;
  name?: string;
  zeitraum?: string;
  calendarWeek?: string;
  startDate?: string;
  endDate?: string;
  filialen?: number;
  status?: string;
  isFavorite?: boolean;
  reports?: Report[];
  slug?: string;
  branchesCount?: number;
  reportedPercentage?: number; // Calculated in backend
  _filteredReports?: Report[]; // Cache for filtered reports
  _displayedFilialen?: number; // Cache for displayed filialen count
  _reportFilters?: ProjectReportFilters; // Per-project report column filters
}

interface Column {
  field: string;
  header: string;
}

@Component({
  selector: 'app-client-detail',
  templateUrl: './client-detail.component.html',
  styleUrls: ['./client-detail.component.scss'],
  standalone: false,
})
export class ClientDetailComponent implements OnInit, OnDestroy {
  client: ClientCompany | undefined;
  projects!: Project[];
  selectedProject!: Project | null;
  expandedRows: { [key: string]: boolean } = {};
  cols!: Column[];
  selectedColumns!: Column[];
  dateRange: Date[] = [];
  referrer: string | null = null;

  // Add filter properties
  projectSearchTerm: string = '';
  filialeSearchTerm: string = '';
  filteredProjects: Project[] = [];

  /** Mobile: full-screen sidebar for project reports (HeadOffice pattern) */
  sidebarVisibleProjectId: string | null = null;
  private mobileReportsSidebarScrollPositionByProject: { [projectId: string]: number } = {};

  dateRange2 = { start: null, end: null };
  statusFilter: any;

  onRangeSelected(range: { start: Date | null; end: Date | null }) {
    console.log('Selected range:', range);
    this.dateRange2 = range;
    this.applyFilters();
    this.saveState();
  }

  @ViewChild('datePickerButton') datePickerButton: ElementRef;
  @ViewChild('datePickerContent') datePickerContent: ElementRef;
  @ViewChild('genericFilterPopover') genericFilterPopover: any;
  isDatePickerOpen = false;

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;

    // Check if click is outside of date picker elements
    if (this.isDatePickerOpen) {
      const buttonEl = this.datePickerButton?.nativeElement;
      const contentEl = this.datePickerContent?.nativeElement;

      if (buttonEl && contentEl) {
        // Only close if both dates are selected or if click is outside both elements
        if (!buttonEl.contains(target) && !contentEl.contains(target) && this.dateRange.length === 2) {
          this.closeDatePicker();
        }
      }
    }

    if (!target) {
      return;
    }

    const isInsideOverlay = target.closest('.p-popover') !== null || target.closest('.p-dialog') !== null || target.closest('.p-multiselect-panel') !== null || target.closest('.p-listbox') !== null;

    if (!isInsideOverlay) {
      this.projectColumnFilterPopover?.hide();
      this.statusFilterPopover?.hide();
      this.merchandiserFilterPopover?.hide();
      this.filialenFilterPopover?.hide();
      this.plannedOnFilterPopover?.hide();
      this.reportToFilterPopover?.hide();
      this.genericFilterPopover?.hide();
      this.op?.hide();
      this.reportColumnsPopover?.hide();
      this.activeFilterPopover = null;
      this.activeSettingsPopover = null;
    }
  }

  myDate: Date | null = null;

  // Add these new properties for nested table columns
  reportCols!: Column[];
  selectedReportColumns!: Column[];

  // Add these properties for sorting
  projectSortField: string = '';
  projectSortOrder: number = 1; // 1 for ascending, -1 for descending
  reportSortField: string = '';
  reportSortOrder: number = 1;

  // Add ordered columns properties
  projectsOrderedColumns: Column[] = [];
  reportsOrderedColumns: Column[] = [];

  // Add these properties to track visible columns
  projectsVisibleColumns: { [key: string]: boolean } = {};
  reportsVisibleColumns: { [key: string]: boolean } = {};

  // Report filters (UI state - synced with project._reportFilters)
  reportStatusFilter: string[] = [];
  reportMerchandiserFilter: string[] = [];
  reportFilialenFilter: string[] = [];
  reportPlannedOnFilter: string[] = [];
  reportToFilter: string[] = [];

  // Generic filter properties
  genericFilterValues: { [field: string]: string[] } = {};
  currentFilterField: string = '';

  // Default report filters applied to new projects
  private defaultReportFilters: ProjectReportFilters = {
    status: [],
    merchandiser: [],
    filialen: [],
    plannedOn: [],
    reportTo: [],
    generic: {},
  };

  // Project column filter properties
  projectColumnFilters: { [key: string]: string[] } = {
    name: [],
    formattedZeitraum: [],
    filialen: [],
    status: [],
  };

  // Cached options for listbox
  currentProjectColumnOptions: { label: string; value: string }[] = [];
  currentStatusOptions: { label: string; value: string; color?: string }[] = [];
  currentMerchandiserOptions: { label: string; value: string }[] = [];
  currentFilialenOptions: { label: string; value: string }[] = [];
  currentPlannedOnOptions: { label: string; value: string }[] = [];
  currentReportToOptions: { label: string; value: string }[] = [];
  currentGenericOptions: { label: string; value: string }[] = [];

  // Track current project filter field for popovers
  currentProjectFilterField: string = '';

  // Mobile column filter modal (centered dialog on small screens)
  showColumnFilterModal = false;

  // Mobile report filter modal (for filters within expanded project rows)
  showReportFilterModal = false;
  currentReportFilterField: string = '';

  @ViewChild('projectColumnFilterPopover') projectColumnFilterPopover: any;
  @ViewChild('statusFilterPopover') statusFilterPopover: any;
  @ViewChild('merchandiserFilterPopover') merchandiserFilterPopover: any;
  @ViewChild('filialenFilterPopover') filialenFilterPopover: any;
  @ViewChild('plannedOnFilterPopover') plannedOnFilterPopover: any;
  @ViewChild('reportToFilterPopover') reportToFilterPopover: any;
  @ViewChild('reportColumnsPopover') reportColumnsPopover: any;
  @ViewChild('op') op: any;

  // ViewChild references for multiselect auto-open on filter popover show
  @ViewChild('projectColumnFilterMultiselect') projectColumnFilterMultiselect: any;
  @ViewChild('statusFilterMultiselect') statusFilterMultiselect: any;
  @ViewChild('merchandiserFilterMultiselect') merchandiserFilterMultiselect: any;
  @ViewChild('filialenFilterMultiselect') filialenFilterMultiselect: any;
  @ViewChild('plannedOnFilterMultiselect') plannedOnFilterMultiselect: any;
  @ViewChild('reportToFilterMultiselect') reportToFilterMultiselect: any;
  @ViewChild('genericFilterMultiselect') genericFilterMultiselect: any;
  @ViewChild('projectSettingsMultiselect') projectSettingsMultiselect: any;
  @ViewChild('reportSettingsMultiselect') reportSettingsMultiselect: any;

  private activeFilterPopover: any = null;
  private activeSettingsPopover: any = null;
  private justCollapsed = false;

  private lastLoadedClientId: number | null = null;

  // Track which report is being edited for plannedOn
  editingPlannedOnReportId: number | null = null;

  // Track loading state for reports per project
  loadingReports: { [projectId: string | number]: boolean } = {};
  downloadingExcel: { [projectId: string | number]: boolean } = {};
  private projectsRequestInFlight = false;
  private projectsLoadSubscription: Subscription | null = null;

  // Track loading state for the whole page
  isLoading: boolean = false;

  private destroy$ = new Subject<void>();

  // Called when pencil_square is clicked
  startEditingPlannedOn(report: Report): void {
    this.editingPlannedOnReportId = report.id ?? null;
  }

  // Called when save icon is clicked
  savePlannedOnEdit(report: Report): void {
    // Optionally, call a service to persist the change here
    this.editingPlannedOnReportId = null;
  }

  // Update onPlannedOnDateChange to only update the value, not close the input
  onPlannedOnDateChange(report: Report, event: any): void {
    const rawValue = (event.target?.value || '').trim();

    if (!rawValue) {
      report.plannedOn = '';
      return;
    }

    const normalized = this.parseDateInputToIso(rawValue);
    // Store normalized ISO-like string when possible; otherwise keep raw input
    report.plannedOn = normalized ?? rawValue;
    // Do not close the input here
  }

  /**
   * Normalize user date input (dd.MM.yyyy or yyyy-MM-dd) to ISO-like yyyy-MM-dd for storage.
   */
  private parseDateInputToIso(input: string): string | null {
    // Accept dd.MM.yyyy
    const euMatch = input.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if (euMatch) {
      const [, dd, mm, yyyy] = euMatch;
      const date = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
      if (!isNaN(date.getTime())) {
        const day = dd;
        const month = mm;
        return `${yyyy}-${month}-${day}`;
      }
    }

    // Accept native date input format yyyy-MM-dd
    const isoMatch = input.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
      const [, yyyy, mm, dd] = isoMatch;
      const date = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
      if (!isNaN(date.getTime())) {
        return `${yyyy}-${mm}-${dd}`;
      }
    }

    return null;
  }

  getProjectUrl(project: Project): string {
    if (!project?.id || !this.client?.id) {
      return '';
    }
    return this.router.serializeUrl(this.router.createUrlTree(['/clients', this.client.id, 'projects', project.id]));
  }

  goBack(): void {
    this.location.back();
  }

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private clientService: ClientService,
    private projectService: ProjectService,
    private reportService: ReportService,
    private clientCompanyService: ClientCompanyService,
    private clientDetailStateService: ClientDetailStateService,
    private notificationsService: NotificationsService,
    private toast: HotToastService,
    private location: Location,
  ) {
    // Subscribe to router events to save/restore state
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationStart || event instanceof NavigationEnd),
        takeUntil(this.destroy$),
      )
      .subscribe((event) => {
        if (event instanceof NavigationStart) {
          // Save state before navigation (only if we have a client loaded)
          if (this.client?.id && this.projects && this.projects.length > 0) {
            this.saveState();
          }
        } else if (event instanceof NavigationEnd) {
          const url = event.urlAfterRedirects;
          const clientDetailMatch = url.match(/\/clients\/([^\/]+)/);
          if (clientDetailMatch) {
            const clientId = clientDetailMatch[1];
            setTimeout(() => {
              if (this.client?.id && (this.client.id.toString() === clientId || this.client.id === parseInt(clientId, 10))) {
                this.restoreState();
                const routeProjectSlug = this.route.snapshot.paramMap.get('projectSlug') || this.route.snapshot.paramMap.get('projectId');
                if (routeProjectSlug) {
                  this.applyRouteProjectSelection(routeProjectSlug);
                }
              }
            }, 200);
          }
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadProjectsForClient(clientId: number, projectSlug: string | null, options: { showLoader: boolean; force?: boolean } = { showLoader: true }): void {
    // Check if we already have data for this client to prevent unnecessary reloads
    if (clientId === this.lastLoadedClientId && !options.force && this.projects && this.projects.length > 0) {
      if (options.showLoader) {
        this.isLoading = false;
      }

      this.handleProjectSelection(projectSlug);

      // If we are on the client root (no projectSlug)
      if (!projectSlug) {
        // If we just collapsed, ensure everything stays collapsed
        if (this.justCollapsed) {
          this.justCollapsed = false;
          this.selectedProject = null;
          this.expandedRows = {};
          return;
        }

        // Implicit: We are navigating to client root NOT via collapse (e.g. Sidebar click on same client)
        // Reset state and Auto-Expand first project
        this.selectedProject = null;
        this.expandedRows = {};

        if (!this.isMobileColumnFilter() && this.filteredProjects.length > 0) {
          const firstProject = this.filteredProjects[0];
          if (firstProject && firstProject.id) {
            this.selectProject(firstProject);
          }
        }
      }
      return;
    }

    this.lastLoadedClientId = clientId;

    // Check if there is an existing request and cancel it if force is true or if we are switching clients
    if (this.projectsRequestInFlight) {
      if (options.force) {
        if (this.projectsLoadSubscription) {
          this.projectsLoadSubscription.unsubscribe();
          this.projectsLoadSubscription = null;
        }
        this.projectsRequestInFlight = false;
      } else {
        return;
      }
    }

    this.projectsRequestInFlight = true;
    if (options.showLoader) {
      this.isLoading = true;
    }

    this.projectsLoadSubscription = this.clientCompanyService
      .getProjectsByClientCompany(clientId)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.projectsRequestInFlight = false;
        }),
      )
      .subscribe({
        next: (response) => {
          // Double check if we are still on the same client (though unsubscribe properly handles this)
          if (this.lastLoadedClientId !== clientId) return;

          this.projects = (response.projects || []).map((project) => {
            const computedZeitraum = this.getProjectZeitraum(project);
            const updatedProject = computedZeitraum && !project.zeitraum ? { ...project, zeitraum: computedZeitraum } : project;

            // Ensure calendarWeek has "KW " prefix if it exists
            if (updatedProject.calendarWeek && !updatedProject.calendarWeek.startsWith('KW ')) {
              updatedProject.calendarWeek = `KW ${updatedProject.calendarWeek}`;
            } else if (!updatedProject.calendarWeek && updatedProject.startDate) {
              // Calculate calendar week if not provided
              const startDate = new Date(updatedProject.startDate);
              if (!isNaN(startDate.getTime())) {
                const weekNumber = this.getWeekNumber(startDate);
                updatedProject.calendarWeek = `KW ${weekNumber}`;
              }
            }

            return updatedProject;
          });
          this.filteredProjects = [...this.projects];
          this.client = response.clientCompany;

          // Save to store
          this.clientDetailStateService.setClientDetailData(this.projects, this.client);

          // Restore filter state after projects and client are loaded (before applying filters)
          const stateRestored = this.client?.id ? this.restoreState() : false;

          // Update derived data for all projects after restoring state
          this.projects.forEach((project) => {
            if (project.reports && project.reports.length > 0) {
              this.updateProjectDerivedData(project);
            }
          });

          // Auto-expand projects only when no explicit project is requested via route/sidebar.
          if (this.statusFilter && !projectSlug) {
            if (this.selectedProject && this.selectedProject.id) {
              // If a specific project is selected, only expand that one
              this.setSingleExpandedRow(this.selectedProject.id);
              if (this.selectedProject.reports === undefined || this.selectedProject.reports === null) {
                this.loadProjectReports(this.selectedProject);
              }
            } else {
              // No specific project selected - expand FIRST filtered project with matching reports
              // Apply filters first to get the filtered list
              if (!stateRestored) {
                this.applyFilters();
              }
              if (!this.isMobileColumnFilter()) {
                this.expandFirstFilteredProjectWithReports();
              }
            }
          }

          // Apply filters (includes status) and handle project selection
          // Only call applyFilters if state wasn't restored (restoreState already calls it)
          if (!stateRestored && !this.statusFilter) {
            this.applyFilters();
          }

          // Force expand removed to allow closing projects

          this.handleProjectSelection(projectSlug);
          this.syncSidebarProjects();

          // Auto-expand first project logic (Default behavior for new client load)
          // Skipped if we just collapsed manually
          if (this.justCollapsed) {
            this.justCollapsed = false;
          } else {
            const hasExpandedProjects = Object.keys(this.expandedRows).length > 0;
            if (!this.isMobileColumnFilter() && !projectSlug && !this.selectedProject && !hasExpandedProjects && this.filteredProjects.length > 0) {
              const firstProject = this.filteredProjects[0];
              if (firstProject && firstProject.id) {
                this.selectProject(firstProject);
              }
            }
          }

          if (options.showLoader) {
            this.isLoading = false;
          }
        },
        error: (err) => {
          console.error('Error fetching projects for client company:', err);
          if (options.showLoader) {
            this.isLoading = false;
          }

          if (err.status === 403) {
            this.toast.error('Sie haben keine Berechtigung, auf diesen Kunden zuzugreifen.', {
              position: 'bottom-right',
              duration: 3000,
            });
            this.router.navigate(['/dashboard']);
          } else {
            this.toast.error('Fehler beim Laden der Projekte.', {
              position: 'bottom-right',
              duration: 3000,
            });
          }

          this.projects = [];
          this.filteredProjects = [];
          this.selectedProject = null;
          this.client = undefined;
        },
      });
  }

  /** Apply route/sidebar project selection: single expanded row + sidebar highlight. */
  private applyRouteProjectSelection(projectSlug: string | null): void {
    if (!projectSlug) {
      this.selectedProject = null;
      this.setSingleExpandedRow(null);
      this.syncSidebarProjects();
      return;
    }

    if (!this.projects?.length) {
      return;
    }

    const matchedProject = this.filteredProjects?.find((p) => p.id == projectSlug || p.slug == projectSlug) ?? this.projects?.find((p) => p.id == projectSlug || p.slug == projectSlug);

    if (!matchedProject) {
      this.selectedProject = null;
      this.setSingleExpandedRow(null);
      this.syncSidebarProjects();
      return;
    }

    this.selectedProject = matchedProject;
    this.setSingleExpandedRow(matchedProject.id);
    this.syncSidebarProjects();
    this.autoOpenMobileReportsSidebar(matchedProject);

    if (matchedProject.reports === undefined || matchedProject.reports === null) {
      this.loadProjectReports(matchedProject);
    }

    this.saveState();
  }

  private handleProjectSelection(projectSlug: string | null): void {
    this.applyRouteProjectSelection(projectSlug);
  }

  private handleProjectSelectionFromCache(projectSlug: string | null): void {
    this.applyRouteProjectSelection(projectSlug);
  }

  private syncSidebarProjects(): void {
    if (!this.client?.id) {
      return;
    }

    const clientId = this.client.id.toString();
    const sourceProjects = (this.filteredProjects && this.filteredProjects.length > 0 ? this.filteredProjects : this.projects) || [];

    const sidebarProjects = sourceProjects
      .filter((project) => project?.id)
      .map((project) => ({
        id: project.id?.toString() ?? '',
        name: project.name ?? '',
        slug: project.slug ?? '',
        clientId: clientId,
      }));

    this.clientService.setClientProjects(clientId, sidebarProjects);
    this.clientService.setSelectedProject(clientId, this.selectedProject?.id ? this.selectedProject.id.toString() : null);
  }

  private setSingleExpandedRow(projectId?: string | number | null): void {
    this.expandedRows = {};
    if (projectId === null || projectId === undefined) {
      return;
    }
    const key = String(projectId);
    if (!key) {
      return;
    }
    this.expandedRows[key] = true;
  }

  getExpandedProjectName(): string {
    if (this.selectedProject?.name) {
      return this.selectedProject.name.toString().trim();
    }

    const expandedProjectId = this.sidebarVisibleProjectId?.toString() || Object.keys(this.expandedRows || {}).find((id) => this.expandedRows?.[id]);

    if (!expandedProjectId) {
      return '';
    }

    const expandedProject = this.filteredProjects?.find((project) => project.id?.toString() === expandedProjectId) || this.projects?.find((project) => project.id?.toString() === expandedProjectId);

    return expandedProject?.name?.toString().trim() || '';
  }

  getProjectsPageTitle(): string {
    const projectName = this.getExpandedProjectName();
    return projectName ? `Projekte / ${projectName}` : 'Projekte';
  }

  private getNormalizedExpandedRows(rows: { [key: string]: boolean } | null | undefined): { [key: string]: boolean } {
    if (!rows) {
      return {};
    }

    const activeKeys = Object.keys(rows).filter((key) => !!rows[key]);
    if (activeKeys.length === 0) {
      return {};
    }

    const preferredKey = this.selectedProject?.id !== undefined && this.selectedProject?.id !== null ? String(this.selectedProject.id) : this.sidebarVisibleProjectId || activeKeys[0];

    return { [preferredKey]: true };
  }

  /**
   * Expand the first filtered project that has matching reports and load all project reports.
   * Used when a status filter is present in query params without a specific project selected.
   * Only expands the FIRST project with matching reports (HeadOffice pattern).
   */
  private expandFirstFilteredProjectWithReports(): void {
    this.expandedRows = {};
    let firstExpandedSet = false;

    this.filteredProjects.forEach((project) => {
      if (project.id) {
        // Load reports if not already loaded
        if (project.reports === undefined || project.reports === null) {
          this.loadProjectReportsWithExpansion(project, firstExpandedSet, (wasExpanded) => {
            if (wasExpanded) {
              firstExpandedSet = true;
            }
          });
        } else {
          // Reports already loaded - check if should expand
          this.updateProjectDerivedData(project);
          if (project._filteredReports && project._filteredReports.length > 0 && !firstExpandedSet) {
            this.setSingleExpandedRow(project.id);
            firstExpandedSet = true;
          }
        }
      }
    });
  }

  /**
   * Load project reports and optionally expand if it's the first project with matching reports.
   */
  private loadProjectReportsWithExpansion(project: Project, alreadyExpanded: boolean, onExpanded: (expanded: boolean) => void): void {
    const projectIdKey = project.id.toString();
    this.loadingReports[projectIdKey] = true;
    if (typeof project.id === 'number') {
      this.loadingReports[project.id] = true;
    }

    this.reportService
      .getReportsByProject(project.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (reports) => {
          project.reports = reports;
          this.loadingReports[projectIdKey] = false;
          if (typeof project.id === 'number') {
            this.loadingReports[project.id] = false;
          }

          // Update derived data (filtered reports) for the project
          this.updateProjectDerivedData(project);

          // Re-apply filters when status filter is active
          if (this.statusFilter) {
            this.applyFilters();
          }

          // Expand this project if it has matching reports and no project has been expanded yet
          if (project._filteredReports && project._filteredReports.length > 0 && !alreadyExpanded) {
            this.setSingleExpandedRow(project.id);
            onExpanded(true);
          } else {
            onExpanded(false);
          }

          // Update projects in store
          this.clientDetailStateService.setClientDetailData(this.projects, this.client);
        },
        error: (err) => {
          console.error('Error fetching reports for project:', err);
          project.reports = [];
          this.updateProjectDerivedData(project);
          this.loadingReports[projectIdKey] = false;
          if (typeof project.id === 'number') {
            this.loadingReports[project.id] = false;
          }
          onExpanded(false);
        },
      });
  }

  private loadProjectReports(project: Project, options: { forceRefresh?: boolean } = {}): void {
    const projectIdKey = project.id.toString();

    // If not forcing refresh and reports are already loaded, just update derived data
    if (!options.forceRefresh && project.reports !== undefined && project.reports !== null) {
      this.updateProjectDerivedData(project);
      return;
    }

    this.loadingReports[projectIdKey] = true;
    if (typeof project.id === 'number') {
      this.loadingReports[project.id] = true;
    }

    this.reportService
      .getReportsByProject(project.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (reports) => {
          project.reports = reports;
          this.loadingReports[projectIdKey] = false;
          if (typeof project.id === 'number') {
            this.loadingReports[project.id] = false;
          }

          // Update projects in store with the new reports
          this.clientDetailStateService.setClientDetailData(this.projects, this.client);

          // Update derived data (filtered reports) for the project
          this.updateProjectDerivedData(project);

          // Re-apply filters when status filter is active so empty projects drop out
          if (this.statusFilter) {
            this.applyFilters();
          }

          if (this.sidebarVisibleProjectId === projectIdKey) {
            this.restoreMobileReportsSidebarScrollPosition(projectIdKey);
          }
        },
        error: (err) => {
          console.error('Error fetching reports for project:', err);
          project.reports = [];
          this.updateProjectDerivedData(project);
          this.loadingReports[projectIdKey] = false;
          if (typeof project.id === 'number') {
            this.loadingReports[project.id] = false;
          }
        },
      });
  }

  ngOnInit(): void {
    // Initialize filters
    this.reportStatusFilter = [];
    this.reportMerchandiserFilter = [];
    this.reportFilialenFilter = [];
    this.reportPlannedOnFilter = [];
    this.reportToFilter = [];

    this.route.paramMap.subscribe((params) => {
      // Always prioritize query param for status filter
      const statusFromQuery = this.route.snapshot.queryParamMap.get('status');
      this.referrer = this.route.snapshot.queryParamMap.get('referrer');

      if (this.referrer === 'notifications') {
        const notificationId = this.route.snapshot.queryParamMap.get('notificationId');
        if (notificationId) {
          this.notificationsService.markSeen(parseInt(notificationId, 10)).subscribe({
            error: (err) => console.error('Error marking notification as seen:', err),
          });
        }
      }

      // Support both projectSlug and projectId, and always extract clientId
      const clientId = params.get('clientId');
      const projectSlug = params.get('projectSlug') || params.get('projectId');
      console.log('Route params:', params.keys, 'clientId:', clientId, 'projectSlug:', projectSlug);

      const clientIdNum = Number(clientId);
      const cachedFilterState = clientIdNum ? this.clientDetailStateService.getFilterState(clientIdNum) : null;
      const hasCachedOpenSidebar = !!cachedFilterState?.sidebarVisibleProjectId;

      // Reset navigation UI state on route change, except when we can restore
      // an already-open reports sidebar from cached state.
      const restoreCachedSidebar = clientIdNum && clientIdNum !== this.lastLoadedClientId && hasCachedOpenSidebar && this.isMobileReportsSidebarView();
      if (!restoreCachedSidebar) {
        this.expandedRows = {};
        this.sidebarVisibleProjectId = null;
      } else {
        this.expandedRows = this.getNormalizedExpandedRows(cachedFilterState?.expandedRows);
        this.sidebarVisibleProjectId = cachedFilterState?.sidebarVisibleProjectId || null;
      }

      if (clientIdNum) {
        if (clientIdNum !== this.lastLoadedClientId) {
          // Clear previous data to prevent stale display
          this.projects = [];
          this.filteredProjects = [];
          this.client = undefined;
          this.justCollapsed = false;

          // Try to restore from cache first.
          // Fallback to saved filter-state snapshot (contains projects/client too)
          // so back-navigation from report detail stays instant on mobile.
          const cachedData = this.clientDetailStateService.getClientDetailDataSnapshot(clientIdNum);
          const stateProjects = Array.isArray(cachedFilterState?.projects) ? (cachedFilterState?.projects as Project[]) : [];
          const stateClient = (cachedFilterState?.client as any) || null;
          const hasAnyCachedProjects = (cachedData?.projects?.length || 0) > 0 || stateProjects.length > 0;

          if (hasAnyCachedProjects) {
            console.log('✅ Restoring client detail data from cache (no loader)');
            this.projects = ((cachedData?.projects && cachedData.projects.length > 0 ? cachedData.projects : stateProjects) || []) as Project[];
            this.filteredProjects = [...this.projects];
            this.client = ((cachedData?.client as any) || stateClient || this.client) as any;
            this.isLoading = false;

            // Handle project selection from cache
            this.handleProjectSelectionFromCache(projectSlug);

            // Always refresh in background without showing loader
            this.loadProjectsForClient(clientIdNum, projectSlug, { showLoader: false });

            // Set status filter from query param if present, ignore cache for status
            // const cachedFilterState = this.clientDetailStateService.getFilterState(clientIdNum);
            this.statusFilter = statusFromQuery !== null ? statusFromQuery : '';
            this.applyFilters();

            // Auto-expand first project when status filter is present and no specific project selected
            if (this.statusFilter && !projectSlug && !this.isMobileColumnFilter()) {
              this.expandFirstFilteredProjectWithReports();
            }
          } else {
            // No cache, load from server with loader
            console.log('🔄 No cache found, loading client detail from server');
            // Set status filter from query param if present
            this.statusFilter = statusFromQuery !== null ? statusFromQuery : '';
            this.loadProjectsForClient(clientIdNum, projectSlug, { showLoader: true });
            this.applyFilters();
          }
        } else {
          this.applyRouteProjectSelection(projectSlug);
          this.statusFilter = statusFromQuery !== null ? statusFromQuery : this.statusFilter || '';
          this.applyFilters();
        }
      } else {
        this.isLoading = false;
        this.client = undefined;
        this.projects = [];
        this.filteredProjects = [];
        this.selectedProject = null;
        this.statusFilter = statusFromQuery !== null ? statusFromQuery : '';
        this.applyFilters();
        this.syncSidebarProjects();
      }
    });

    // Initialize project columns
    this.cols = [
      { field: 'formattedZeitraum', header: 'Zeitraum' },
      { field: 'filialen', header: 'Filialen' },
      { field: 'status', header: 'Status' },
    ];
    this.selectedColumns = [...this.cols];

    // Initialize report columns
    this.reportCols = [
      { field: 'plannedOn', header: 'Geplant' },
      { field: 'branch.name', header: 'Filiale' },
      { field: 'address', header: 'Adresse' },
      { field: 'note', header: 'Notiz' },
      { field: 'reportTo', header: 'Report bis' },
      { field: 'feedback', header: 'Feedback' },
    ];
    // Initialize selectedReportColumns with only visible columns (excluding   feedback)
    this.selectedReportColumns = this.reportCols.filter((col) => col.field !== 'feedback');

    // Initialize ordered columns
    this.projectsOrderedColumns = [...this.cols];
    this.reportsOrderedColumns = [...this.reportCols];

    // Set all columns to visible by default
    this.initializeVisibleColumns();

    // Keep original selections for backward compatibility
    this.selectedColumns = [...this.cols];
  }

  // Navigate to project detail
  private navigateToProject(project: any): void {
    this.router.navigate(['/clients', this.client.id, 'projects', project.id]);
  }

  private navigateBackToClient(): void {
    this.router.navigate(['/clients', this.client.id]);
  }

  // Modify the column selector click handler to navigate if project is provided
  handleColumnHeaderClick(event: Event, project?: Project): void {
    if (project) {
      event.preventDefault();
      event.stopPropagation();
      this.navigateToProject(project);
    } else {
      // This is for the column selector in the header
      // Keep the existing op.toggle behavior
    }
  }

  // Toggle project expansion
  toggleProject(project: Project) {
    if (this.selectedProject?.id != null && project?.id != null && this.selectedProject.id.toString() === project.id.toString()) {
      this.collapseProject();
    } else {
      this.selectProject(project);
    }
  }

  // Enhance selectProject method to also expand the row
  selectProject(project: Project) {
    this.selectedProject = project;

    // Sync UI filters from project (load project's filters into UI)
    this.syncUiFiltersFromProject(project);

    if (project && project.id) {
      this.setSingleExpandedRow(project.id);

      // Always fetch reports to ensure fresh data (force refresh)
      const projectIdKey = project.id.toString();
      this.loadingReports[projectIdKey] = true;
      // Also set with original key if it's a number
      if (typeof project.id === 'number') {
        this.loadingReports[project.id] = true;
      }
      this.loadProjectReports(project, { forceRefresh: true });
    }

    // Navigate to the project route
    this.syncSidebarProjects();

    if (this.statusFilter) {
      this.router.navigate(['/clients', this.client.id, 'projects', project.id], { queryParams: { status: this.statusFilter } });
    } else {
      this.router.navigate(['/clients', this.client.id, 'projects', project.id]);
    }
  }

  getSeverity(status: string) {
    switch (status) {
      case 'ACTIVE':
        return 'success';
      case 'PLANNED':
        return 'info';
      case 'DRAFT':
        return 'warning';
      case 'COMPLETED':
        return 'success';
      case 'PENDING':
        return 'warning';
      default:
        return 'info';
    }
  }

  getStatusSeverity(status: string) {
    switch (status) {
      case 'PENDING':
        return 'warn';
      case 'DELIVERED':
        return 'success';
      case 'CANCELLED':
        return 'danger';
      default:
        return 'unknown';
    }
  }

  isPendingAnfrage(report: Report): boolean {
    return isPendingMerchandiserAcceptance(report);
  }

  onRowExpand(event: TableRowExpandEvent) {
    const project = event.data as Project;
    console.log({ severity: 'info', summary: 'Project Expanded', detail: project.name, life: 3000 });

    if (project?.id) {
      this.setSingleExpandedRow(project.id);
    }

    this.selectedProject = project;
    this.syncSidebarProjects();
    this.closeReportsSidebarOnDesktop();
    // Sync UI filters from project (load project's filters into UI)
    this.syncUiFiltersFromProject(project);

    // Always fetch reports to ensure fresh data (force refresh)
    if (project && project.id) {
      const projectIdKey = project.id.toString();
      this.loadingReports[projectIdKey] = true;
      // Also set with original key if it's a number
      if (typeof project.id === 'number') {
        this.loadingReports[project.id] = true;
      }
      this.loadProjectReports(project, { forceRefresh: true });
    }

    this.saveState();
  }

  // Method to collapse the currently expanded project
  collapseProject(project?: Project): void {
    if (project?.id) {
      const rowKey = String(project.id);
      if (this.expandedRows[rowKey]) {
        this.setSingleExpandedRow(null);
      }

      // If the collapsed project was the selected one, clear selection
      if (this.selectedProject?.id != null && this.selectedProject.id.toString() === project.id.toString()) {
        this.selectedProject = null;
        this.syncSidebarProjects();

        // If route points to a specific project, navigate back to client
        const projectRouteId = this.route.snapshot.paramMap.get('projectId') || this.route.snapshot.paramMap.get('projectSlug');

        if (this.client?.id && projectRouteId) {
          const queryParams: any = {};
          if (this.statusFilter) {
            queryParams.status = this.statusFilter;
          }
          this.justCollapsed = true;
          this.router.navigate(['/clients', this.client.id], { queryParams });
        }
      }
      this.saveState();
    } else {
      this.setSingleExpandedRow(null);
      this.selectedProject = null;
      this.syncSidebarProjects();

      // Navigate back to the client detail route (without project)
      if (this.client) {
        const queryParams: any = {};
        if (this.statusFilter) {
          queryParams.status = this.statusFilter;
        }
        this.justCollapsed = true;
        this.router.navigate(['/clients', this.client.id], { queryParams });
      }
      this.saveState();
    }
  }

  // Modify the existing onRowCollapse method to also update the route
  onRowCollapse(event: TableRowCollapseEvent) {
    console.log({ severity: 'success', summary: 'Project Collapsed', detail: event.data.name, life: 3000 });

    // Pass the project object to collapseProject
    this.collapseProject(event.data as Project);
  }

  toggleDatePicker(): void {
    this.isDatePickerOpen = !this.isDatePickerOpen;
  }

  closeDatePicker(): void {
    this.isDatePickerOpen = false;
  }

  onDateRangeSelect(event: any): void {
    if (this.dateRange.length === 2) {
      // Both dates are selected, close the popover after a short delay
      setTimeout(() => this.closeDatePicker(), 200);
    }
  }

  onDateSelected(date: Date): void {
    console.log('Selected date:', date);
    this.myDate = date;
  }

  onFavoriteChanged(newStatus: boolean, project: Project): void {
    console.log('🔄 Toggling project favorite status:', { id: project.id, newStatus });

    // Optimistically update the UI
    const previousStatus = project.isFavorite;
    project.isFavorite = newStatus;

    // Call backend to toggle favorite status
    this.projectService
      .toggleFavoriteStatus(project.id!)
      .pipe(
        catchError((error) => {
          console.error('❌ Error toggling project favorite status:', error);

          // Revert the optimistic update on error
          project.isFavorite = previousStatus;

          this.toast.error('Fehler beim Aktualisieren des Favoritenstatus', {
            position: 'bottom-right',
            duration: 3000,
          });

          return of(null);
        }),
      )
      .subscribe({
        next: (result) => {
          if (result) {
            console.log('✅ Project favorite status updated:', result);

            // Update the status based on server response
            project.isFavorite = result.isFavorite;

            if (project.isFavorite) {
              this.toast.success(`Projekt "${project.name}" zu Favoriten hinzugefügt`, {
                position: 'bottom-right',
                duration: 3000,
              });
            } else {
              this.toast.success(`Projekt "${project.name}" von Favoriten entfernt`, {
                position: 'bottom-right',
                duration: 3000,
              });
            }
          }
        },
      });
  }

  /**
   * Calculate the percentage of reported orders for a project
   */
  getReportedPercentage(project: Project): number {
    // Use backend-calculated value if available, otherwise fallback to 0
    return project.reportedPercentage ?? 0;
  }

  // Add this method to handle favorite changes for reports
  onReportFavoriteChanged(newStatus: boolean, report: Report): void {
    const previousStatus = report.isFavorite;
    report.isFavorite = newStatus;

    this.reportService.toggleFavoriteStatus(report.id!).subscribe({
      next: (result) => {
        if (result) {
          report.isFavorite = result.isFavorite;
          if (report.isFavorite) {
            this.toast.success(`Auftrag zu Favoriten hinzugefügt`, {
              position: 'bottom-right',
              duration: 3000,
            });
          } else {
            this.toast.success(`Auftrag von Favoriten entfernt`, {
              position: 'bottom-right',
              duration: 3000,
            });
          }
        }
      },
      error: (error) => {
        report.isFavorite = previousStatus; // revert on error
        this.toast.error('Fehler beim Aktualisieren des Favoritenstatus', {
          position: 'bottom-right',
          duration: 3000,
        });
      },
    });
  }

  // Initialize visible columns
  initializeVisibleColumns() {
    // Set all project columns to visible by default
    this.cols.forEach((col) => {
      this.projectsVisibleColumns[col.field] = true;
    });

    // Set report columns - hide feedback by default
    this.reportCols.forEach((col) => {
      if (col.field === 'feedback') {
        this.reportsVisibleColumns[col.field] = false; // Hidden by default
      } else {
        this.reportsVisibleColumns[col.field] = true;
      }
    });
  }

  // Get visible columns for projects table
  getProjectsVisibleColumns(): Column[] {
    // Return ordered columns that are visible
    return this.projectsOrderedColumns.filter((col) => this.projectsVisibleColumns[col.field]);
  }

  // Get visible columns for reports table
  getReportsVisibleColumns(): Column[] {
    // Return ordered columns that are visible
    return this.reportsOrderedColumns.filter((col) => this.reportsVisibleColumns[col.field]);
  }

  getReportsTableStyle(): Record<string, string> {
    const visibleCount = this.getReportsVisibleColumns()?.length ?? 0;
    const columnCount = 2 + visibleCount;
    const minWidthRem = Math.max(48, columnCount * 12);
    return {
      width: '100%',
      'min-width': `${minWidthRem}rem`,
      'table-layout': 'auto',
    };
  }

  // Handle column reordering for projects table
  onProjectsColReorder(event: any) {
    this.saveState();
    if (event && typeof event.dragIndex === 'number' && typeof event.dropIndex === 'number') {
      // Get the column that was moved
      const movedColumn = this.projectsOrderedColumns[event.dragIndex];

      // Create a new array without the moved column
      const newOrderedColumns = [...this.projectsOrderedColumns];
      newOrderedColumns.splice(event.dragIndex, 1);

      // Insert the moved column at the drop index
      newOrderedColumns.splice(event.dropIndex, 0, movedColumn);

      // Update the ordered columns with the new order
      this.projectsOrderedColumns = newOrderedColumns;
    }
  }

  // Handle column reordering for reports table
  onReportsColReorder(event: any) {
    this.saveState();
    if (event && typeof event.dragIndex === 'number' && typeof event.dropIndex === 'number') {
      // Get the column that was moved
      const movedColumn = this.reportsOrderedColumns[event.dragIndex];

      // Create a new array without the moved column
      const newOrderedColumns = [...this.reportsOrderedColumns];
      newOrderedColumns.splice(event.dragIndex, 1);

      // Insert the moved column at the drop index
      newOrderedColumns.splice(event.dropIndex, 0, movedColumn);

      // Update the ordered columns with the new order
      this.reportsOrderedColumns = newOrderedColumns;
    }
  }

  // Update visible columns for projects
  onProjectsColumnsChange(selectedColumns: Column[]) {
    // Reset all to false
    Object.keys(this.projectsVisibleColumns).forEach((key) => {
      this.projectsVisibleColumns[key] = false;
    });

    // Set selected columns to true
    selectedColumns.forEach((col) => {
      this.projectsVisibleColumns[col.field] = true;
    });

    // Update the selectedColumns for backward compatibility
    this.selectedColumns = selectedColumns;
    this.saveState();
  }

  // Update visible columns for reports
  onReportsColumnsChange(selectedColumns: Column[]) {
    // Reset all to false
    Object.keys(this.reportsVisibleColumns).forEach((key) => {
      this.reportsVisibleColumns[key] = false;
    });

    // Set selected columns to true
    selectedColumns.forEach((col) => {
      this.reportsVisibleColumns[col.field] = true;
    });

    // Update the selectedReportColumns for backward compatibility
    this.selectedReportColumns = selectedColumns;
    this.saveState();
  }

  // Add filter methods
  onProjectSearch(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.projectSearchTerm = target.value.toLowerCase();
    this.applyFilters();
    this.saveState();
  }

  onFilialeSearch(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.filialeSearchTerm = target.value.toLowerCase();
    this.applyFilters();
    this.saveState();
  }

  getFilteredProjectsData(excludeField?: string): Project[] {
    return this.projects.filter((project) => {
      // Project search - search in project name
      const matchesProject = !this.projectSearchTerm || (project.name && project.name.toLowerCase().includes(this.projectSearchTerm));

      // Status filter from query params – only keep projects that have at least one matching report
      const matchesStatus = !this.statusFilter || this.projectMatchesStatusFilter(project);

      // Filiale search - search in reports' filiale field
      const matchesFiliale = !this.filialeSearchTerm || (project.reports && project.reports.some((report) => report.branch?.name && report.branch.name.toLowerCase().includes(this.filialeSearchTerm)));

      // Column filter: name (Projekt)
      if (excludeField !== 'name' && this.projectColumnFilters['name'].length > 0) {
        const wanted = this.projectColumnFilters['name'].map((v) => this.normalizeColumnFilterValue(v));
        const nameNorm = this.normalizeColumnFilterValue(project.name || '');
        if (!wanted.includes(nameNorm)) {
          return false;
        }
      }

      // Column filter: formattedZeitraum (Zeitraum)
      const zeitraumValue = this.normalizeColumnFilterValue(this.getProjectZeitraum(project));
      if (excludeField !== 'formattedZeitraum' && this.projectColumnFilters['formattedZeitraum'].length > 0) {
        const wanted = this.projectColumnFilters['formattedZeitraum'].map((v) => this.normalizeColumnFilterValue(v));
        if (!wanted.includes(zeitraumValue)) {
          return false;
        }
      }

      // Column filter: filialen (Filialen)
      if (excludeField !== 'filialen' && this.projectColumnFilters['filialen'].length > 0) {
        // IMPORTANT: use the same derived count as the table ("9 Stores" etc.)
        // so the list of filter options matches what the user sees in the row.
        const filialenValue = this.normalizeColumnFilterValue(`${this.getDisplayedFilialen(project)} Stores`);
        const wanted = this.projectColumnFilters['filialen'].map((v) => this.normalizeColumnFilterValue(v));
        if (!wanted.includes(filialenValue)) {
          return false;
        }
      }

      // Column filter: status (Status)
      const statusValue = this.normalizeColumnFilterValue(`${project.reportedPercentage ?? 0}% reported`);
      if (excludeField !== 'status' && this.projectColumnFilters['status'].length > 0) {
        const wanted = this.projectColumnFilters['status'].map((v) => this.normalizeColumnFilterValue(v));
        if (!wanted.includes(statusValue)) {
          return false;
        }
      }

      // Filter by the project's [startDate, endDate]
      if (!this.isProjectInDateRange(project)) {
        return false;
      }

      return matchesProject && matchesFiliale && matchesStatus;
    });
  }

  /**
   * Normalize a Date or ISO string to YYYY-MM-DD for stable comparisons (local calendar date).
   */
  private normalizeDateToYmd(d: Date | string | undefined | null): string {
    if (d === undefined || d === null) return '';
    const dateObj = typeof d === 'string' ? new Date(d) : d;
    if (isNaN(dateObj.getTime())) return '';
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  /**
   * True when the selected range overlaps the project's [startDate, endDate] (project Zeitraum).
   * Does not use report plannedOn (Geplant).
   */
  private isProjectInDateRange(project: Project): boolean {
    if (!this.dateRange2.start || !this.dateRange2.end) {
      return true;
    }
    const filterStart = this.normalizeDateToYmd(this.dateRange2.start);
    const filterEnd = this.normalizeDateToYmd(this.dateRange2.end);
    if (!filterStart || !filterEnd) {
      return true;
    }

    let projStart = project.startDate ? this.normalizeDateToYmd(project.startDate) : '';
    let projEnd = project.endDate ? this.normalizeDateToYmd(project.endDate) : '';

    if (!projStart && !projEnd) {
      return false;
    }
    if (!projStart) {
      projStart = projEnd;
    }
    if (!projEnd) {
      projEnd = projStart;
    }
    if (projStart > projEnd) {
      const t = projStart;
      projStart = projEnd;
      projEnd = t;
    }

    return projEnd >= filterStart && projStart <= filterEnd;
  }

  private projectMatchesStatusFilter(project: Project): boolean {
    if (!this.statusFilter) {
      return true; // no status filter applied
    }

    // If reports not loaded yet, keep project; filtering will occur once reports arrive
    if (project.reports === undefined || project.reports === null) {
      return true;
    }

    // If reports are loaded but empty, exclude the project
    if (Array.isArray(project.reports) && project.reports.length === 0) {
      return false;
    }

    // Keep only if at least one report matches the status
    return project.reports.some((report) => this.reportMatchesStatus(report, this.statusFilter));
  }

  applyFilters(): void {
    if (this.projects && Array.isArray(this.projects)) {
      this.projects.forEach((project) => {
        if (project.reports) {
          project._filteredReports = undefined;
          project._displayedFilialen = undefined;
          this.updateProjectDerivedData(project);
        }
      });
    }

    this.filteredProjects = this.getFilteredProjectsData();
    if (this.projectSortField) {
      this.sortProjects(this.projectSortField, this.projectSortOrder);
    }

    this.refreshProjectMobileFilterSheetState();

    // Note: saveState is called explicitly in filter change handlers to avoid excessive saves
  }

  // Clear all filters
  clearFilters(): void {
    this.projectSearchTerm = '';
    this.filialeSearchTerm = '';
    this.dateRange2 = { start: null, end: null };

    // Clear project column filters
    this.projectColumnFilters = {
      name: [],
      formattedZeitraum: [],
      filialen: [],
      status: [],
    };

    // Clear report column filters
    this.reportStatusFilter = [];
    this.reportMerchandiserFilter = [];
    this.reportFilialenFilter = [];
    this.reportPlannedOnFilter = [];
    this.reportToFilter = [];
    this.genericFilterValues = {};

    // Update default report filters to match empty UI
    this.updateDefaultReportFiltersFromUi();

    // Reset filters on all projects and update derived data
    if (this.projects) {
      this.projects.forEach((project) => {
        // Clear stored filters so they fall back to the (now empty) defaults
        project._reportFilters = undefined;
        // Re-calculate derived data (filtered reports counts etc)
        this.updateProjectDerivedData(project);
      });
    }

    // Clear status filter from query params
    if (this.statusFilter) {
      this.statusFilter = '';
      // Navigate without the status query parameter
      const clientId = this.route.snapshot.paramMap.get('id') || this.route.snapshot.paramMap.get('clientId');
      if (clientId) {
        this.router.navigate(['/clients', clientId], { queryParams: {} });
      }
    }

    this.applyFilters();
    this.saveState();
  }

  private loadClient(): void {
    const clientId = this.route.snapshot.paramMap.get('id') || this.route.snapshot.paramMap.get('clientId');
    if (clientId) {
      // this.client is set from the backend response in ngOnInit
    }
  }

  /**
   * Generate address string for a report using street, zipCode, and branch city
   */
  getDisplayedFilialen(project: Project): number {
    // Use cached value if available
    if (project._displayedFilialen !== undefined) {
      return project._displayedFilialen;
    }

    // If reports are not loaded yet, use backend-provided count so it shows before expanding
    if (!project?.reports || project.reports.length === 0) {
      return project.branchesCount ?? project.filialen ?? 0;
    }

    // Otherwise derive the count from the currently displayed reports (table data)
    // This will also update the cached value
    this.updateProjectDerivedData(project);
    return project._displayedFilialen ?? project.branchesCount ?? 0;
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

  /**
   * Get merchandiser name for a report
   */
  getReportMerchandiserName(report: Report): string {
    if (report.merchandiser && report.merchandiser.user) {
      const user = report.merchandiser.user;
      return [user.firstName, user.lastName].filter(Boolean).join(' ');
    }
    return '';
  }

  /**
   * Get branch label for a report (for filtering)
   */
  private getReportBranchLabel(report: Report): string {
    if (!report.branch) return '';
    const branchNumber = report.branch.branchNumber || '';
    const branchName = report.branch.name || '';
    return branchNumber ? `${branchNumber} ${branchName}`.trim() : branchName;
  }

  // Add sorting methods
  onProjectSort(field: string, event?: Event): void {
    // Stop event propagation to prevent column toggle
    if (event) {
      event.stopPropagation();
    }

    if (this.projectSortField === field) {
      // If clicking on the same field, toggle the sort order
      this.projectSortOrder = this.projectSortOrder * -1;
    } else {
      // New sort field, default to ascending
      this.projectSortField = field;
      this.projectSortOrder = 1;
    }

    // Apply sorting
    this.sortProjects(field, this.projectSortOrder);
    this.saveState();
  }

  onReportSort(field: string, project: Project, event?: Event): void {
    // Stop event propagation to prevent column toggle and date picker opening
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }

    if (this.reportSortField === field) {
      // If clicking on the same field, toggle the sort order
      this.reportSortOrder = this.reportSortOrder * -1;
    } else {
      // New sort field, default to ascending
      this.reportSortField = field;
      this.reportSortOrder = 1;
    }

    // Table binds to project._filteredReports (see filteredReports()), not project.reports
    if (project) {
      this.updateProjectDerivedData(project);
    }
    this.saveState();
  }

  private sortProjects(field: string, order: number): void {
    // Sort the filtered projects that are displayed in the table
    this.filteredProjects.sort((a, b) => {
      const valueA = this.getProjectField(a, field);
      const valueB = this.getProjectField(b, field);

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

  private getProjectField(project: Project, field: string): any {
    if (field === 'name') {
      return project.name || '';
    }

    if (field === 'formattedZeitraum') {
      return this.getProjectZeitraum(project);
    }

    if (field === 'filialen') {
      // Return branchesCount for numeric sorting
      return project.branchesCount ?? 0;
    }

    if (field === 'status') {
      return this.getReportedPercentage(project);
    }

    return project[field as keyof Project] || '';
  }

  getProjectZeitraum(project: Project): string {
    if (!project) {
      return '';
    }

    if (project.zeitraum) {
      return project.zeitraum;
    }

    if (project.startDate && project.endDate) {
      const start = new Date(project.startDate);
      const end = new Date(project.endDate);

      const format = (d: Date, includeYear: boolean) => {
        if (isNaN(d.getTime())) return '';
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return includeYear ? `${day}.${month}.${year}` : `${day}.${month}.`;
      };

      const sameYear = start.getFullYear() === end.getFullYear();
      const startStr = format(start, !sameYear);
      const endStr = format(end, true);

      if (startStr && endStr) {
        return `${startStr} - ${endStr}`;
      }
    }

    return '';
  }

  private getWeekNumber(date: Date): number {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  }

  private getReportField(report: Report, field: string): any {
    if (field === 'status') {
      return report.status?.name || '';
    }

    if (field === 'branch.name') {
      return this.getReportBranchLabel(report) || report.branch?.name || '';
    }

    if (field === 'address') {
      return this.getReportAddress(report);
    }

    if (field === 'merchandiser') {
      return this.getReportMerchandiserName(report) || '';
    }

    if (field === 'feedback') {
      return report.feedback === true || report.feedback === 'true' ? 'Ja' : 'Nein';
    }

    if (field === 'plannedOn') {
      return report.plannedOn ? new Date(report.plannedOn).getTime() : 0;
    }

    if (field === 'reportTo') {
      return report.reportTo ? new Date(report.reportTo).getTime() : 0;
    }

    if (field === 'note') {
      return report.note || '';
    }

    const value = (report as any)[field];
    return value != null && value !== '' ? String(value) : '';
  }

  /**
   * Get filtered reports for a project using project-specific filters
   * @param project The project to filter reports for
   * @param excludeField Optional field to exclude from filtering (for getting unique values)
   * @returns Filtered reports array
   */
  private getFilteredReports(project: Project, excludeField?: string): Report[] {
    if (!project.reports) {
      return [];
    }

    let filtered = project.reports;
    const filters = this.getProjectReportFilters(project);

    // Apply general status filter from query params
    if (excludeField !== 'status' && this.statusFilter) {
      filtered = filtered.filter((report) => this.reportMatchesStatus(report, this.statusFilter));
    }

    // Apply column status filter (multiple selection)
    if (excludeField !== 'status' && filters.status && Array.isArray(filters.status) && filters.status.length > 0) {
      filtered = filtered.filter((report) => {
        const normalized = this.normalizeColumnFilterValue(report.status?.name || '');
        const wanted = filters.status.map((s) => this.normalizeColumnFilterValue(s));
        return wanted.includes(normalized);
      });
    }

    // Apply column merchandiser filter (multiple selection)
    if (excludeField !== 'merchandiser' && filters.merchandiser && Array.isArray(filters.merchandiser) && filters.merchandiser.length > 0) {
      filtered = filtered.filter((report) => {
        const normalized = this.normalizeColumnFilterValue(this.getReportMerchandiserName(report) || '');
        const wanted = filters.merchandiser.map((m) => this.normalizeColumnFilterValue(m));
        return wanted.includes(normalized);
      });
    }

    // Apply column filialen filter (multiple selection)
    if (excludeField !== 'filialen' && filters.filialen && Array.isArray(filters.filialen) && filters.filialen.length > 0) {
      filtered = filtered.filter((report) => {
        const normalized = this.normalizeColumnFilterValue(this.getReportBranchLabel(report) || '');
        const wanted = filters.filialen.map((f) => this.normalizeColumnFilterValue(f));
        return wanted.includes(normalized);
      });
    }

    // Apply column plannedOn date filter (multiple selection)
    if (excludeField !== 'plannedOn' && filters.plannedOn && Array.isArray(filters.plannedOn) && filters.plannedOn.length > 0) {
      filtered = filtered.filter((report) => {
        if (!report.plannedOn) {
          return filters.plannedOn.some((d) => this.normalizeColumnFilterValue(d) === '');
        }
        const formattedDate = this.formatDateForFilter(report.plannedOn);
        const normalizedRow = this.normalizeColumnFilterValue(formattedDate || '');
        return filters.plannedOn.some((d) => this.normalizeColumnFilterValue(d) === normalizedRow);
      });
    }

    // Apply column reportTo date filter (multiple selection)
    if (excludeField !== 'reportTo' && filters.reportTo && Array.isArray(filters.reportTo) && filters.reportTo.length > 0) {
      filtered = filtered.filter((report) => {
        if (!report.reportTo) {
          return filters.reportTo.some((d) => this.normalizeColumnFilterValue(d) === '');
        }
        const formattedDate = this.formatDateForFilter(report.reportTo);
        const normalizedRow = formattedDate ? this.normalizeColumnFilterValue(formattedDate) : '';
        return filters.reportTo.some((d) => this.normalizeColumnFilterValue(d) === normalizedRow);
      });
    }

    // Apply generic column filters
    Object.keys(filters.generic).forEach((field) => {
      if (excludeField !== field) {
        const filterValues = filters.generic[field];
        if (filterValues && Array.isArray(filterValues) && filterValues.length > 0) {
          filtered = filtered.filter((report) => {
            const normalizedValue = this.normalizeColumnFilterValue(this.getReportFieldValue(report, field));
            const wanted = filterValues.map((fv) => this.normalizeColumnFilterValue(fv));
            return wanted.includes(normalizedValue);
          });
        }
      }
    });

    return filtered;
  }

  /**
   * Update derived data for a project (filtered reports, displayed filialen)
   * This pre-calculates values to avoid expensive function calls in the template
   */
  private updateProjectDerivedData(project: Project): void {
    if (!project.reports) {
      project._filteredReports = [];
      project._displayedFilialen = project.branchesCount ?? 0;
      return;
    }

    // Get filtered reports without excluding any filters
    const filtered = this.getFilteredReports(project);

    let sortedReports: Report[];
    if (this.reportSortField) {
      sortedReports = [...filtered];
      this.sortReports(sortedReports, this.reportSortField, this.reportSortOrder);
    } else {
      sortedReports = [...filtered];
    }

    project._filteredReports = sortedReports;

    // Calculate displayed filialen
    const uniqueBranches = new Set<string>();
    filtered.forEach((report) => {
      const label = this.getReportBranchLabel(report);
      if (label) {
        uniqueBranches.add(label);
      }
    });
    const filteredCount = uniqueBranches.size;
    project._displayedFilialen = filteredCount > 0 ? filteredCount : (project.branchesCount ?? 0);

    // Calculate reported percentage
    if (filtered.length > 0) {
      const completedReports = filtered.filter((report) => [ReportStatusEnum.APPROVED, ReportStatusEnum.VIEWED].includes(Number(report.status?.id))).length;
      project.reportedPercentage = (completedReports / filtered.length) * 100;
    } else {
      project.reportedPercentage = 0;
    }
  }

  /**
   * Filter reports for a project based on the status filter
   * @param project The project to filter reports for
   * @param excludeField Optional field to exclude from filtering
   * @returns Filtered reports array
   */
  filteredReports(project: Project, excludeField?: string): Report[] {
    if (project._filteredReports && !excludeField) {
      return project._filteredReports;
    }
    // If excludeField is provided, we need to recalculate without that field
    if (excludeField) {
      return this.getFilteredReports(project, excludeField);
    }
    this.updateProjectDerivedData(project);
    return project._filteredReports || [];
  }

  /**
   * Check if a report matches the specified status filter
   * @param report The report to check
   * @param statusFilter The status filter value
   * @returns true if the report matches the status filter
   */
  private reportMatchesStatus(report: Report, statusFilter: string): boolean {
    if (!report.status) {
      return false;
    }

    const statusId = Number(report.status.id);

    switch (statusFilter.toLowerCase()) {
      case 'new':
        return categorizeReportForMerchandiser(statusId) === 'new';

      case 'completed':
        return categorizeReportForMerchandiser(statusId) === 'completed';

      case 'ongoing':
        return categorizeReportForMerchandiser(statusId) === 'ongoing';

      default:
        return report.status.name?.toLowerCase() === statusFilter.toLowerCase();
    }
  }

  /**
   * Get the display name for the status filter from query parameter
   * @returns The formatted status filter name for display, or empty string if no filter
   */
  getStatusFilterDisplayName(): string {
    if (!this.statusFilter) {
      return '';
    }
    const statusLower = this.statusFilter.toLowerCase();
    // Special handling for status filters
    if (statusLower === 'new') {
      return 'Neue Reports';
    }
    if (statusLower === 'ongoing') {
      return 'offene Reports';
    }
    if (statusLower === 'completed') {
      return 'abgeschlossene Reports';
    }
    // Capitalize first letter and keep the rest lowercase
    return this.statusFilter.charAt(0).toUpperCase() + this.statusFilter.slice(1).toLowerCase();
  }

  getGlobalStatusReportCount(): number {
    if (!this.filteredProjects) return 0;
    return this.filteredProjects.reduce((total, project) => {
      return total + this.filteredReports(project).length;
    }, 0);
  }

  // Download Excel for project
  downloadProjectCsv(project: any): void {
    if (!project || !project.id) return;

    // Prevent multiple simultaneous downloads for the same project
    if (this.downloadingExcel[project.id]) {
      return;
    }

    console.log('📊 Exporting project reports as Excel:', project);

    // Set loading state
    this.downloadingExcel[project.id] = true;

    this.reportService.exportProjectReportsAsExcel(project.id).subscribe({
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

  // Methods to get unique values for filters
  getUniqueReportStatuses(project?: Project): any[] {
    const projectToUse = project || this.selectedProject;

    if (!projectToUse || !projectToUse.reports) {
      return [];
    }

    // Get reports filtered by everything EXCEPT status
    const filteredReports = this.getFilteredReports(projectToUse, 'status');

    const statusMap = new Map<string, any>();
    filteredReports.forEach((report) => {
      const nameKey = this.normalizeColumnFilterValue(report.status?.name || '');
      if (!statusMap.has(nameKey)) {
        statusMap.set(nameKey, {
          name: nameKey,
          color: report.status?.name ? report.status?.color : undefined,
        });
      }
    });

    // Keep selected status values visible even if currently not present
    // because of other active filters.
    const selectedStatuses = this.getProjectReportFilters(projectToUse).status || [];
    selectedStatuses.forEach((selectedStatus) => {
      const key = this.normalizeColumnFilterValue(selectedStatus ?? '');
      if (!statusMap.has(key)) {
        statusMap.set(key, {
          name: key,
          color: undefined,
        });
      }
    });

    return Array.from(statusMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  getUniqueMerchandisers(project?: Project): string[] {
    const projectToUse = project || this.selectedProject;

    if (!projectToUse || !projectToUse.reports) {
      return [];
    }

    // Get reports filtered by everything EXCEPT merchandiser
    const filteredReports = this.getFilteredReports(projectToUse, 'merchandiser');

    const merchandiserSet = new Set<string>();

    filteredReports.forEach((report) => {
      const merchandiserName = this.getReportMerchandiserName(report);
      merchandiserSet.add(this.normalizeColumnFilterValue(merchandiserName || ''));
    });

    // Keep selected values visible even if currently not present
    // because of other active filters.
    const selectedMerchandisers = this.getProjectReportFilters(projectToUse).merchandiser || [];
    selectedMerchandisers.forEach((selectedMerchandiser) => {
      merchandiserSet.add(this.normalizeColumnFilterValue(selectedMerchandiser ?? ''));
    });

    return Array.from(merchandiserSet).sort();
  }

  getUniqueFilialen(project?: Project): string[] {
    const projectToUse = project || this.selectedProject;

    if (!projectToUse || !projectToUse.reports) {
      return [];
    }

    // Get reports filtered by everything EXCEPT filialen
    const filteredReports = this.getFilteredReports(projectToUse, 'filialen');

    const branchSet = new Set<string>();

    filteredReports.forEach((report) => {
      const label = this.getReportBranchLabel(report);
      branchSet.add(this.normalizeColumnFilterValue(label || ''));
    });

    // Keep selected values visible even if currently not present
    // because of other active filters.
    const selectedFilialen = this.getProjectReportFilters(projectToUse).filialen || [];
    selectedFilialen.forEach((selectedFiliale) => {
      branchSet.add(this.normalizeColumnFilterValue(selectedFiliale ?? ''));
    });

    return Array.from(branchSet).sort();
  }

  /**
   * Get unique values for a specific field across all reports in the selected project
   */
  getUniqueValuesForField(field: string, project?: Project): string[] {
    const projectToUse = project || this.selectedProject;
    if (!projectToUse || !projectToUse.reports) {
      return [];
    }

    // Get reports filtered by everything EXCEPT the current field
    const filteredReports = this.getFilteredReports(projectToUse, field);

    const valueSet = new Set<string>();

    filteredReports.forEach((report) => {
      const value = this.getReportFieldValue(report, field);
      valueSet.add(this.normalizeColumnFilterValue(value));
    });

    // Keep selected values visible even if currently not present
    // because of other active filters.
    const selectedGenericValues = this.getProjectReportFilters(projectToUse).generic?.[field] || [];
    selectedGenericValues.forEach((selectedValue) => {
      valueSet.add(this.normalizeColumnFilterValue(selectedValue ?? ''));
    });

    return Array.from(valueSet).sort();
  }

  /**
   * Get the value of a report field for filtering
   */
  private getReportFieldValue(report: Report, field: string): string {
    if (field === 'address') {
      return this.getReportAddress(report);
    }
    if (field === 'feedback') {
      return report.feedback === true || report.feedback === 'true' ? 'Ja' : 'Nein';
    }
    if (field === 'plannedOn') {
      return report.plannedOn || '';
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
    if (field === 'note') {
      return report.note || '';
    }
    // Default: try to get the value directly
    const value = (report as any)[field];
    return value ? String(value) : '';
  }

  /**
   * Handle generic filter click - check if filter should be enabled
   */
  handleGenericFilterClick(field: string, project: Project, event: Event): void {
    event.stopPropagation();
    if (this.getUniqueValuesForField(field, project).length > 0 || this.hasActiveReportFilterFor(project, 'generic', field)) {
      this.openGenericFilter(field, event, project);
    }
  }

  /**
   * Guarded click handler for reportTo filter icon – only opens when data exists
   */
  onReportToFilterIconClick(event: Event, project: Project): void {
    if (!this.filteredReports(project).length && !this.hasActiveReportFilterFor(project, 'reportTo')) {
      return;
    }
    this.openReportToFilter(event, project);
    event.stopPropagation();
  }

  /**
   * Open generic filter popover for a field
   */
  openGenericFilter(field: string, event: Event, project?: Project): void {
    event.stopPropagation();

    // Store the actual DOM element for positioning
    const targetElement = (event.currentTarget || event.target) as HTMLElement;

    if (!targetElement) {
      return;
    }

    // Sync filters from project if provided
    if (project) {
      this.selectedProject = project;
      this.syncUiFiltersFromProject(project);
    }

    // Populate options for the listbox
    const rawOptions = this.getUniqueValuesForField(field, this.selectedProject || undefined);
    this.currentGenericOptions = rawOptions.map((opt) => ({
      label: this.columnFilterOptionLabel(opt),
      value: opt,
    }));

    // Close settings popover if open
    if (this.activeSettingsPopover) {
      this.activeSettingsPopover.hide();
      this.activeSettingsPopover = null;
    }

    // On mobile: open centered modal instead of popover
    if (this.isMobileReportFilter()) {
      const isSameField = this.currentReportFilterField === field;
      if (isSameField && this.showReportFilterModal) {
        this.closeReportFilterModal();
        return;
      }
      this.closeReportFilterModal();
      this.currentFilterField = field;
      this.currentReportFilterField = field;
      // Initialize filter values if not exists
      if (!this.genericFilterValues[field]) {
        this.genericFilterValues[field] = [];
      }
      this.showReportFilterModal = true;
      return;
    }

    // Check if the same field is already open
    const isSameField = this.currentFilterField === field;
    const isPopoverOpen = this.activeFilterPopover === this.genericFilterPopover;

    // If clicking on the same field that's already open, just close it
    if (isSameField && isPopoverOpen) {
      this.genericFilterPopover.hide();
      this.activeFilterPopover = null;
      return;
    }

    // Close any other open filter popover
    if (this.activeFilterPopover) {
      this.activeFilterPopover.hide();
      this.activeFilterPopover = null;
    }

    // Update the current filter field
    this.currentFilterField = field;

    // Initialize filter values if not exists
    if (!this.genericFilterValues[field]) {
      this.genericFilterValues[field] = [];
    }

    // Open the popover with the new field using show() method for better control
    if (this.genericFilterPopover) {
      // Create positioning event for PrimeNG popover
      const positioningEvent = {
        currentTarget: targetElement,
        target: targetElement,
        preventDefault: () => {},
        stopPropagation: () => {},
      } as any;

      // Use setTimeout to ensure the popover closes before reopening (if it was open)
      const delay = isPopoverOpen ? 150 : 50;
      setTimeout(() => {
        this.genericFilterPopover.show(positioningEvent);
        this.activeFilterPopover = this.genericFilterPopover;
      }, delay);
    }
  }

  /**
   * Get generic filter value for a field
   */
  getGenericFilterValue(field: string): string[] {
    return this.genericFilterValues[field] || [];
  }

  /**
   * Handle generic filter change - trigger change detection
   */
  onGenericFilterChange(): void {
    // Persist UI filters to the current project
    this.persistUiFiltersToProject(this.selectedProject);
    this.updateDefaultReportFiltersFromUi();
    // The filteredReports method will automatically use the updated genericFilterValues
    // Change detection is triggered automatically by Angular's two-way binding
    // This method ensures PrimeNG's onChange event is properly handled
    if (this.selectedProject) {
      // Force re-evaluation by accessing the filtered reports
      // This ensures the table updates with the new filter values
      const _ = this.filteredReports(this.selectedProject);
    }
    this.saveState();
  }

  /**
   * Handle report status filter change
   */
  onReportStatusFilterChange(): void {
    this.persistUiFiltersToProject(this.selectedProject);
    this.updateDefaultReportFiltersFromUi();
    this.applyFilters();
    this.saveState();
  }

  /**
   * Handle report merchandiser filter change
   */
  onReportMerchandiserFilterChange(): void {
    this.persistUiFiltersToProject(this.selectedProject);
    this.updateDefaultReportFiltersFromUi();
    this.applyFilters();
    this.saveState();
  }

  /**
   * Handle report filialen filter change
   */
  onReportFilialenFilterChange(): void {
    this.persistUiFiltersToProject(this.selectedProject);
    this.updateDefaultReportFiltersFromUi();
    this.applyFilters();
    this.saveState();
  }

  /**
   * Handle report plannedOn filter change
   */
  onReportPlannedOnFilterChange(): void {
    this.persistUiFiltersToProject(this.selectedProject);
    this.updateDefaultReportFiltersFromUi();
    this.applyFilters();
    this.saveState();
  }

  /**
   * Handle report reportTo filter change
   */
  onReportToFilterChange(): void {
    this.persistUiFiltersToProject(this.selectedProject);
    this.updateDefaultReportFiltersFromUi();
    this.applyFilters();
    this.saveState();
  }

  /**
   * Get column header for a field
   */
  getColumnHeader(field: string): string {
    const col = this.reportCols.find((c) => c.field === field);
    return col ? col.header : field;
  }

  /**
   * Open status filter popover
   */
  openStatusFilter(event: Event): void {
    event.stopPropagation();
    const targetElement = (event.currentTarget || event.target) as HTMLElement;
    if (!targetElement) return;

    // Populate options for the listbox
    const rawOptions = this.getUniqueReportStatuses();
    this.currentStatusOptions = rawOptions.map((opt) => ({
      label: this.columnFilterOptionLabel(opt.name),
      value: opt.name,
      color: opt.color,
    }));

    if (this.activeSettingsPopover) {
      this.activeSettingsPopover.hide();
      this.activeSettingsPopover = null;
    }

    // On mobile: open centered modal instead of popover
    if (this.isMobileReportFilter()) {
      const isSameField = this.currentReportFilterField === 'status';
      if (isSameField && this.showReportFilterModal) {
        this.closeReportFilterModal();
        return;
      }
      this.closeReportFilterModal();
      this.currentReportFilterField = 'status';
      this.showReportFilterModal = true;
      return;
    }

    const isPopoverOpen = this.activeFilterPopover === this.statusFilterPopover;

    if (isPopoverOpen) {
      this.statusFilterPopover.hide();
      this.activeFilterPopover = null;
      return;
    }

    if (this.activeFilterPopover) {
      this.activeFilterPopover.hide();
      this.activeFilterPopover = null;
    }

    if (this.statusFilterPopover) {
      const positioningEvent = {
        currentTarget: targetElement,
        target: targetElement,
        preventDefault: () => {},
        stopPropagation: () => {},
      } as any;
      const delay = isPopoverOpen ? 150 : 50;
      setTimeout(() => {
        this.statusFilterPopover.show(positioningEvent);
        this.activeFilterPopover = this.statusFilterPopover;
      }, delay);
    }
  }

  /**
   * Guarded click handler for status filter icon – only opens when data exists
   */
  onStatusFilterIconClick(event: Event, project: Project): void {
    if (!this.filteredReports(project).length && !this.hasActiveReportFilterFor(project, 'status')) {
      return;
    }
    this.selectedProject = project;
    this.syncUiFiltersFromProject(project);
    this.openStatusFilter(event);
    event.stopPropagation();
  }

  /**
   * Open merchandiser filter popover
   */
  openMerchandiserFilter(event: Event, project?: Project): void {
    if (project) {
      this.selectedProject = project;
      this.syncUiFiltersFromProject(project);
    }
    event.stopPropagation();
    const targetElement = (event.currentTarget || event.target) as HTMLElement;
    if (!targetElement) return;

    // Populate options for the listbox
    const rawOptions = this.getUniqueMerchandisers(this.selectedProject || undefined);
    this.currentMerchandiserOptions = rawOptions.map((opt) => ({
      label: this.columnFilterOptionLabel(opt),
      value: opt,
    }));

    if (this.activeSettingsPopover) {
      this.activeSettingsPopover.hide();
      this.activeSettingsPopover = null;
    }

    // On mobile: open centered modal instead of popover
    if (this.isMobileReportFilter()) {
      const isSameField = this.currentReportFilterField === 'merchandiser';
      if (isSameField && this.showReportFilterModal) {
        this.closeReportFilterModal();
        return;
      }
      this.closeReportFilterModal();
      this.currentReportFilterField = 'merchandiser';
      this.showReportFilterModal = true;
      return;
    }

    const isPopoverOpen = this.activeFilterPopover === this.merchandiserFilterPopover;

    if (isPopoverOpen) {
      this.merchandiserFilterPopover.hide();
      this.activeFilterPopover = null;
      return;
    }

    if (this.activeFilterPopover) {
      this.activeFilterPopover.hide();
      this.activeFilterPopover = null;
    }

    if (this.merchandiserFilterPopover) {
      const positioningEvent = {
        currentTarget: targetElement,
        target: targetElement,
        preventDefault: () => {},
        stopPropagation: () => {},
      } as any;
      const delay = isPopoverOpen ? 150 : 50;
      setTimeout(() => {
        this.merchandiserFilterPopover.show(positioningEvent);
        this.activeFilterPopover = this.merchandiserFilterPopover;
      }, delay);
    }
  }

  /**
   * Open filialen filter popover
   */
  openFilialenFilter(event: Event, project?: Project): void {
    if (project) {
      this.selectedProject = project;
      this.syncUiFiltersFromProject(project);
    }
    event.stopPropagation();
    const targetElement = (event.currentTarget || event.target) as HTMLElement;
    if (!targetElement) return;

    // Populate options for the listbox
    const rawOptions = this.getUniqueFilialen(this.selectedProject || undefined);
    this.currentFilialenOptions = rawOptions.map((opt) => ({
      label: this.columnFilterOptionLabel(opt),
      value: opt,
    }));

    if (this.activeSettingsPopover) {
      this.activeSettingsPopover.hide();
      this.activeSettingsPopover = null;
    }

    // On mobile: open centered modal instead of popover
    if (this.isMobileReportFilter()) {
      const isSameField = this.currentReportFilterField === 'branch.name';
      if (isSameField && this.showReportFilterModal) {
        this.closeReportFilterModal();
        return;
      }
      this.closeReportFilterModal();
      this.currentReportFilterField = 'branch.name';
      this.showReportFilterModal = true;
      return;
    }

    const isPopoverOpen = this.activeFilterPopover === this.filialenFilterPopover;

    if (isPopoverOpen) {
      this.filialenFilterPopover.hide();
      this.activeFilterPopover = null;
      return;
    }

    if (this.activeFilterPopover) {
      this.activeFilterPopover.hide();
      this.activeFilterPopover = null;
    }

    if (this.filialenFilterPopover) {
      const positioningEvent = {
        currentTarget: targetElement,
        target: targetElement,
        preventDefault: () => {},
        stopPropagation: () => {},
      } as any;
      const delay = isPopoverOpen ? 150 : 50;
      setTimeout(() => {
        this.filialenFilterPopover.show(positioningEvent);
        this.activeFilterPopover = this.filialenFilterPopover;
      }, delay);
    }
  }

  /**
   * Guarded click handler for filialen filter icon – only opens when data exists
   */
  onFilialenFilterIconClick(event: Event, project: Project): void {
    if (!this.filteredReports(project).length && !this.hasActiveReportFilterFor(project, 'filialen')) {
      return;
    }
    this.openFilialenFilter(event, project);
    event.stopPropagation();
  }

  /**
   * Open plannedOn filter popover
   */
  openPlannedOnFilter(event: Event, project?: Project): void {
    if (project) {
      this.selectedProject = project;
      this.syncUiFiltersFromProject(project);
    }
    event.stopPropagation();
    const targetElement = (event.currentTarget || event.target) as HTMLElement;
    if (!targetElement) return;

    // Populate options for the listbox
    const rawOptions = this.getUniquePlannedOnDates(this.selectedProject || undefined);
    this.currentPlannedOnOptions = rawOptions.map((opt) => ({
      label: this.columnFilterOptionLabel(opt),
      value: opt,
    }));

    if (this.activeSettingsPopover) {
      this.activeSettingsPopover.hide();
      this.activeSettingsPopover = null;
    }

    // On mobile: open centered modal instead of popover
    if (this.isMobileReportFilter()) {
      const isSameField = this.currentReportFilterField === 'plannedOn';
      if (isSameField && this.showReportFilterModal) {
        this.closeReportFilterModal();
        return;
      }
      this.closeReportFilterModal();
      this.currentReportFilterField = 'plannedOn';
      this.showReportFilterModal = true;
      return;
    }

    const isPopoverOpen = this.activeFilterPopover === this.plannedOnFilterPopover;

    if (isPopoverOpen) {
      this.plannedOnFilterPopover.hide();
      this.activeFilterPopover = null;
      return;
    }

    if (this.activeFilterPopover) {
      this.activeFilterPopover.hide();
      this.activeFilterPopover = null;
    }

    if (this.plannedOnFilterPopover) {
      const positioningEvent = {
        currentTarget: targetElement,
        target: targetElement,
        preventDefault: () => {},
        stopPropagation: () => {},
      } as any;
      const delay = isPopoverOpen ? 150 : 50;
      setTimeout(() => {
        this.plannedOnFilterPopover.show(positioningEvent);
        this.activeFilterPopover = this.plannedOnFilterPopover;
      }, delay);
    }
  }

  /**
   * Guarded click handler for plannedOn filter icon – only opens when data exists
   */
  onPlannedOnFilterIconClick(event: Event, project: Project): void {
    if (!this.filteredReports(project).length && !this.hasActiveReportFilterFor(project, 'plannedOn')) {
      return;
    }
    this.openPlannedOnFilter(event, project);
    event.stopPropagation();
  }

  /**
   * Open reportTo filter popover
   */
  openReportToFilter(event: Event, project?: Project): void {
    if (project) {
      this.selectedProject = project;
      this.syncUiFiltersFromProject(project);
    }
    event.stopPropagation();
    const targetElement = (event.currentTarget || event.target) as HTMLElement;
    if (!targetElement) return;

    // Populate options for the listbox
    const rawOptions = this.getUniqueReportToDates(this.selectedProject || undefined);
    this.currentReportToOptions = rawOptions.map((opt) => ({
      label: this.columnFilterOptionLabel(opt),
      value: opt,
    }));

    if (this.activeSettingsPopover) {
      this.activeSettingsPopover.hide();
      this.activeSettingsPopover = null;
    }

    // On mobile: open centered modal instead of popover
    if (this.isMobileReportFilter()) {
      const isSameField = this.currentReportFilterField === 'reportTo';
      if (isSameField && this.showReportFilterModal) {
        this.closeReportFilterModal();
        return;
      }
      this.closeReportFilterModal();
      this.currentReportFilterField = 'reportTo';
      this.showReportFilterModal = true;
      return;
    }

    const isPopoverOpen = this.activeFilterPopover === this.reportToFilterPopover;

    if (isPopoverOpen) {
      this.reportToFilterPopover.hide();
      this.activeFilterPopover = null;
      return;
    }

    if (this.activeFilterPopover) {
      this.activeFilterPopover.hide();
      this.activeFilterPopover = null;
    }

    if (this.reportToFilterPopover) {
      const positioningEvent = {
        currentTarget: targetElement,
        target: targetElement,
        preventDefault: () => {},
        stopPropagation: () => {},
      } as any;
      const delay = isPopoverOpen ? 150 : 50;
      setTimeout(() => {
        this.reportToFilterPopover.show(positioningEvent);
        this.activeFilterPopover = this.reportToFilterPopover;
      }, delay);
    }
  }

  /**
   * Toggle project settings popover
   */
  toggleProjectSettingsPopover(event: Event): void {
    event.stopPropagation();
    const targetElement = (event.currentTarget || event.target) as HTMLElement;
    if (!targetElement) return;

    if (this.activeFilterPopover) {
      this.activeFilterPopover.hide();
      this.activeFilterPopover = null;
    }

    const isPopoverOpen = this.activeSettingsPopover === this.op;

    if (isPopoverOpen) {
      this.op.hide();
      this.activeSettingsPopover = null;
      return;
    }

    if (this.activeSettingsPopover) {
      this.activeSettingsPopover.hide();
      this.activeSettingsPopover = null;
    }

    if (this.op) {
      const positioningEvent = {
        currentTarget: targetElement,
        target: targetElement,
        preventDefault: () => {},
        stopPropagation: () => {},
      } as any;
      const delay = isPopoverOpen ? 150 : 50;
      setTimeout(() => {
        this.op.show(positioningEvent);
        this.activeSettingsPopover = this.op;
      }, delay);
    }
  }

  /**
   * Toggle report settings popover
   */
  toggleReportSettingsPopover(event: Event): void {
    event.stopPropagation();
    const targetElement = (event.currentTarget || event.target) as HTMLElement;
    if (!targetElement) return;

    if (this.activeFilterPopover) {
      this.activeFilterPopover.hide();
      this.activeFilterPopover = null;
    }

    const isPopoverOpen = this.activeSettingsPopover === this.reportColumnsPopover;

    if (isPopoverOpen) {
      this.reportColumnsPopover.hide();
      this.activeSettingsPopover = null;
      return;
    }

    if (this.activeSettingsPopover) {
      this.activeSettingsPopover.hide();
      this.activeSettingsPopover = null;
    }

    if (this.reportColumnsPopover) {
      const positioningEvent = {
        currentTarget: targetElement,
        target: targetElement,
        preventDefault: () => {},
        stopPropagation: () => {},
      } as any;
      const delay = isPopoverOpen ? 150 : 50;
      setTimeout(() => {
        this.reportColumnsPopover.show(positioningEvent);
        this.activeSettingsPopover = this.reportColumnsPopover;
      }, delay);
    }
  }

  /**
   * Open plannedOn date filter by clicking the date range picker
   */
  openPlannedOnDateFilter(event: Event): void {
    event.stopPropagation();
    event.preventDefault();
    console.log('Opening date range picker');

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

  onPlannedOnColumnClick(event: Event) {
    event.stopPropagation();
    this.openPlannedOnDateFilter(event);
  }

  /**
   * Calculate column width percentage based on column type
   */
  getColumnWidth(field: string, columns: Column[]): number {
    // Custom width mapping for each column (in percentage)
    const columnWidths: { [key: string]: number } = {
      status: 4, // Status column
      plannedOn: 4, // Geplant column
      merchandiser: 6, // Merchandiser column
      'branch.name': 6, // Filiale column
      address: 8, // Adresse column
      note: 4, // Notiz column
      reportTo: 5, // Report bis column
      feedback: 4, // Feedback column
      actions: 5, // Actions column (Column Settings)
    };

    // If column has a custom width defined, return it
    if (columnWidths[field]) {
      return columnWidths[field];
    }

    // Default width for any column not in the mapping
    return 8;
  }

  /**
   * Get unique plannedOn dates from a project's reports
   * @param project The project to get dates from (optional, defaults to selectedProject)
   * @returns Array of unique formatted date strings
   */
  getUniquePlannedOnDates(project?: Project): string[] {
    const projectToUse = project || this.selectedProject;

    if (!projectToUse || !projectToUse.reports) {
      return [];
    }

    // Get reports filtered by everything EXCEPT plannedOn
    const filteredReports = this.getFilteredReports(projectToUse, 'plannedOn');

    const dateSet = new Set<string>();

    filteredReports.forEach((report) => {
      if (!report.plannedOn) {
        dateSet.add('');
        return;
      }
      const formattedDate = this.formatDateForFilter(report.plannedOn);
      dateSet.add(this.normalizeColumnFilterValue(formattedDate || ''));
    });

    // Keep selected values visible even if currently not present
    // because of other active filters.
    const selectedPlannedOnDates = this.getProjectReportFilters(projectToUse).plannedOn || [];
    selectedPlannedOnDates.forEach((selectedDate) => {
      dateSet.add(this.normalizeColumnFilterValue(selectedDate ?? ''));
    });

    return Array.from(dateSet).sort();
  }

  /**
   * Get unique reportTo dates from a project's reports
   */
  getUniqueReportToDates(project?: Project): string[] {
    const projectToUse = project || this.selectedProject;

    if (!projectToUse || !projectToUse.reports) {
      return [];
    }

    // Get reports filtered by everything EXCEPT reportTo
    const filteredReports = this.getFilteredReports(projectToUse, 'reportTo');

    const dateSet = new Set<string>();

    filteredReports.forEach((report) => {
      if (!report.reportTo) {
        dateSet.add('');
        return;
      }
      const formattedDate = this.formatDateForFilter(report.reportTo);
      dateSet.add(this.normalizeColumnFilterValue(formattedDate || ''));
    });

    // Keep selected values visible even if currently not present
    // because of other active filters.
    const selectedReportToDates = this.getProjectReportFilters(projectToUse).reportTo || [];
    selectedReportToDates.forEach((selectedDate) => {
      dateSet.add(this.normalizeColumnFilterValue(selectedDate ?? ''));
    });

    return Array.from(dateSet).sort();
  }

  /**
   * Format a date for filtering (consistent format)
   */
  private formatDateForFilter(date: string | Date): string {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    // Format as DD.MM.YYYY (EU format)
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}.${month}.${year}`;
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

  /** `app-mobile-filter-sheet` / p-listbox need `{ label, value }`; raw string[] would show blank rows. */
  private mapReportFilterStringsToListOptions(values: string[]): { label: string; value: string }[] {
    return (values || []).map((opt) => ({
      label: this.columnFilterOptionLabel(opt),
      value: opt,
    }));
  }

  private mapReportStatusToListOptions(raw: { name: string; color?: string }[]): { label: string; value: string; color?: string }[] {
    return (raw || []).map((opt) => ({
      label: this.columnFilterOptionLabel(opt?.name ?? ''),
      value: opt?.name ?? '',
      color: opt?.color,
    }));
  }

  // Project column filter methods
  getProjectFilterOptions(field: string): string[] {
    const values = new Set<string>();
    const filteredProjects = this.getFilteredProjectsData(field);
    filteredProjects.forEach((project) => {
      let raw = '';
      switch (field) {
        case 'name':
          raw = project.name || '';
          break;
        case 'formattedZeitraum':
          raw = this.getProjectZeitraum(project);
          break;
        case 'filialen':
          // IMPORTANT: use derived displayed filialen count
          raw = `${this.getDisplayedFilialen(project)} Stores`;
          break;
        case 'status':
          raw = `${project.reportedPercentage ?? 0}% reported`;
          break;
      }
      values.add(this.normalizeColumnFilterValue(raw));
    });

    // Keep selected values visible even if currently not present
    // because of other active filters.
    (this.projectColumnFilters[field] || []).forEach((selectedValue) => {
      values.add(this.normalizeColumnFilterValue(selectedValue ?? ''));
    });

    return Array.from(values).sort();
  }

  getProjectColumnFilterValue(field: string): string[] {
    return this.projectColumnFilters[field] || [];
  }

  isMobileColumnFilter(): boolean {
    return typeof window !== 'undefined' && window.innerWidth < 1024;
  }

  /** Desktop (lg+): expanded table rows only — no right Aufträge panel */
  isMobileReportsSidebarView(): boolean {
    return this.isMobileColumnFilter();
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    if (!this.isMobileReportsSidebarView() && this.sidebarVisibleProjectId) {
      this.closeReportsSidebar(true);
    }
  }

  openColumnFilterModal(): void {
    this.showColumnFilterModal = true;
  }

  closeColumnFilterModal(): void {
    this.showColumnFilterModal = false;
    this.activeFilterPopover = null;
  }

  onProjectColumnFilterPopoverHide(): void {
    // PrimeNG popover dismissable outside-click hides the popover;
    // keep our UI state in sync.
    this.activeFilterPopover = null;
  }

  getColumnFilterModalTitle(): string {
    if (this.currentProjectFilterField) {
      return this.getProjectColumnHeader(this.currentProjectFilterField);
    }
    return 'Filter';
  }

  // Report filter modal methods (for filters within expanded project rows)
  isMobileReportFilter(): boolean {
    return typeof window !== 'undefined' && window.innerWidth < 1024;
  }

  closeReportFilterModal(): void {
    this.showReportFilterModal = false;
    this.currentReportFilterField = '';
    this.activeFilterPopover = null;
  }

  getReportFilterModalTitle(): string {
    if (this.currentReportFilterField === 'status') {
      return 'Status';
    }
    if (this.currentReportFilterField === 'plannedOn') {
      return 'Geplant';
    }
    if (this.currentReportFilterField === 'branch.name') {
      return 'Filiale';
    }
    if (this.currentReportFilterField === 'reportTo') {
      return 'Report bis';
    }
    if (this.currentReportFilterField === 'merchandiser') {
      return 'Merchandiser';
    }
    // Find in report columns
    const reportCol = this.reportCols.find((col) => col.field === this.currentReportFilterField);
    if (reportCol) {
      return reportCol.header;
    }
    return this.currentReportFilterField;
  }

  openProjectColumnFilter(field: string, event: Event): void {
    event.stopPropagation();

    // Store the actual DOM element for positioning
    const targetElement = (event.currentTarget || event.target) as HTMLElement;

    if (!targetElement) {
      return;
    }

    // Populate options for the listbox
    const rawOptions = this.getProjectFilterOptions(field);
    this.currentProjectColumnOptions = rawOptions.map((opt) => ({
      label: this.columnFilterOptionLabel(opt),
      value: opt,
    }));

    // Close settings popover if open
    if (this.activeSettingsPopover) {
      this.activeSettingsPopover.hide();
      this.activeSettingsPopover = null;
    }

    // On mobile: open centered modal instead of popover
    if (this.isMobileColumnFilter()) {
      const isSameField = this.currentProjectFilterField === field;
      if (isSameField && this.showColumnFilterModal) {
        this.closeColumnFilterModal();
        return;
      }
      this.closeColumnFilterModal();
      this.currentProjectFilterField = field;
      this.openColumnFilterModal();
      return;
    }

    // Check if the same field is already open
    const isSameField = this.currentProjectFilterField === field;
    const isPopoverOpen = this.activeFilterPopover === this.projectColumnFilterPopover;

    // If clicking on the same field that's already open, just close it
    if (isSameField && isPopoverOpen) {
      this.projectColumnFilterPopover.hide();
      this.activeFilterPopover = null;
      return;
    }

    // Close any other open filter popover
    if (this.activeFilterPopover) {
      this.activeFilterPopover.hide();
      this.activeFilterPopover = null;
    }

    // Update the current filter field
    this.currentProjectFilterField = field;

    // Open the popover with the new field using show() method for better control
    if (this.projectColumnFilterPopover) {
      // Create positioning event for PrimeNG popover
      const positioningEvent = {
        currentTarget: targetElement,
        target: targetElement,
        preventDefault: () => {},
        stopPropagation: () => {},
      } as any;

      // Use setTimeout to ensure the popover closes before reopening (if it was open)
      const delay = isPopoverOpen ? 150 : 50;
      setTimeout(() => {
        this.projectColumnFilterPopover.show(positioningEvent);
        this.activeFilterPopover = this.projectColumnFilterPopover;
      }, delay);
    }
  }

  hasProjectColumnFilters(): boolean {
    return Object.values(this.projectColumnFilters).some((filters) => filters.length > 0);
  }

  /**
   * Check if there are any report column filters active
   */
  hasReportColumnFilters(): boolean {
    return (
      (this.reportStatusFilter && this.reportStatusFilter.length > 0) ||
      (this.reportMerchandiserFilter && this.reportMerchandiserFilter.length > 0) ||
      (this.reportFilialenFilter && this.reportFilialenFilter.length > 0) ||
      (this.reportPlannedOnFilter && this.reportPlannedOnFilter.length > 0) ||
      (this.reportToFilter && this.reportToFilter.length > 0) ||
      Object.values(this.genericFilterValues).some((filters) => filters && filters.length > 0)
    );
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

  /**
   * Clone generic filters
   */
  private cloneGenericFilters(source: { [field: string]: string[] } = {}): { [field: string]: string[] } {
    const clone: Record<string, string[]> = {};
    Object.keys(source || {}).forEach((key) => {
      clone[key] = [...(source[key] || [])];
    });
    return clone;
  }

  /**
   * Clone project report filters
   */
  private cloneProjectFilters(filters: ProjectReportFilters): ProjectReportFilters {
    return {
      status: [...(filters?.status || [])],
      merchandiser: [...(filters?.merchandiser || [])],
      filialen: [...(filters?.filialen || [])],
      plannedOn: [...(filters?.plannedOn || [])],
      reportTo: [...(filters?.reportTo || [])],
      generic: this.cloneGenericFilters(filters?.generic),
    };
  }

  /**
   * Get UI filters as ProjectReportFilters
   */
  private getUiFiltersAsProjectFilters(): ProjectReportFilters {
    return {
      status: [...this.reportStatusFilter],
      merchandiser: [...this.reportMerchandiserFilter],
      filialen: [...this.reportFilialenFilter],
      plannedOn: [...this.reportPlannedOnFilter],
      reportTo: [...this.reportToFilter],
      generic: this.cloneGenericFilters(this.genericFilterValues),
    };
  }

  /**
   * Update default report filters from UI
   */
  private updateDefaultReportFiltersFromUi(): void {
    this.defaultReportFilters = this.cloneProjectFilters(this.getUiFiltersAsProjectFilters());
  }

  /**
   * Get project report filters (returns project-specific or default)
   */
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

  /**
   * Whether the project has stored selections for a report column filter (keeps the funnel enabled when filters exclude all rows).
   */
  hasActiveReportFilterFor(project: Project, kind: 'status' | 'merchandiser' | 'filialen' | 'plannedOn' | 'reportTo' | 'generic', genericField?: string): boolean {
    const f = this.getProjectReportFilters(project);
    if (kind === 'generic') {
      const field = genericField || '';
      return (f.generic?.[field]?.length ?? 0) > 0;
    }
    const arr = f[kind];
    return Array.isArray(arr) && arr.length > 0;
  }

  /**
   * Sync UI filters from project (load project's filters into UI)
   */
  private syncUiFiltersFromProject(project?: Project | null): void {
    const filters = this.getProjectReportFilters(project);
    this.reportStatusFilter = [...filters.status];
    this.reportMerchandiserFilter = [...filters.merchandiser];
    this.reportFilialenFilter = [...filters.filialen];
    this.reportPlannedOnFilter = [...filters.plannedOn];
    this.reportToFilter = [...(filters.reportTo || [])];
    this.genericFilterValues = this.cloneGenericFilters(filters.generic);
  }

  /**
   * Persist UI filters to project (save UI filters to project)
   */
  private persistUiFiltersToProject(project?: Project | null): void {
    const targetProject = project || this.selectedProject;
    if (targetProject) {
      const filters = this.getProjectReportFilters(targetProject);
      filters.status = [...this.reportStatusFilter];
      filters.merchandiser = [...this.reportMerchandiserFilter];
      filters.filialen = [...this.reportFilialenFilter];
      filters.plannedOn = [...this.reportPlannedOnFilter];
      filters.reportTo = [...this.reportToFilter];
      filters.generic = this.cloneGenericFilters(this.genericFilterValues);

      // Update derived data to reflect filter changes
      this.updateProjectDerivedData(targetProject);
    }
  }

  /**
   * Save current filter state
   */
  saveState(): void {
    if (!this.client?.id) return;

    const clientId = typeof this.client.id === 'string' ? parseInt(this.client.id, 10) : this.client.id;
    if (!clientId || isNaN(clientId)) return;

    const state: ClientDetailState = {
      client: this.client
        ? {
            id: this.client.id,
            name: this.client.name,
            logo: (this.client as any).logo,
            slug: (this.client as any).slug,
          }
        : null,
      projects: this.projects,
      expandedRows: this.getNormalizedExpandedRows(this.expandedRows),
      sidebarVisibleProjectId: this.sidebarVisibleProjectId,
      mobileReportsSidebarScrollPositionByProject: { ...this.mobileReportsSidebarScrollPositionByProject },
      statusFilter: this.statusFilter || '',
      projectSearchTerm: this.projectSearchTerm,
      filialeSearchTerm: this.filialeSearchTerm,
      reportStatusFilter: [...(this.reportStatusFilter || [])],
      reportMerchandiserFilter: [...(this.reportMerchandiserFilter || [])],
      reportFilialenFilter: [...(this.reportFilialenFilter || [])],
      reportPlannedOnFilter: [...(this.reportPlannedOnFilter || [])],
      reportToFilter: [...(this.reportToFilter || [])],
      projectColumnFilters: JSON.parse(JSON.stringify(this.projectColumnFilters || {})),
      genericFilterValues: JSON.parse(JSON.stringify(this.genericFilterValues || {})),
      dateRange2: this.dateRange2
        ? {
            start: this.dateRange2.start ? new Date(this.dateRange2.start) : null,
            end: this.dateRange2.end ? new Date(this.dateRange2.end) : null,
          }
        : { start: null, end: null },
      projectsVisibleColumns: { ...this.projectsVisibleColumns },
      reportsVisibleColumns: { ...this.reportsVisibleColumns },
      projectsOrderedColumns: this.projectsOrderedColumns.map((col) => ({ field: col.field, header: col.header })),
      reportsOrderedColumns: this.reportsOrderedColumns.map((col) => ({ field: col.field, header: col.header })),
      selectedColumns: this.selectedColumns.map((col) => ({ field: col.field, header: col.header })),
      selectedReportColumns: this.selectedReportColumns.map((col) => ({ field: col.field, header: col.header })),
      projectSortField: this.projectSortField,
      projectSortOrder: this.projectSortOrder,
      reportSortField: this.reportSortField,
      reportSortOrder: this.reportSortOrder,
      defaultReportFilters: this.defaultReportFilters
        ? {
            status: [...this.defaultReportFilters.status],
            merchandiser: [...this.defaultReportFilters.merchandiser],
            filialen: [...this.defaultReportFilters.filialen],
            plannedOn: [...this.defaultReportFilters.plannedOn],
            reportTo: [...this.defaultReportFilters.reportTo],
            generic: this.cloneGenericFilters(this.defaultReportFilters.generic),
          }
        : undefined,
      projectReportFilters: this.buildProjectFiltersMap(),
    };

    this.clientDetailStateService.saveFilterState(clientId, state);
  }

  /**
   * Build a map of project filters for state persistence
   */
  private buildProjectFiltersMap(): { [projectId: string]: any } {
    const map: { [projectId: string]: any } = {};
    if (this.projects) {
      this.projects.forEach((proj) => {
        if (proj?.id && proj._reportFilters) {
          map[proj.id.toString()] = {
            status: [...proj._reportFilters.status],
            merchandiser: [...proj._reportFilters.merchandiser],
            filialen: [...proj._reportFilters.filialen],
            plannedOn: [...proj._reportFilters.plannedOn],
            reportTo: [...(proj._reportFilters.reportTo || [])],
            generic: this.cloneGenericFilters(proj._reportFilters.generic),
          };
        }
      });
    }
    return map;
  }

  /**
   * Restore filter state from cache
   * @returns true if state was restored, false otherwise
   */
  private restoreState(): boolean {
    if (!this.client?.id) return false;

    const clientId = typeof this.client.id === 'string' ? parseInt(this.client.id, 10) : this.client.id;
    if (!clientId || isNaN(clientId)) return false;

    const cachedState = this.clientDetailStateService.getFilterState(clientId);
    if (!cachedState) return false;

    console.log('✅ Restoring filter state from cache');

    // Restore filter values
    // Always prioritize query param for status filter
    const statusFromQuery = this.route.snapshot.queryParamMap.get('status');
    this.statusFilter = statusFromQuery !== null ? statusFromQuery : '';
    this.projectSearchTerm = cachedState.projectSearchTerm || '';
    this.filialeSearchTerm = cachedState.filialeSearchTerm || '';
    this.reportStatusFilter = cachedState.reportStatusFilter || [];
    this.reportMerchandiserFilter = cachedState.reportMerchandiserFilter || [];
    this.reportFilialenFilter = cachedState.reportFilialenFilter || [];
    this.reportPlannedOnFilter = cachedState.reportPlannedOnFilter || [];
    this.reportToFilter = cachedState.reportToFilter || [];
    this.projectColumnFilters = cachedState.projectColumnFilters || {
      name: [],
      formattedZeitraum: [],
      filialen: [],
      status: [],
    };
    this.genericFilterValues = cachedState.genericFilterValues || {};
    this.dateRange2 = cachedState.dateRange2 || { start: null, end: null };

    // Restore expanded rows
    this.expandedRows = this.getNormalizedExpandedRows(cachedState.expandedRows);

    if (this.isMobileReportsSidebarView() && cachedState.sidebarVisibleProjectId !== undefined && cachedState.sidebarVisibleProjectId !== null) {
      this.sidebarVisibleProjectId = cachedState.sidebarVisibleProjectId;
      if (this.sidebarVisibleProjectId) {
        const projectForSidebar = this.projects?.find((p) => p.id?.toString() === this.sidebarVisibleProjectId);
        if (projectForSidebar) {
          this.mobileFilterProject = projectForSidebar;
          this.selectedProject = projectForSidebar;
          this.syncUiFiltersFromProject(projectForSidebar);
          if (projectForSidebar.reports === undefined || projectForSidebar.reports === null) {
            this.loadProjectReports(projectForSidebar);
          } else {
            this.updateProjectDerivedData(projectForSidebar);
          }
        }
      }
    } else {
      this.sidebarVisibleProjectId = null;
    }
    if (cachedState.mobileReportsSidebarScrollPositionByProject) {
      this.mobileReportsSidebarScrollPositionByProject = { ...cachedState.mobileReportsSidebarScrollPositionByProject };
      if (this.sidebarVisibleProjectId) {
        this.restoreMobileReportsSidebarScrollPosition(this.sidebarVisibleProjectId);
      }
    }

    // Restore column visibility and order
    if (cachedState.projectsVisibleColumns) {
      this.projectsVisibleColumns = { ...cachedState.projectsVisibleColumns };
    }
    if (cachedState.reportsVisibleColumns) {
      this.reportsVisibleColumns = { ...cachedState.reportsVisibleColumns };
    }
    if (cachedState.projectsOrderedColumns && cachedState.projectsOrderedColumns.length > 0) {
      this.projectsOrderedColumns = cachedState.projectsOrderedColumns.map((col) => ({
        field: col.field,
        header: col.header,
      }));
    }
    if (cachedState.reportsOrderedColumns && cachedState.reportsOrderedColumns.length > 0) {
      this.reportsOrderedColumns = cachedState.reportsOrderedColumns.map((col) => ({
        field: col.field,
        header: col.header,
      }));
    }
    if (cachedState.selectedColumns && cachedState.selectedColumns.length > 0) {
      this.selectedColumns = cachedState.selectedColumns.map((col) => ({
        field: col.field,
        header: col.header,
      }));
    }
    if (cachedState.selectedReportColumns && cachedState.selectedReportColumns.length > 0) {
      this.selectedReportColumns = cachedState.selectedReportColumns.map((col) => ({
        field: col.field,
        header: col.header,
      }));
    }

    // Restore sort states
    if (cachedState.projectSortField) {
      this.projectSortField = cachedState.projectSortField;
      this.projectSortOrder = cachedState.projectSortOrder || 1;
    }
    if (cachedState.reportSortField) {
      this.reportSortField = cachedState.reportSortField;
      this.reportSortOrder = cachedState.reportSortOrder || 1;
    }

    // Restore default report filters
    if (cachedState.defaultReportFilters) {
      this.defaultReportFilters = {
        status: [...(cachedState.defaultReportFilters.status || [])],
        merchandiser: [...(cachedState.defaultReportFilters.merchandiser || [])],
        filialen: [...(cachedState.defaultReportFilters.filialen || [])],
        plannedOn: [...(cachedState.defaultReportFilters.plannedOn || [])],
        reportTo: [...(cachedState.defaultReportFilters.reportTo || [])],
        generic: this.cloneGenericFilters(cachedState.defaultReportFilters.generic || {}),
      };
    }

    // Restore per-project filters
    if (cachedState.projectReportFilters && this.projects) {
      Object.entries(cachedState.projectReportFilters).forEach(([projectId, filters]) => {
        const proj = this.projects.find((p) => p?.id?.toString() === projectId);
        if (proj && filters) {
          proj._reportFilters = {
            status: [...(filters.status || [])],
            merchandiser: [...(filters.merchandiser || [])],
            filialen: [...(filters.filialen || [])],
            plannedOn: [...(filters.plannedOn || [])],
            reportTo: [...(filters.reportTo || [])],
            generic: this.cloneGenericFilters(filters.generic || {}),
          };
        }
      });
    }

    // Apply filters with restored state
    this.applyFilters();

    // Route/sidebar selection wins over cached expanded rows (avoids two active projects)
    const routeProjectSlug = this.route.snapshot.paramMap.get('projectSlug') || this.route.snapshot.paramMap.get('projectId');
    if (routeProjectSlug) {
      this.applyRouteProjectSelection(routeProjectSlug);
    }

    return true;
  }

  // --- Mobile Filter Bottom Sheet Logic for Reports ---
  showReportsMobileFilter = false;
  reportMobileColumns: any[] = [];
  reportMobileFilterValues: { [key: string]: string[] } = {};
  reportMobileColumnOptions: { [key: string]: any[] } = {};
  reportMobileCanFilterMap: { [key: string]: boolean } = {};
  mobileFilterProject: Project | null = null;

  // --- Mobile bottom sheet: project search + date + column filters ---
  showMobileProjectFilters = false;
  projectMobileColumns: { field: string; header: string }[] = [];
  projectMobileFilterValues: { [key: string]: string[] } = {};
  projectMobileColumnOptions: { [key: string]: { label: string; value: string }[] } = {};
  projectMobileCanFilterMap: { [key: string]: boolean } = {};

  toggleReportsSidebar(project: Project): void {
    if (!project?.id || !this.isMobileReportsSidebarView()) {
      return;
    }
    const id = project.id.toString();
    if (this.sidebarVisibleProjectId === id) {
      this.closeReportsSidebar(true);
      return;
    }
    this.sidebarVisibleProjectId = id;
    this.selectedProject = project;
    this.mobileFilterProject = project;
    this.syncSidebarProjects();
    this.syncUiFiltersFromProject(project);
    if (project.reports === undefined || project.reports === null) {
      this.loadProjectReports(project);
    } else {
      this.updateProjectDerivedData(project);
    }
    this.saveState();
    this.restoreMobileReportsSidebarScrollPosition(id);
  }

  private autoOpenMobileReportsSidebar(project: Project): void {
    if (!project?.id || typeof window === 'undefined') {
      return;
    }

    // Mobile-only behavior: selecting a project route should open its reports sidebar.
    if (window.innerWidth >= 1024) {
      return;
    }

    this.sidebarVisibleProjectId = String(project.id);
    this.mobileFilterProject = project;
    this.restoreMobileReportsSidebarScrollPosition(this.sidebarVisibleProjectId);
  }

  private closeReportsSidebarOnDesktop(): void {
    if (!this.isMobileReportsSidebarView() && this.sidebarVisibleProjectId) {
      this.closeReportsSidebar(true);
    }
  }

  closeReportsSidebar(force?: boolean): void {
    if (this.showReportsMobileFilter && !force) {
      return;
    }
    const wasOpen = !!this.sidebarVisibleProjectId;
    this.sidebarVisibleProjectId = null;
    this.selectedProject = null;
    this.syncSidebarProjects();
    if (wasOpen && this.client?.id) {
      const queryParams: Record<string, string> = {};
      if (this.statusFilter) {
        queryParams['status'] = this.statusFilter;
      }
      this.justCollapsed = true;
      this.router.navigate(['/clients', this.client.id], { queryParams });
    }
    if (wasOpen) {
      this.saveState();
    }
  }

  openProjectsMobileFilterSheet(): void {
    this.refreshProjectMobileFilterSheetState();
    this.showMobileProjectFilters = true;
  }

  private refreshProjectMobileFilterSheetState(): void {
    this.projectMobileColumns = [{ field: 'name', header: 'Projekt' }, ...(this.selectedColumns || []).map((col) => ({ field: col.field, header: col.header }))];

    const nextValues: { [key: string]: string[] } = {};
    const nextOptions: { [key: string]: { label: string; value: string }[] } = {};
    const nextCanFilter: { [key: string]: boolean } = {};

    nextValues['name'] = [...(this.projectColumnFilters['name'] || [])];
    nextOptions['name'] = (this.getProjectFilterOptions('name') || []).map((opt) => ({
      label: this.columnFilterOptionLabel(opt),
      value: opt,
    }));
    nextCanFilter['name'] = nextOptions['name'].length > 0 || nextValues['name'].length > 0;

    (this.selectedColumns || []).forEach((col) => {
      const field = col.field;
      nextValues[field] = [...(this.projectColumnFilters[field] || [])];
      nextOptions[field] = (this.getProjectFilterOptions(field) || []).map((opt) => ({
        label: this.columnFilterOptionLabel(opt),
        value: opt,
      }));
      nextCanFilter[field] = nextOptions[field].length > 0 || nextValues[field].length > 0;
    });

    this.projectMobileFilterValues = nextValues;
    this.projectMobileColumnOptions = nextOptions;
    this.projectMobileCanFilterMap = nextCanFilter;
  }

  onProjectsMobileFilterChanged(event: { field: string; values: string[] }): void {
    const f = event.field;
    const v = event.values || [];
    if (!this.projectColumnFilters[f]) {
      this.projectColumnFilters[f] = [];
    }
    this.projectColumnFilters[f] = [...v];
    this.projectMobileFilterValues[f] = [...v];
    this.projectMobileFilterValues = { ...this.projectMobileFilterValues };
    this.applyFilters();
    this.saveState();
  }

  onProjectsMobileFilterCleared(): void {
    this.projectColumnFilters = {
      name: [],
      formattedZeitraum: [],
      filialen: [],
      status: [],
    };
    this.projectMobileFilterValues = {};
    this.applyFilters();
    this.saveState();
  }

  onProjectSearchFromMobileSheet(term: string): void {
    this.projectSearchTerm = term;
    this.applyFilters();
    this.saveState();
  }

  onFilialeSearchFromMobileSheet(term: string): void {
    this.filialeSearchTerm = term;
    this.applyFilters();
    this.saveState();
  }

  getTotalProjectsActiveFilters(): number {
    let count = 0;
    Object.values(this.projectColumnFilters || {}).forEach((arr) => {
      count += (arr as string[])?.length || 0;
    });
    return count;
  }

  isProjectSidebarOpen(project: Project): boolean {
    if (!this.isMobileReportsSidebarView() || !project?.id || !this.sidebarVisibleProjectId) {
      return false;
    }
    return this.sidebarVisibleProjectId === String(project.id);
  }

  onMobileReportsSidebarScroll(projectId: string | number | undefined, event: Event): void {
    if (projectId === null || projectId === undefined) {
      return;
    }
    const target = event.target as HTMLElement | null;
    if (!target) {
      return;
    }
    this.mobileReportsSidebarScrollPositionByProject[String(projectId)] = target.scrollTop || 0;
  }

  private captureMobileReportsSidebarScrollPosition(projectId?: string | number): void {
    const id = projectId ?? this.sidebarVisibleProjectId;
    if (id === null || id === undefined) {
      return;
    }
    const key = String(id);
    const sidebarScrollContainer = document.querySelector(`.reports-sidebar-mobile [data-mobile-project-id="${key}"]`) as HTMLElement | null;
    if (sidebarScrollContainer) {
      this.mobileReportsSidebarScrollPositionByProject[key] = sidebarScrollContainer.scrollTop || 0;
    }
  }

  private restoreMobileReportsSidebarScrollPosition(projectId?: string | number): void {
    const id = projectId ?? this.sidebarVisibleProjectId;
    if (id === null || id === undefined) {
      return;
    }

    const key = String(id);
    const targetPosition = this.mobileReportsSidebarScrollPositionByProject[key] ?? 0;
    if (targetPosition <= 0) {
      return;
    }

    let attempts = 0;
    const maxAttempts = 80;
    const tryRestore = () => {
      const sidebarScrollContainer = document.querySelector(`.reports-sidebar-mobile [data-mobile-project-id="${key}"]`) as HTMLElement | null;
      if (sidebarScrollContainer) {
        sidebarScrollContainer.scrollTop = targetPosition;
        requestAnimationFrame(() => {
          sidebarScrollContainer.scrollTop = targetPosition;
        });
        return;
      }

      if (attempts < maxAttempts) {
        attempts++;
        setTimeout(tryRestore, 20);
      }
    };

    setTimeout(tryRestore, 0);
  }

  rememberSidebarStateBeforeReportNavigation(report: Report, project?: Project): void {
    if (!this.isMobileReportsSidebarView()) {
      this.saveState();
      return;
    }
    const projectId = project?.id ?? report?.project?.id ?? this.sidebarVisibleProjectId;
    if (projectId !== undefined && projectId !== null) {
      this.sidebarVisibleProjectId = String(projectId);
      this.captureMobileReportsSidebarScrollPosition(projectId);
    }
    this.saveState();
  }

  openReportsMobileFilterSheet(project?: Project): void {
    const resolved =
      project || this.mobileFilterProject || this.selectedProject || (this.sidebarVisibleProjectId ? this.projects?.find((p) => p.id?.toString() === this.sidebarVisibleProjectId) : null);
    if (!resolved) return;
    this.mobileFilterProject = resolved;
    this.selectedProject = resolved;
    this.syncUiFiltersFromProject(resolved);

    // 1. Build columns
    this.reportMobileColumns = [{ field: 'status', header: 'Status' }, ...(this.selectedReportColumns || this.reportCols || []).map((col) => ({ field: col.field, header: col.header }))].filter(
      (col) => col.field !== 'feedback',
    );

    // 2. Build filter values based on project._reportFilters
    this.reportMobileFilterValues = { ...this.genericFilterValues };
    this.reportMobileFilterValues['status'] = resolved._reportFilters?.status || [];
    this.reportMobileFilterValues['plannedOn'] = resolved._reportFilters?.plannedOn || [];
    this.reportMobileFilterValues['merchandiser'] = resolved._reportFilters?.merchandiser || [];
    this.reportMobileFilterValues['branch.name'] = resolved._reportFilters?.filialen || [];
    this.reportMobileFilterValues['reportTo'] = resolved._reportFilters?.reportTo || [];

    if (resolved._reportFilters?.generic) {
      Object.keys(resolved._reportFilters.generic).forEach((k) => {
        this.reportMobileFilterValues[k] = resolved._reportFilters?.generic[k] || [];
      });
    }

    // 3. Build options (must be { label, value }[] for p-listbox optionLabel/optionValue)
    this.reportMobileColumnOptions['status'] = this.mapReportStatusToListOptions(this.getUniqueReportStatuses(resolved));
    this.reportMobileCanFilterMap['status'] = this.filteredReports(resolved).length > 0 || this.hasActiveReportFilterFor(resolved, 'status');

    this.reportMobileColumnOptions['plannedOn'] = this.mapReportFilterStringsToListOptions(this.getUniquePlannedOnDates(resolved));
    this.reportMobileCanFilterMap['plannedOn'] = this.filteredReports(resolved).length > 0 || this.hasActiveReportFilterFor(resolved, 'plannedOn');

    this.reportMobileColumnOptions['merchandiser'] = this.mapReportFilterStringsToListOptions(this.getUniqueMerchandisers(resolved));
    this.reportMobileCanFilterMap['merchandiser'] = this.filteredReports(resolved).length > 0 || this.hasActiveReportFilterFor(resolved, 'merchandiser');

    this.reportMobileColumnOptions['branch.name'] = this.mapReportFilterStringsToListOptions(this.getUniqueFilialen(resolved));
    this.reportMobileCanFilterMap['branch.name'] = this.filteredReports(resolved).length > 0 || this.hasActiveReportFilterFor(resolved, 'filialen');

    this.reportMobileColumnOptions['reportTo'] = this.mapReportFilterStringsToListOptions(this.getUniqueReportToDates(resolved));
    this.reportMobileCanFilterMap['reportTo'] = this.filteredReports(resolved).length > 0 || this.hasActiveReportFilterFor(resolved, 'reportTo');

    (this.selectedReportColumns || this.reportCols || []).forEach((col) => {
      const f = col.field;
      if (f !== 'plannedOn' && f !== 'merchandiser' && f !== 'branch.name' && f !== 'reportTo' && f !== 'feedback') {
        this.reportMobileColumnOptions[f] = this.mapReportFilterStringsToListOptions(this.getUniqueValuesForField(f, resolved));
        this.reportMobileCanFilterMap[f] = this.filteredReports(resolved).length > 0 || this.hasActiveReportFilterFor(resolved, 'generic', f);
      }
    });

    this.showReportsMobileFilter = true;
  }

  onReportsMobileFilterChanged(event: { field: string; values: string[] }): void {
    const projectToUse = this.mobileFilterProject || this.selectedProject || (this.sidebarVisibleProjectId ? this.projects?.find((p) => p.id?.toString() === this.sidebarVisibleProjectId) : null);
    if (!projectToUse) return;
    if (!projectToUse._reportFilters) projectToUse._reportFilters = this.cloneProjectFilters(this.defaultReportFilters);

    const f = event.field;
    const v = event.values;

    if (f === 'status') projectToUse._reportFilters.status = v;
    else if (f === 'plannedOn') projectToUse._reportFilters.plannedOn = v;
    else if (f === 'merchandiser') projectToUse._reportFilters.merchandiser = v;
    else if (f === 'branch.name') projectToUse._reportFilters.filialen = v;
    else if (f === 'reportTo') projectToUse._reportFilters.reportTo = v;
    else projectToUse._reportFilters.generic[f] = v;

    this.applyFilters();
    this.syncUiFiltersFromProject(projectToUse);

    this.reportMobileFilterValues[f] = v;
    this.reportMobileFilterValues = { ...this.reportMobileFilterValues };

    this.saveState();
  }

  onReportsMobileFilterCleared(): void {
    const projectToUse = this.mobileFilterProject || this.selectedProject || (this.sidebarVisibleProjectId ? this.projects?.find((p) => p.id?.toString() === this.sidebarVisibleProjectId) : null);
    if (!projectToUse) return;

    projectToUse._reportFilters = this.cloneProjectFilters(this.defaultReportFilters);
    this.applyFilters();
    this.syncUiFiltersFromProject(projectToUse);

    this.reportMobileFilterValues = {};

    this.saveState();
  }

  getTotalReportsActiveFiltersForSheet(): number {
    if (!this.reportMobileFilterValues) return 0;
    let count = 0;
    Object.values(this.reportMobileFilterValues).forEach((arr: any) => {
      count += arr?.length || 0;
    });
    return count;
  }

  getTotalReportsActiveFilters(project: Project): number {
    if (!project) return 0;
    let count = 0;

    const filters = this.getProjectReportFilters(project);
    if (filters.status) count += filters.status.length;
    if (filters.plannedOn) count += filters.plannedOn.length;
    if (filters.merchandiser) count += filters.merchandiser.length;
    if (filters.filialen) count += filters.filialen.length;
    if (filters.reportTo) count += filters.reportTo.length;

    if (filters.generic) {
      Object.keys(filters.generic).forEach((k) => {
        if (filters.generic[k]) {
          count += filters.generic[k].length;
        }
      });
    }

    return count;
  }
}
