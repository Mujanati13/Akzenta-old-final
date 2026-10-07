import { animate, state, style, transition, trigger } from '@angular/animations';
import { Component, OnInit, OnDestroy, AfterViewInit, ViewChild, ViewChildren, QueryList, ElementRef, HostListener, ChangeDetectionStrategy, ChangeDetectorRef, Renderer2 } from '@angular/core';
import { ActivatedRoute, Router, ParamMap, NavigationStart } from '@angular/router';
import { Location } from '@angular/common';
import { ClientService } from '@core/services/client.service';
import { ClientCompanyService, ClientCompany } from '@app/core/services/client-company.service';
import { TableRowCollapseEvent, TableRowExpandEvent } from 'primeng/table';
import { Dropdown } from 'primeng/dropdown';
import { MultiSelect } from 'primeng/multiselect';
import { HotToastService } from '@ngxpert/hot-toast';
import * as Papa from 'papaparse';
import { ProjectService } from '@app/core/services/project.service';
import { ReportService } from '@app/core/services/report.service';
import { ReportCacheService } from '@app/core/services/report-cache.service';
import { MerchandiserService, Merchandiser } from '@app/core/services/merchandiser.service';
import * as XLSX from 'xlsx-js-style';
import { Subject, Subscription } from 'rxjs';
import { catchError, finalize, of, take, takeUntil } from 'rxjs';
import { ReportStatusEnum } from '@core/enums/status.enum';
import { categorizeReportForAkzente, isAkzenteReportClosed } from '@core/utils/report-akzente-status.util';
import { ClientDetailStateService } from './client-detail-state.service';
import { formatReportAddress } from './client-detail.pipes';
import { DateRangePickerComponent } from '@app/shared/components/date-range-picker/date-range-picker.component';

export interface Report {
  id?: number;
  project?: {
    id?: number;
    name?: string;
    startDate?: string;
    endDate?: string;
    createdAt?: string;
    updatedAt?: string;
    slug?: string;
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
    branchNumber?: string | null;
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
  street?: string; // <-- add this
  zipCode?: string; // <-- add this
  address?: string;
  plannedOn?: string;
  note?: string;
  reportTo?: string;
  feedback?: string | boolean;
  isFavorite?: boolean;
  accepted?: boolean;
  createdAt?: string;
  updatedAt?: string;
  merchandiser?: any; // <-- add this
  answers?: Answer[];
}

export interface Question {
  id: number;
  questionText: string;
  showInOverview: boolean;
  order: number;
}

export interface Answer {
  id: number;
  questionId: number;
  value: any;
  question: Question;
}

export interface Project {
  id?: string;
  name?: string;
  zeitraum?: string;
  calendarWeek?: string;
  filialen?: number;
  status?: string;
  isFavorite?: boolean;
  reports?: Report[];
  slug?: string;
  branchesCount?: number;
  reportedPercentage?: number;
  isExpanded?: boolean;
  _reportsLoaded?: boolean;
  _displayedFilialen?: number;
  startDate?: string;
  endDate?: string;
  _filteredReports?: Report[];
  _reportFilters?: ProjectReportFilters;
  questions?: Question[];
}

interface Column {
  field: string;
  header: string;
}

interface ReportFilterCacheEntry {
  reportsRef: Report[];
  signature: string;
  filteredReports: Report[];
}

interface ProjectReportFilters {
  status: string[];
  merchandiser: string[];
  filialen: string[];
  plannedOn: string[];
  generic: { [field: string]: string[] };
}

const COLUMN_FILTER_EMPTY_LABEL = '--';

@Component({
  selector: 'app-client-detail',
  templateUrl: './client-detail.component.html',
  styleUrls: ['./client-detail.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [
    trigger('expandCollapse', [
      state(
        'collapsed',
        style({
          height: '0px',
          opacity: 0,
          visibility: 'hidden',
          transform: 'scaleY(0.95)',
        }),
      ),
      state(
        'expanded',
        style({
          height: '*',
          opacity: 1,
          visibility: 'visible',
          transform: 'scaleY(1)',
        }),
      ),
      transition('collapsed => expanded', [
        style({
          height: '0px',
          opacity: 0,
          visibility: 'hidden',
          transform: 'scaleY(0.95)',
        }),
        animate('220ms cubic-bezier(0.4, 0, 0.2, 1)'),
      ]),
      transition('expanded => collapsed', [
        animate(
          '200ms cubic-bezier(0.4, 0, 0.2, 1)',
          style({
            height: '0px',
            opacity: 0,
            visibility: 'hidden',
            transform: 'scaleY(0.95)',
          }),
        ),
      ]),
    ]),
    trigger('fadeSlide', [
      transition(':enter', [style({ opacity: 0, transform: 'translateY(6px)' }), animate('200ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))]),
      transition(':leave', [animate('160ms ease-in', style({ opacity: 0, transform: 'translateY(6px)' }))]),
    ]),
  ],
  standalone: false,
})
export class ClientDetailComponent implements OnInit, OnDestroy, AfterViewInit {
  client: ClientCompany | undefined;
  projects!: Project[];
  selectedProject!: Project | null;
  expandedRows: { [key: string]: boolean } = {};
  cols!: Column[];
  selectedColumns!: Column[];
  dateRange: Date[] = [];

  // Check if can go back (has navigation history)
  canGoBack: boolean = false;

  // --- Mobile Filter Bottom Sheet properties ---
  showReportsMobileFilter = false;
  reportMobileColumns: any[] = [];
  reportMobileFilterValues: any = {};
  reportMobileColumnOptions: any = {};
  reportMobileCanFilterMap: any = {};

  // Add filter properties
  clientSearchTerm: string = '';
  projectSearchTerm: string = '';
  filialeSearchTerm: string = '';
  filteredProjects: Project[] = [];

  // Status parameter from query string
  statusFilter: string = '';

  // Report status column filter
  reportStatusFilter: string[] = [];

  // Report merchandiser column filter
  reportMerchandiserFilter: string[] = [];

  // Report filialen (branch) column filter
  reportFilialenFilter: string[] = [];

  // Report plannedOn date column filter
  reportPlannedOnFilter: string[] = [];

  // Project name column filter
  projectNameFilter: string[] = [];

  // Generic filters for project columns
  projectColumnFilterValues: { [field: string]: string[] } = {};
  currentProjectFilterField: string = '';

  // Generic filters for other columns
  genericFilterValues: { [field: string]: string[] } = {};
  currentFilterField: string = '';

  // Mobile filters toggle
  showMobileFilters = false;

  projectMobileColumns: any[] = [];
  projectMobileFilterValues: { [key: string]: string[] } = {};
  projectMobileColumnOptions: { [key: string]: any[] } = {};
  projectMobileCanFilterMap: { [key: string]: boolean } = {};
  showMobileProjectFilters = false;

  // Cached filter options
  projectNamesOptions: { label: string; value: string }[] = [];
  reportStatusOptions: { label: string; value: string; color: string }[] = [];
  merchandiserOptions: { label: string; value: string }[] = [];
  filialenOptions: { label: string; value: string }[] = [];
  plannedOnOptions: { label: string; value: string }[] = [];
  currentProjectColumnOptions: { label: string; value: string }[] = [];
  currentGenericOptions: { label: string; value: string }[] = [];

  // Mobile column filter modal (centered dialog on small screens, same as dashboard)
  showColumnFilterModal = false;
  columnFilterModalType: 'projectName' | 'project' | 'reportStatus' | 'reportMerchandiser' | 'reportFilialen' | 'reportPlannedOn' | 'reportGeneric' | null = null;

  // Default values applied when a project has no stored column filters (populated from query/cache)
  private defaultReportFilters: ProjectReportFilters = {
    status: [],
    merchandiser: [],
    filialen: [],
    plannedOn: [],
    generic: {},
  };

  dateRange2 = { start: null, end: null };
  /** Von–Bis filter for report Geplant (opened from the Geplant column header). */
  plannedOnDateRange = { start: null as Date | null, end: null as Date | null };

  // Loading state for initial page load
  isLoading: boolean = false;
  error: boolean = false;
  contentAnimationReady: boolean = false;

  // Loading state for project reports
  loadingReports: { [projectId: string]: boolean } = {};
  downloadingExcel: { [projectId: string]: boolean } = {};
  private reportLoadingTimers: { [projectId: string]: number } = {};
  reportLoadDurations: { [projectId: string]: number } = {};
  reportLoadSources: { [projectId: string]: 'api' | 'cache' | 'alreadyLoaded' | 'error' } = {};
  private reportFilterCache: Map<string, ReportFilterCacheEntry> = new Map();

  private normalizeColumnFilterValue(value: string | null | undefined): string {
    const normalized = (value ?? '').toString().trim();
    return normalized === '-' ? '' : normalized;
  }

  /**
   * Store count used by project "Filialen" column filter and its option list.
   * Keep this aligned with the count shown in the table to avoid mismatches.
   */
  private getProjectStoresCountForFilter(project: Project): number {
    const count = project._displayedFilialen ?? project.branchesCount ?? project.filialen ?? 0;
    return Number.isFinite(count) ? Number(count) : 0;
  }

  private getColumnFilterOptionLabel(value: string, emptyLabel: string = COLUMN_FILTER_EMPTY_LABEL): string {
    return value ? value : emptyLabel;
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
  excelUploadInProgress = false;
  excelUploadProjectId: string | null = null;

  // Debounce timer for search inputs
  private searchDebounceTimer: any = null;
  private readonly SEARCH_DEBOUNCE_MS = 200;

  private triggerContentAnimation(): void {
    this.contentAnimationReady = false;

    const activate = () => {
      this.contentAnimationReady = true;
      this.cdr.markForCheck();
    };

    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(() => window.requestAnimationFrame(activate));
    } else {
      setTimeout(activate, 0);
    }
  }

  private now(): number {
    if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
      return performance.now();
    }
    return Date.now();
  }

  private startReportLoadTimer(projectId: string): void {
    this.reportLoadingTimers[projectId] = this.now();
    this.loadingReports[projectId] = true;
  }

  private clearReportLoadTimer(projectId: string): number | undefined {
    const start = this.reportLoadingTimers[projectId];
    delete this.reportLoadingTimers[projectId];
    return start;
  }

  // Set to true to enable debug logging (disable for production)
  private readonly DEBUG_LOGGING = false;

  private logDebug(message: string, data?: Record<string, unknown>): void {
    if (!this.DEBUG_LOGGING) return;
  }

  private logDuration(message: string, start: number, data?: Record<string, unknown>): void {
    if (!this.DEBUG_LOGGING) return;
    const duration = this.now() - start;
    this.logDebug(`${message} (${duration.toFixed(2)} ms)`, data);
  }

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

  private isDateRangeActive(): boolean {
    return !!this.dateRange2.start && !!this.dateRange2.end;
  }

  private getUiFiltersAsProjectFilters(): ProjectReportFilters {
    return {
      status: [...this.reportStatusFilter],
      merchandiser: [...this.reportMerchandiserFilter],
      filialen: [...this.reportFilialenFilter],
      plannedOn: [...this.reportPlannedOnFilter],
      generic: this.cloneGenericFilters(this.genericFilterValues),
    };
  }

  private updateDefaultReportFiltersFromUi(): void {
    this.defaultReportFilters = this.cloneProjectFilters(this.getUiFiltersAsProjectFilters());
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
    this.reportMerchandiserFilter = [...filters.merchandiser];
    this.reportFilialenFilter = [...filters.filialen];
    this.reportPlannedOnFilter = [...filters.plannedOn];
    this.genericFilterValues = this.cloneGenericFilters(filters.generic);
  }

  private persistUiFiltersToProject(project?: Project | null): void {
    const targetProject = project || this.selectedProject;
    if (targetProject) {
      const filters = this.getProjectReportFilters(targetProject);
      filters.status = [...this.reportStatusFilter];
      filters.merchandiser = [...this.reportMerchandiserFilter];
      filters.filialen = [...this.reportFilialenFilter];
      filters.plannedOn = [...this.reportPlannedOnFilter];
      filters.generic = this.cloneGenericFilters(this.genericFilterValues);
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

  private hasAnyReportFilter(filters: ProjectReportFilters): boolean {
    if (!filters) {
      return false;
    }
    const hasGeneric = Object.keys(filters.generic || {}).some((key) => (filters.generic?.[key] || []).length > 0);
    return (
      (filters.status && filters.status.length > 0) ||
      (filters.merchandiser && filters.merchandiser.length > 0) ||
      (filters.filialen && filters.filialen.length > 0) ||
      (filters.plannedOn && filters.plannedOn.length > 0) ||
      hasGeneric
    );
  }

  private buildFilterQueryParams(overrides: Record<string, any> = {}, project?: Project | null): Record<string, any> {
    const projectForFilters = project || this.selectedProject;
    const filtersForUrl = this.getProjectReportFilters(projectForFilters);
    const params: Record<string, any> = {
      status: this.statusFilter || undefined,
      clientSearch: this.clientSearchTerm || undefined,
      projectSearch: this.projectSearchTerm || undefined,
      filialeSearch: this.filialeSearchTerm || undefined,
      reportStatusFilter: filtersForUrl.status && filtersForUrl.status.length > 0 ? [...filtersForUrl.status] : undefined,
      reportMerchandiserFilter: filtersForUrl.merchandiser && filtersForUrl.merchandiser.length > 0 ? [...filtersForUrl.merchandiser] : undefined,
      reportFilialenFilter: filtersForUrl.filialen && filtersForUrl.filialen.length > 0 ? [...filtersForUrl.filialen] : undefined,
      reportPlannedOnFilter: filtersForUrl.plannedOn && filtersForUrl.plannedOn.length > 0 ? [...filtersForUrl.plannedOn] : undefined,
      projectNameFilter: this.projectNameFilter && this.projectNameFilter.length > 0 ? [...this.projectNameFilter] : undefined,
      startDate: this.dateRange2.start ? this.dateRange2.start.toISOString().split('T')[0] : undefined,
      endDate: this.dateRange2.end ? this.dateRange2.end.toISOString().split('T')[0] : undefined,
    };

    // Add project column filters
    Object.keys(this.projectColumnFilterValues).forEach((key) => {
      const values = this.projectColumnFilterValues[key];
      if (values && values.length > 0) {
        params[`pcf_${key}`] = [...values];
      }
    });

    // Add generic filters
    Object.keys(filtersForUrl.generic).forEach((key) => {
      const values = filtersForUrl.generic[key];
      if (values && values.length > 0) {
        params[`gf_${key}`] = [...values];
      }
    });

    return this.cleanQueryParams({ ...params, ...overrides });
  }

  private removeFilterQueryParams(): void {
    const currentParams = { ...this.route.snapshot.queryParams };
    const filterKeys = [
      'status',
      'clientSearch',
      'projectSearch',
      'filialeSearch',
      'reportStatusFilter',
      'reportMerchandiserFilter',
      'reportFilialenFilter',
      'reportPlannedOnFilter',
      'projectNameFilter',
      'startDate',
      'endDate',
    ];

    Object.keys(currentParams).forEach((key) => {
      if (filterKeys.includes(key) || key.startsWith('pcf_') || key.startsWith('gf_')) {
        delete currentParams[key];
      }
    });

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: currentParams,
      queryParamsHandling: '',
      replaceUrl: true,
    });
  }

  private cleanQueryParams(params: Record<string, any>): Record<string, any> {
    const cleaned: Record<string, any> = {};

    Object.entries(params).forEach(([key, value]) => {
      if (value === null || value === undefined) {
        return;
      }

      if (Array.isArray(value)) {
        const filtered = value.map((entry) => (typeof entry === 'string' ? entry.trim() : entry)).filter((entry) => entry !== undefined && entry !== null && entry !== '' && entry !== 'null');

        if (filtered.length > 0) {
          cleaned[key] = filtered;
        }
        return;
      }

      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed !== '' && trimmed !== 'null') {
          cleaned[key] = trimmed;
        }
        return;
      }

      cleaned[key] = value;
    });

    return cleaned;
  }

  private extractArrayQueryParam(queryParamMap: ParamMap, key: string): string[] {
    const values = queryParamMap
      .getAll(key)
      .map((val) => val?.trim())
      .filter((val): val is string => !!val && val !== 'null');

    if (values.length > 0) {
      return values;
    }

    const single = queryParamMap.get(key)?.trim();
    if (single && single !== 'null') {
      return single
        .split(',')
        .map((val) => val.trim())
        .filter((val) => val !== '');
    }

    return [];
  }

  private restoreFiltersFromQuery(queryParamMap: ParamMap, preserveExisting: boolean = false): void {
    // Only update filters that are present in query params
    // If preserveExisting is true, don't overwrite with empty values
    const status = queryParamMap.get('status');
    const hasAdditionalFilterParams = queryParamMap.keys.some((key) => {
      if (key === 'status') {
        return false;
      }
      return (
        key === 'clientSearch' ||
        key === 'projectSearch' ||
        key === 'filialeSearch' ||
        key === 'reportStatusFilter' ||
        key === 'reportMerchandiserFilter' ||
        key === 'reportFilialenFilter' ||
        key === 'reportPlannedOnFilter' ||
        key === 'projectNameFilter' ||
        key === 'startDate' ||
        key === 'endDate' ||
        key.startsWith('pcf_') ||
        key.startsWith('gf_')
      );
    });

    if (status && status !== 'null') {
      this.statusFilter = status;
      // Only do a hard reset for a pure status-link entry state.
      // During interactive filtering (or when preserving existing state),
      // keep active filters intact so they are not wiped by query-param updates.
      if (!preserveExisting && !hasAdditionalFilterParams) {
        this.reportStatusFilter = [];
        this.reportMerchandiserFilter = [];
        this.reportFilialenFilter = [];
        this.reportPlannedOnFilter = [];
        this.genericFilterValues = {};
        this.projectColumnFilterValues = {};
        this.projectNameFilter = [];
        this.clientSearchTerm = '';
        this.projectSearchTerm = '';
        this.filialeSearchTerm = '';
        this.dateRange2 = { start: null, end: null };
        this.plannedOnDateRange = { start: null, end: null };
        // Reset per-project stored filters to prevent leakage
        this.defaultReportFilters = {
          status: [],
          merchandiser: [],
          filialen: [],
          plannedOn: [],
          generic: {},
        };
        if (Array.isArray(this.projects)) {
          this.projects.forEach((proj) => {
            if (proj) {
              proj._reportFilters = this.cloneProjectFilters(this.defaultReportFilters);
            }
          });
        }
      }
    } else if (!preserveExisting) {
      this.statusFilter = '';
    }

    const clientSearch = queryParamMap.get('clientSearch');
    if (clientSearch && clientSearch !== 'null') {
      this.clientSearchTerm = clientSearch.toLowerCase();
    } else if (!preserveExisting) {
      this.clientSearchTerm = '';
    }

    const projectSearch = queryParamMap.get('projectSearch');
    if (projectSearch && projectSearch !== 'null') {
      this.projectSearchTerm = projectSearch.toLowerCase();
    } else if (!preserveExisting) {
      this.projectSearchTerm = '';
    }

    const filialeSearch = queryParamMap.get('filialeSearch');
    if (filialeSearch && filialeSearch !== 'null') {
      this.filialeSearchTerm = filialeSearch.toLowerCase();
    } else if (!preserveExisting) {
      this.filialeSearchTerm = '';
    }

    const reportStatusFilter = this.extractArrayQueryParam(queryParamMap, 'reportStatusFilter');
    if (reportStatusFilter.length > 0) {
      this.reportStatusFilter = reportStatusFilter;
    } else if (!preserveExisting) {
      this.reportStatusFilter = [];
    }

    const reportMerchandiserFilter = this.extractArrayQueryParam(queryParamMap, 'reportMerchandiserFilter');
    if (reportMerchandiserFilter.length > 0) {
      this.reportMerchandiserFilter = reportMerchandiserFilter;
    } else if (!preserveExisting) {
      this.reportMerchandiserFilter = [];
    }

    const reportFilialenFilter = this.extractArrayQueryParam(queryParamMap, 'reportFilialenFilter');
    if (reportFilialenFilter.length > 0) {
      this.reportFilialenFilter = reportFilialenFilter;
    } else if (!preserveExisting) {
      this.reportFilialenFilter = [];
    }

    const reportPlannedOnFilter = this.extractArrayQueryParam(queryParamMap, 'reportPlannedOnFilter');
    if (reportPlannedOnFilter.length > 0) {
      this.reportPlannedOnFilter = reportPlannedOnFilter;
    } else if (!preserveExisting) {
      this.reportPlannedOnFilter = [];
    }

    const projectNameFilter = this.extractArrayQueryParam(queryParamMap, 'projectNameFilter');
    if (projectNameFilter.length > 0) {
      this.projectNameFilter = projectNameFilter;
    } else if (!preserveExisting) {
      this.projectNameFilter = [];
    }

    // Restore project column filters
    const pcfKeys = queryParamMap.keys.filter((key) => key.startsWith('pcf_'));
    if (pcfKeys.length > 0) {
      pcfKeys.forEach((key) => {
        const field = key.substring(4); // remove 'pcf_'
        const values = this.extractArrayQueryParam(queryParamMap, key);
        if (values.length > 0) {
          this.projectColumnFilterValues[field] = values;
        }
      });
    } else if (!preserveExisting) {
      this.projectColumnFilterValues = {};
    }

    // Restore generic filters
    const gfKeys = queryParamMap.keys.filter((key) => key.startsWith('gf_'));
    if (gfKeys.length > 0) {
      gfKeys.forEach((key) => {
        const field = key.substring(3); // remove 'gf_'
        const values = this.extractArrayQueryParam(queryParamMap, key);
        if (values.length > 0) {
          this.genericFilterValues[field] = values;
        }
      });
    } else if (!preserveExisting) {
      this.genericFilterValues = {};
    }

    // Restore date range - only update if present in query params
    const startDate = queryParamMap.get('startDate');
    const endDate = queryParamMap.get('endDate');
    if (startDate && startDate !== 'null') {
      this.dateRange2.start = new Date(startDate);
    } else if (!preserveExisting) {
      this.dateRange2.start = null;
    }
    if (endDate && endDate !== 'null') {
      this.dateRange2.end = new Date(endDate);
    } else if (!preserveExisting) {
      this.dateRange2.end = null;
    }

    // Align default per-project filters with the values restored from query params
    this.updateDefaultReportFiltersFromUi();
  }

  private navigateWithFilters(commands: any[], overrides: Record<string, any> = {}, options: { replaceUrl?: boolean } = {}): void {
    const queryParams = this.buildFilterQueryParams(overrides);
    const extras: any = {};

    if (Object.keys(queryParams).length > 0) {
      extras.queryParams = queryParams;
    }

    if (options.replaceUrl) {
      extras.replaceUrl = true;
    }

    this.router.navigate(commands, extras);
  }

  getReportNavigationQueryParams(report?: Report): Record<string, any> {
    const overrides: Record<string, any> = {
      referrer: 'client-detail',
    };
    const projectFromReport = report?.project?.id ? this.projects?.find((p) => p.id?.toString() === report.project?.id?.toString() || p.slug === report.project?.slug) : this.selectedProject;
    return this.buildFilterQueryParams(overrides, projectFromReport);
  }

  getEditReportNavigationQueryParams(report?: Report): Record<string, any> {
    const params = this.getReportNavigationQueryParams(report);
    // referrer is already 'client-detail' from getReportNavigationQueryParams
    return params;
  }

  // Helper to get tooltip value for a cell

  @ViewChild('dateRangePicker', { static: false, read: ElementRef }) dateRangePickerRef: ElementRef;
  @ViewChild('plannedOnDateRangePicker') plannedOnDateRangePicker?: DateRangePickerComponent;

  onRangeSelected(range: { start: Date | null; end: Date | null }) {
    this.dateRange2 = range;

    // Re-apply filters so date range affects all projects/reports
    this.applyFilters();

    // Save state after date range change
    if (this.client?.id) {
      this.scheduleStateSave();
    }
  }

  onPlannedOnRangeSelected(range: { start: Date | null; end: Date | null }): void {
    this.plannedOnDateRange = range;
    this.applyFilters();

    if (this.client?.id) {
      this.scheduleStateSave();
    }
  }

  private isPlannedOnDateRangeActive(): boolean {
    return !!this.plannedOnDateRange.start && !!this.plannedOnDateRange.end;
  }

  private isReportInPlannedOnDateRange(report: Report): boolean {
    if (!this.isPlannedOnDateRangeActive()) {
      return true;
    }

    if (!report.plannedOn) {
      return false;
    }

    const reportYmd = this.normalizeDateToYmd(report.plannedOn);
    const filterStart = this.normalizeDateToYmd(this.plannedOnDateRange.start);
    const filterEnd = this.normalizeDateToYmd(this.plannedOnDateRange.end);

    if (!reportYmd || !filterStart || !filterEnd) {
      return false;
    }

    return reportYmd >= filterStart && reportYmd <= filterEnd;
  }

  /**
   * Reload reports for all expanded projects without date filtering
   */
  private reloadReportsForExpandedProjects(): void {
    const start = this.now();
    this.logDebug('reloadReportsForExpandedProjects start', {
      expandedCount: Object.keys(this.expandedRows || {}).length,
    });
    // Reload reports for the selected project if it exists
    if (this.selectedProject && this.selectedProject.id) {
      this.loadProjectReports(this.selectedProject, { forceRefresh: true });
    }

    // Reload reports for all other expanded projects
    Object.keys(this.expandedRows).forEach((projectId) => {
      if (this.expandedRows[projectId] && projectId !== this.selectedProject?.id?.toString()) {
        const project = this.projects.find((p) => p.id?.toString() === projectId);
        if (project && project.id) {
          this.loadProjectReports(project, { forceRefresh: true });
        }
      }
    });
    this.logDuration('reloadReportsForExpandedProjects finished', start, {
      expandedCount: Object.keys(this.expandedRows || {}).length,
    });
  }

  openPlannedOnDateFilter(event: Event) {
    event.stopPropagation();
    event.preventDefault();

    setTimeout(() => {
      this.plannedOnDateRangePicker?.togglePicker();
    }, 0);
  }

  onPlannedOnColumnClick(event: Event, project?: Project) {
    if (project) {
      this.selectedProject = project;
    }
    event.stopPropagation();
    this.openPlannedOnDateFilter(event);
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

  @ViewChild('datePickerButton') datePickerButton: ElementRef;
  @ViewChild('datePickerContent') datePickerContent: ElementRef;
  isDatePickerOpen = false;

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;

    // Handle date picker closing
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

    // Handle popover closing
    // Check if click is inside a popover panel
    const isClickInsidePopover = target.closest('.p-popover') !== null || target.closest('[data-pc-section="content"]') !== null;

    // Check if click is on a filter icon (SVG with filter icon)
    const isClickOnFilterIcon = target.closest('svg[stroke="currentColor"]') !== null && target.closest('svg[stroke="currentColor"]')?.closest('.cursor-pointer') !== null;

    // Check if click is on PrimeNG multiselect, dropdown, listbox, dialog, or popover (same logic as dashboard)
    const isClickOnPrimeComponent =
      target.closest('p-multiselect') !== null ||
      target.closest('p-dropdown') !== null ||
      target.closest('p-listbox') !== null ||
      target.closest('p-dialog') !== null ||
      target.closest('p-popover') !== null ||
      target.closest('.p-multiselect') !== null ||
      target.closest('.p-dropdown') !== null ||
      target.closest('.p-listbox') !== null ||
      target.closest('.p-dialog') !== null ||
      target.closest('.p-multiselect-panel') !== null ||
      target.closest('.p-dropdown-panel') !== null;

    // If click is not inside popover, not on filter icon, and not on PrimeNG component, close all popovers
    if (!isClickInsidePopover && !isClickOnFilterIcon && !isClickOnPrimeComponent) {
      this.closeAllFilterPopovers();
    }
  }

  myDate: Date | null = null;

  // Add these new properties for nested table columns
  reportCols!: Column[];
  selectedReportColumns!: Column[];

  // Add these properties
  @ViewChild('csvFileInput') csvFileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('excelFileInput') excelFileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('excelTestFileInput') excelTestFileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('genericFilterPopover') genericFilterPopover: any;
  @ViewChild('projectColumnFilterPopover') projectColumnFilterPopover: any;
  @ViewChild('statusFilterPopover') statusFilterPopover: any;
  @ViewChild('merchandiserFilterPopover') merchandiserFilterPopover: any;
  @ViewChild('filialenFilterPopover') filialenFilterPopover: any;
  @ViewChild('plannedOnFilterPopover') plannedOnFilterPopover: any;
  @ViewChild('projectFilterPopover') projectFilterPopover: any;
  @ViewChild('projectSettingsPopover') projectSettingsPopover: any;
  @ViewChild('reportSettingsPopover') reportSettingsPopover: any;
  @ViewChild('projectColumnsMultiSelect') projectColumnsMultiSelect?: MultiSelect;
  @ViewChild('reportColumnsMultiSelect') reportColumnsMultiSelect?: MultiSelect;
  @ViewChildren('merchandiserEditDropdown') editDropdowns!: QueryList<Dropdown>;

  private _projectsTable: any;
  private tableScrollListener: (() => void) | null = null;
  private reportsTableScrollListener: (() => void) | null = null;
  private windowScrollListener: (() => void) | null = null;
  private windowScrollPosition = 0;
  private tableScrollPosition = 0;
  private reportsTableScrollPosition = 0;
  private reportsTableScrollPositionByProject: { [projectId: string]: number } = {};
  private mobileReportsSidebarScrollPositionByProject: { [projectId: string]: number } = {};
  private _scrollRestorationDone = false;
  private _restoreScrollId = 0;
  private _deferScrollToRefresh = false;
  private readonly destroy$ = new Subject<void>();
  private loadSequence = 0;
  private routerSubscription: Subscription | null = null;
  private resetSubscription: Subscription | null = null;
  private nextUrl: string | null = null;

  @ViewChild('projectsTable', { static: false })
  set projectsTable(value: any) {
    this._projectsTable = value;
    if (value) {
      this.restoreTableScrollPosition();
    }
  }

  get projectsTable(): any {
    return this._projectsTable;
  }

  private activeFilterPopover: any = null;
  private activeFilterId: string | null = null;
  private activeSettingsPopover: any = null;
  private filterPopoverTimeout: any = null;

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

  // Cached visible columns
  _visibleProjectColumns: Column[] = [];
  _visibleReportColumns: Column[] = [];

  /** Bumped when column visibility/order changes to recreate scrollable p-tables. */
  projectsTableRenderToken = 0;
  reportsTableRenderToken = 0;

  uploadedCsvData: any[] = [];

  private lastLoadedClientId: number | null = null;

  // Track which report is being edited for plannedOn
  editingPlannedOnReportId: number | null = null;
  originalPlannedOnValue: string | null = null; // Store original value when editing starts
  /** Stable Date for app-date-picker while editing (avoids new Date() each CD from the template). */
  editingPlannedOnDate: Date | null = null;
  savingPlannedOnReportId: number | null = null; // Track which report is being saved

  // Merchandiser dropdown properties
  merchandisers: Merchandiser[] = [];
  editingMerchandiserReportId: number | null = null;
  selectedMerchandiserId: number | null = null;
  showMerchandiserChangeDialog: boolean = false;
  merchandiserChangeReport: Report | null = null;
  newMerchandiserId: number | null = null;
  isRemovingMerchandiser = false;
  savingMerchandiserReportId: number | null = null; // Track which report is being saved
  shouldOpenMerchandiserDropdown = false;

  isReportClosedForEditing(report: Report): boolean {
    return isAkzenteReportClosed(report?.status);
  }

  // Called when pencil_square is clicked
  startEditingPlannedOn(report: Report): void {
    if (this.isReportClosedForEditing(report)) return;
    // Keep only one inline editor open at a time.
    if (this.editingMerchandiserReportId !== null) {
      this.cancelEditingMerchandiser();
    }

    // Cancel any previous pending edits first
    if (this.editingPlannedOnReportId !== null && this.editingPlannedOnReportId !== report.id) {
      this.cancelEditingPlannedOn();
    }

    this.editingPlannedOnReportId = report.id ?? null;
    // Store the original value to restore if canceled
    this.originalPlannedOnValue = report.plannedOn || null;
    this.editingPlannedOnDate = this.toDate(report.plannedOn ?? null);
  }

  /**
   * Cancel editing plannedOn date
   */
  cancelEditingPlannedOn(): void {
    // Restore the original value if it was changed
    if (this.editingPlannedOnReportId !== null) {
      const report = this.findReportById(this.editingPlannedOnReportId);
      if (report) {
        report.plannedOn = this.originalPlannedOnValue;
      }
    }
    // Reset the editing state - no need to reload data
    this.editingPlannedOnReportId = null;
    this.originalPlannedOnValue = null;
    this.editingPlannedOnDate = null;
  }

  /**
   * Helper method to find a report by ID in all projects
   */
  private findReportById(reportId: number): Report | null {
    for (const project of this.projects) {
      if (project.reports) {
        const report = project.reports.find((r) => r.id === reportId);
        if (report) {
          return report;
        }
      }
    }
    return null;
  }

  /**
   * Find the project that currently holds a report instance (or matching report id).
   */
  private findProjectForReport(report: Report): Project | null {
    if (!report) {
      return null;
    }

    for (const project of this.projects) {
      if (!project.reports?.length) {
        continue;
      }
      if (project.reports.includes(report) || project.reports.some((r) => r.id === report.id)) {
        return project;
      }
    }

    if (this.selectedProject?.reports?.includes(report) || this.selectedProject?.reports?.some((r) => r.id === report.id)) {
      return this.selectedProject;
    }

    return null;
  }

  /**
   * Apply a server report response locally so status/merchandiser/geplant update immediately
   * without requiring a full page reload.
   */
  private applyUpdatedReportLocally(localReport: Report, updatedReport: Report, options: { merchandiserFallback?: Merchandiser | null; clearMerchandiser?: boolean } = {}): void {
    if (!localReport || !updatedReport) {
      return;
    }

    Object.assign(localReport, updatedReport);

    if (options.clearMerchandiser) {
      localReport.merchandiser = undefined;
      // Removing VM must always reset status to pending setup in the UI.
      const pendingLabel = this.resolvePendingStatusLabel(updatedReport.status?.name);
      const pendingColor = updatedReport.status?.id === ReportStatusEnum.PENDING ? updatedReport.status?.color : localReport.status?.color;
      localReport.status = {
        id: ReportStatusEnum.PENDING,
        name: updatedReport.status?.id === ReportStatusEnum.PENDING && updatedReport.status?.name ? updatedReport.status.name : pendingLabel,
        color: updatedReport.status?.id === ReportStatusEnum.PENDING && updatedReport.status?.color ? updatedReport.status.color : pendingColor || '#f59e0b',
      };
    } else if (options.merchandiserFallback && (!updatedReport.merchandiser || !updatedReport.merchandiser.user)) {
      localReport.merchandiser = options.merchandiserFallback;
    }

    const project = this.findProjectForReport(localReport);
    if (!project?.id) {
      this.cdr.markForCheck();
      return;
    }

    // Keep the in-memory/cache copy of project reports in sync with the mutated report.
    if (Array.isArray(project.reports)) {
      const reportIndex = project.reports.findIndex((r) => r.id === localReport.id);
      if (reportIndex !== -1) {
        Object.assign(project.reports[reportIndex], localReport);
      }
      // New array reference helps OnPush tables refresh the status cell.
      project.reports = [...project.reports];
      this.reportCacheService.seed(project.id, project.reports);
    }

    // Status text/filter derived lists must refresh even when report count stays the same.
    delete (project as any)._derivedDataSignature;
    this.updateProjectDerivedData(project);
    this.bumpReportsTableLayout();

    if (this.selectedProject && this.selectedProject.id === project.id) {
      this.updateFilterOptions();
    }

    this.cdr.detectChanges();
  }

  private resolvePendingStatusLabel(serverStatusName?: string | null): string {
    // Prefer a label already used in this table for pending reports.
    for (const project of this.projects) {
      const pending = project.reports?.find((r) => r.status?.id === ReportStatusEnum.PENDING);
      if (pending?.status?.name) {
        return pending.status.name;
      }
    }
    return serverStatusName || 'Offen';
  }

  /**
   * Save plannedOn date edit
   */
  savePlannedOnEdit(report: Report): void {
    if (!report.id) {
      this.editingPlannedOnReportId = null;
      this.editingPlannedOnDate = null;
      return;
    }

    // Set loading state
    this.savingPlannedOnReportId = report.id;
    this.cdr.markForCheck();

    // Create FormData to match the backend's expected format
    const formData = new FormData();
    const normalizedPlannedOn = typeof report.plannedOn === 'string' && report.plannedOn.trim() === '' ? null : report.plannedOn;
    const updateData = {
      // Send null explicitly when user clears the date so DB value is set to NULL.
      appointmentDate: normalizedPlannedOn, // Backend expects 'appointmentDate' field
    };
    formData.append('data', JSON.stringify(updateData));

    // Update the report with new plannedOn date
    this.reportService
      .updateReportWithFormData(report.id, formData)
      .pipe(
        catchError((error) => {
          console.error('❌ Error updating planned date:', error);
          this.toast.error('Fehler beim Aktualisieren des Datums', {
            position: 'bottom-right',
            duration: 5000,
            icon: '❌',
          });
          // Clear loading state on error
          this.savingPlannedOnReportId = null;
          this.cdr.markForCheck();
          return of(null);
        }),
      )
      .subscribe((updatedReport) => {
        // Clear loading state
        this.savingPlannedOnReportId = null;

        if (updatedReport) {
          this.toast.success('Datum erfolgreich aktualisiert', {
            position: 'bottom-right',
            duration: 4000,
            icon: '✅',
          });
          // Sync plannedOn + status (and any other server-side fields) immediately.
          this.applyUpdatedReportLocally(report, updatedReport);

          this.editingPlannedOnReportId = null;
          this.editingPlannedOnDate = null;
        }
        this.cdr.markForCheck();
      });
  }

  onPlannedOnCalendarSelect(report: Report, value: Date | null): void {
    this.editingPlannedOnDate = value;
    if (!value) {
      report.plannedOn = '';
      return;
    }

    const normalized = this.formatDateToIso(value);
    if (normalized) {
      report.plannedOn = normalized;
    }
  }

  private formatDateToIso(date: Date): string | null {
    if (!(date instanceof Date) || isNaN(date.getTime())) {
      return null;
    }
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  toDate(value?: string | Date | null): Date | null {
    if (!value) return null;
    const d = value instanceof Date ? value : new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    private clientService: ClientService,
    private projectService: ProjectService,
    private reportService: ReportService,
    private reportCacheService: ReportCacheService,
    private clientCompanyService: ClientCompanyService,
    private merchandiserService: MerchandiserService,
    private clientDetailStateService: ClientDetailStateService,
    private toast: HotToastService,
    private cdr: ChangeDetectorRef,
    private renderer: Renderer2,
  ) {
    // Check if we have navigation history
    const navigation = this.router.getCurrentNavigation();
    this.canGoBack = !!navigation?.previousNavigation;

    this.routerSubscription = this.router.events.subscribe((event) => {
      if (event instanceof NavigationStart) {
        this.nextUrl = event.url;
        // Save state immediately before navigation destroys the view
        if (this.shouldPersistState() && !this.clientDetailStateService.preventSave) {
          this.saveCurrentState();
        }
        // Always reset the flag
        this.clientDetailStateService.preventSave = false;
      }
    });
  }

  // Track newly created project for highlighting
  newlyCreatedProjectId: number | null = null;

  ngOnInit(): void {
    // Subscribe to reset requests (e.g. from sidebar navigation)
    this.resetSubscription = this.clientDetailStateService.reset$.subscribe((clientId) => {
      if (this.client && this.client.id === clientId) {
        this.resetView();
      }
    });

    // Check if we're returning from project creation
    this.checkForNewProject();

    // Initialize project columns
    this.cols = [
      { field: 'formattedZeitraum', header: 'Zeitraum' }, // Change field name
      { field: 'filialen', header: 'Filialen' },
      { field: 'status', header: 'Status' },
    ];

    // Initialize report columns
    this.reportCols = [
      { field: 'plannedOn', header: 'Geplant' },
      { field: 'merchandiser', header: 'Merchandiser' },
      { field: 'branch.name', header: 'Filiale' },
      { field: 'address', header: 'Adresse' },
      { field: 'note', header: 'Notiz' },
      { field: 'reportTo', header: 'Report bis' },
    ];

    // Initialize ordered columns
    this.projectsOrderedColumns = [...this.cols];
    this.reportsOrderedColumns = [...this.reportCols];

    // Set all columns to visible by default
    this.initializeVisibleColumns();

    // Set all columns as selected by default (all columns should be displayed)
    this.selectedColumns = [...this.cols];
    // Exclude feedback from default selection - they're optional
    this.selectedReportColumns = this.reportCols.filter((col) => col.field !== 'feedback');

    // Sync selected columns with visible columns (will be called again after cache restore if cache exists)
    this.syncVisibleColumnSelections();

    // Initialize report filters
    this.reportStatusFilter = [];
    this.reportMerchandiserFilter = [];
    this.projectNameFilter = [];
    this.projectColumnFilterValues = {};
    this.reportFilialenFilter = [];

    // Preload merchandisers so the inline change dropdown is ready without waiting on first open
    this.loadMerchandisers();

    // Don't restore from query params initially - let restoreStateFromCache handle it first
    // restoreFiltersFromQuery(this.route.snapshot.queryParamMap);

    this.route.queryParamMap.pipe(takeUntil(this.destroy$)).subscribe((queryParamMap) => {
      // Only restore filters from query params if they are present (preserve existing from cache)
      this.restoreFiltersFromQuery(queryParamMap, true);
      if (Array.isArray(this.projects) && this.projects.length > 0) {
        this.applyFilters();
      }
    });

    // Clear the highlight after 5 seconds
    if (this.newlyCreatedProjectId) {
      setTimeout(() => {
        this.newlyCreatedProjectId = null;
      }, 5000);
    }

    this.route.paramMap.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      this.statusFilter = this.route.snapshot.queryParamMap.get('status') || '';

      // Support both projectSlug and projectId, and always extract clientId
      const clientId = params.get('clientId');
      const projectSlug = params.get('projectSlug') || params.get('projectId');

      const clientIdNum = Number(clientId);
      const loadId = ++this.loadSequence;

      // Reset expanded rows when switching clients; preserve route project on refresh/deep-link
      if (clientIdNum !== this.lastLoadedClientId) {
        this.expandedRows = projectSlug ? { [projectSlug]: true } : {};
      }
      if (clientIdNum) {
        if (clientIdNum !== this.lastLoadedClientId) {
          this.lastLoadedClientId = clientIdNum;
          this._scrollRestorationDone = false;
          this._deferScrollToRefresh = false;
          this._restoreScrollId++;

          // Try to restore from cache first
          const cacheRestored = this.restoreStateFromCache(clientIdNum);

          // Route project always wins over cached expanded rows (e.g. page refresh)
          if (projectSlug) {
            this.expandedRows = { [projectSlug]: true };
          }

          if (!cacheRestored) {
            // Cache miss or expired - restore filters from query params first
            this.restoreFiltersFromQuery(this.route.snapshot.queryParamMap, false);

            // Cache miss or expired - load from API
            this.isLoading = true;
            this.error = false;
            this.clientCompanyService
              .getProjectsByClientCompany(clientIdNum)
              .pipe(
                takeUntil(this.destroy$),
                finalize(() => {
                  if (loadId !== this.loadSequence) return;
                  this.isLoading = false;
                  this.triggerContentAnimation();
                  this.cdr.markForCheck();
                  // Try to restore scroll position after data load
                  setTimeout(() => {
                    this.restoreTableScrollPosition();
                  }, 100);
                }),
              )
              .subscribe({
                next: (response) => {
                  if (loadId !== this.loadSequence) return;
                  if (!response) {
                    this.projects = [];
                    this.filteredProjects = [];
                    this.client = undefined;
                    return;
                  }
                  this.projects = response.projects || [];
                  this.ensureProjectZeitraum(this.projects);
                  this.client = response.clientCompany;

                  if (this.client && this.projects) {
                    this.clientService.setClientProjects(
                      this.client.id.toString(),
                      this.projects.map((p) => ({
                        id: p.id?.toString() ?? '',
                        name: p.name ?? '',
                        clientId: this.client!.id.toString(),
                      })),
                    );
                  }

                  this.finalizeProjectsDataLoad(projectSlug);
                },
                error: (err) => {
                  if (loadId !== this.loadSequence) return;
                  console.error('Error fetching projects for client company:', err);
                  this.error = true;
                  this.projects = [];
                  this.filteredProjects = [];
                  this.selectedProject = null;
                  this.client = undefined;
                },
              });
          } else {
            // Returning from report-detail/edit: show loader first, fetch fresh data, then scroll once.
            this._deferScrollToRefresh = true;
            this.isLoading = true;
            this.error = false;
            this.cdr.markForCheck();

            // Restore filters/scroll position from cache (for use after data loads)
            this.restoreStateFromCache(clientIdNum);

            this.clientCompanyService.getProjectsByClientCompany(clientIdNum).pipe(
              takeUntil(this.destroy$),
            ).subscribe({
              next: (response) => {
                if (loadId !== this.loadSequence) return;
                this.projects = response.projects || [];
                this.ensureProjectZeitraum(this.projects);
                this.client = response.clientCompany;

                if (this.client?.id) {
                  this.clientService.setClientProjects(
                    this.client.id.toString(),
                    this.projects.map((p) => ({
                      id: p.id?.toString() ?? '',
                      name: p.name ?? '',
                      clientId: this.client!.id.toString(),
                    })),
                  );
                }

                this.finalizeProjectsDataLoad(projectSlug);

                if (this.client?.id) {
                  this.saveCurrentState();
                }

                this.isLoading = false;
                this.triggerContentAnimation();
                this.cdr.markForCheck();

                this._deferScrollToRefresh = false;
                this._scrollRestorationDone = false;
                setTimeout(() => this.restoreTableScrollPosition(), 100);
              },
              error: (err) => {
                if (loadId !== this.loadSequence) return;
                console.error('Error refreshing projects:', err);
                this.isLoading = false;
                this._deferScrollToRefresh = false;
                this._scrollRestorationDone = false;
                this.triggerContentAnimation();
                this.cdr.markForCheck();
                setTimeout(() => this.restoreTableScrollPosition(), 100);
              },
            });
          }
        } else {
          // Same client: route changed (e.g. project expanded/collapsed) — sync without full reload
          if (projectSlug) {
            this.syncRouteProjectSelection(projectSlug, {
              forceRefresh: this.selectedProject?.id?.toString() !== projectSlug,
            });
          } else {
            this.selectedProject = null;
            if (this.client?.id) {
              this.clientService.setSelectedProject(this.client.id.toString(), null);
            }
          }
        }
      } else {
        this.client = undefined;
        this.projects = [];
        this.filteredProjects = [];
        this.selectedProject = null;
      }
    });

    // Remove static initializeProjects method
  }

  /**
   * Check if we're returning from project creation and highlight the new project
   */
  private checkForNewProject(): void {
    const state = (window.history as any).state;

    if (state?.newProjectId) {
      this.newlyCreatedProjectId = state.newProjectId;

      // Clear the state after reading it to prevent re-highlighting on refresh
      if (window.history && (window.history as any).replaceState) {
        (window.history as any).replaceState({ ...state, newProjectId: undefined, newProjectName: undefined }, '');
      }
    }
  }

  // Navigate to project detail
  navigateToProjectCreate(): void {
    if (this.client?.id) {
      this.navigateWithFilters(['/clients', this.client.id, 'projects', 'create']);
    }
  }

  private navigateToProject(project: any, overrides: Record<string, any> = {}, options: { replaceUrl?: boolean } = {}): void {
    if (!this.client?.id || !project?.id) {
      return;
    }

    const currentProjectId = this.route.snapshot.paramMap.get('projectId');
    if (options.replaceUrl && currentProjectId === project.id?.toString()) {
      return;
    }

    this.navigateWithFilters(['/clients', this.client.id, 'projects', project.id], overrides, options);
  }

  onReportRowClick(report: Report): void {
    const clientId = report.clientCompany?.id || this.client?.id;
    const projectId = report.project?.id || this.selectedProject?.id;

    if (clientId && projectId && report.id) {
      this.navigateWithFilters(['/clients', clientId, 'projects', projectId, 'reports', report.id], { referrer: 'client-detail' });
    }
  }

  navigateBackToClient(): void {
    if (this.canGoBack) {
      this.location.back();
    }
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

  // Your existing methods
  members = [
    { name: 'Amy Elsner', image: 'amyelsner.png', email: 'amy@email.com', role: 'Owner' },
    { name: 'Bernardo Dominic', image: 'bernardodominic.png', email: 'bernardo@email.com', role: 'Editor' },
    { name: 'Ioni Bowcher', image: 'ionibowcher.png', email: 'ioni@email.com', role: 'Viewer' },
  ];

  private getRouteProjectSlug(): string | null {
    return this.route.snapshot.paramMap.get('projectSlug') || this.route.snapshot.paramMap.get('projectId');
  }

  private findProjectByRouteSlug(projectSlug: string): Project | undefined {
    if (!projectSlug || !Array.isArray(this.projects)) {
      return undefined;
    }

    return this.projects.find((p) => p.id == projectSlug || p.slug == projectSlug);
  }

  private ensureRouteProjectInFilteredList(project: Project): void {
    if (!project?.id || !Array.isArray(this.filteredProjects)) {
      return;
    }

    const projectId = project.id.toString();
    const isVisible = this.filteredProjects.some((p) => p.id?.toString() === projectId);
    if (!isVisible) {
      this.filteredProjects = [project, ...this.filteredProjects];
    }
  }

  private findProjectById(projectId: string): Project | undefined {
    if (!projectId || !Array.isArray(this.projects)) {
      return undefined;
    }

    return this.projects.find((p) => p.id?.toString() === projectId);
  }

  private ensureExpandedProjectsVisible(): void {
    Object.keys(this.expandedRows || {}).forEach((projectId) => {
      if (!this.expandedRows[projectId]) {
        return;
      }

      const project = this.findProjectById(projectId);
      if (project) {
        this.ensureRouteProjectInFilteredList(project);
      }
    });
  }

  private loadReportsForExpandedProjects(options: { forceRefresh?: boolean } = {}): void {
    if (!Array.isArray(this.projects)) {
      return;
    }

    Object.keys(this.expandedRows || {}).forEach((projectId) => {
      if (!this.expandedRows[projectId]) {
        return;
      }

      const project = this.findProjectById(projectId);
      if (project) {
        this.loadProjectReports(project, options);
      }
    });
  }

  private syncSelectionWithExpandedRows(): void {
    const expandedProjectId = Object.keys(this.expandedRows || {}).find((projectId) => this.expandedRows?.[projectId]);

    if (!expandedProjectId) {
      if (!this.selectedProject && this.filteredProjects.length > 0) {
        this.selectProject(this.filteredProjects[0], { syncUrl: false });
      }
      return;
    }

    const project = this.findProjectById(expandedProjectId);
    if (!project?.id) {
      return;
    }

    this.selectedProject = project;
    this.updateReportColumnsForProject(project);
    if (this.client?.id) {
      this.clientService.setSelectedProject(this.client.id.toString(), project.id.toString());
    }
  }

  private refreshExpandedRowKeys(): void {
    this.expandedRows = { ...this.expandedRows };
    this.bumpProjectsTableLayout();
  }

  private finalizeProjectsDataLoad(projectSlug: string | null): void {
    this.applyFilters();
    this.ensureExpandedProjectsVisible();

    if (projectSlug) {
      this.syncRouteProjectSelection(projectSlug, { forceRefresh: true });
      this.refreshExpandedRowKeys();
      return;
    }

    if (this.statusFilter) {
      const toExpand = this.filteredProjects || [];
      const newExpandedRows: { [key: string]: boolean } = {};
      toExpand.forEach((proj) => {
        if (proj?.id) {
          newExpandedRows[proj.id.toString()] = true;
        }
      });
      this.expandedRows = newExpandedRows;
      this.loadReportsForExpandedProjects({ forceRefresh: true });
      this.refreshExpandedRowKeys();
      return;
    }

    this.syncSelectionWithExpandedRows();
    this.loadReportsForExpandedProjects({ forceRefresh: true });
    this.refreshExpandedRowKeys();
  }

  private syncRouteProjectSelection(projectSlug: string | null, options: { forceRefresh?: boolean } = {}): void {
    if (!projectSlug || !Array.isArray(this.projects)) {
      return;
    }

    const matchedProject = this.findProjectByRouteSlug(projectSlug);
    if (!matchedProject?.id) {
      this.selectedProject = null;
      if (this.client?.id) {
        this.clientService.setSelectedProject(this.client.id.toString(), null);
      }
      return;
    }

    this.selectedProject = matchedProject;
    this.updateReportColumnsForProject(matchedProject);
    this.expandedRows = { [matchedProject.id.toString()]: true };

    if (this.client?.id) {
      this.clientService.setSelectedProject(this.client.id.toString(), matchedProject.id.toString());
    }

    this.ensureRouteProjectInFilteredList(matchedProject);
    this.loadProjectReports(matchedProject, { forceRefresh: options.forceRefresh ?? false });
    this.cdr.markForCheck();
  }

  // Helper to get project URL for href
  getProjectUrl(project: Project): string {
    if (!project?.id || !this.client?.id) {
      return '';
    }
    return this.router.serializeUrl(this.router.createUrlTree(['/clients', this.client.id, 'projects', project.id]));
  }

  // Enhance selectProject method to also expand the row
  private loadProjectReports(project: Project, options: { forceRefresh?: boolean } = {}): void {
    const start = this.now();

    if (!project?.id) {
      return;
    }

    const projectKey = project.id;
    const projectId = projectKey.toString();
    const forceRefresh = !!options.forceRefresh;

    this.logDebug('loadProjectReports starting', { projectId, forceRefresh });

    // Check if we have data in memory
    const hasInMemoryData = project.reports && project.reports.length > 0;

    // Check if we have data in cache
    let hasCachedData = false;
    if (!hasInMemoryData) {
      const snapshot = this.reportCacheService.peek(projectKey);
      const cachedReports = snapshot?.data;
      if (Array.isArray(cachedReports) && cachedReports.length > 0) {
        project.reports = cachedReports;
        this.updateProjectDerivedData(project);
        hasCachedData = true;
      }
    }

    const hasData = hasInMemoryData || hasCachedData;

    if (!forceRefresh && hasData) {
      // Data already loaded and no refresh requested
      // Always update derived data to apply current filters (e.g., status filter from query params)
      if (hasInMemoryData) {
        this.updateProjectDerivedData(project);
      }
      const finishStart = this.clearReportLoadTimer(projectId) ?? start;
      this.recordReportLoad(projectId, finishStart, hasInMemoryData ? 'alreadyLoaded' : 'cache');
      this.logDuration('loadProjectReports skipped (data available)', finishStart, {
        projectId,
        reportCount: project.reports?.length,
      });
      this.cdr.markForCheck();
      if (this.client?.id) {
        this.saveCurrentState();
      }

      // Attach reports table scroll listener after data is available
      this.onProjectExpanded(project.id);
      if (this.sidebarVisibleProjectId?.toString() === project.id?.toString()) {
        this.restoreMobileReportsSidebarScrollPosition(project.id);
      }

      // Update filter options if this is the selected project
      if (this.selectedProject && this.selectedProject.id === project.id) {
        this.updateFilterOptions();
      }
      return;
    }

    // If we have data, don't show loading spinner even if refreshing
    if (hasData) {
      this.loadingReports[projectId] = false;
    } else {
      // Only set loading state if we don't have any data to show
      this.reportLoadingTimers[projectId] = start;
      this.loadingReports[projectId] = true;
    }

    this.reportCacheService
      .getProjectReports(projectKey, { forceRefresh })
      .pipe(take(1))
      .subscribe({
        next: (reports) => {
          project.reports = reports ?? [];
          this.updateProjectDerivedData(project);
          this.loadingReports[projectId] = false;
          const finishStart = this.clearReportLoadTimer(projectId) ?? start;
          this.recordReportLoad(projectId, finishStart, 'api');
          this.cdr.markForCheck();
          if (this.client?.id) {
            this.saveCurrentState();
          }
          this.logDuration('loadProjectReports resolved via API', finishStart, {
            projectId,
            reportCount: project.reports.length,
          });

          // Attach reports table scroll listener after reports are loaded and table is rendered
          this.onProjectExpanded(project.id);
          if (this.sidebarVisibleProjectId?.toString() === project.id?.toString()) {
            this.restoreMobileReportsSidebarScrollPosition(project.id);
          }

          // Update filter options if this is the selected project
          if (this.selectedProject && this.selectedProject.id === project.id) {
            this.updateFilterOptions();
          }
        },
        error: (err) => {
          console.error(`Error fetching reports for project ${projectKey}:`, err);
          // Only clear reports if we didn't have any before
          if (!hasData) {
            project.reports = [];
            this.updateProjectDerivedData(project);
          }
          this.loadingReports[projectId] = false;
          const finishStart = this.clearReportLoadTimer(projectId) ?? start;
          this.recordReportLoad(projectId, finishStart, 'error');
          this.cdr.markForCheck();
          this.logDuration('loadProjectReports failed', finishStart, {
            projectId,
            error: err?.message ?? err,
          });
        },
      });
  }

  sidebarVisibleProjectId: string | null = null;

  getExpandedProjectName(): string {
    // Desktop/table flow uses selectedProject + expandedRows.
    // Mobile sidebar flow uses sidebarVisibleProjectId.
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

  toggleReportsSidebar(project: Project) {
    if (this.sidebarVisibleProjectId === project.id) {
      this.sidebarVisibleProjectId = null;
      project.isExpanded = false;
    } else {
      this.sidebarVisibleProjectId = project.id;
      // Fetch reports specifically when expanding on mobile
      if (!project._reportsLoaded) {
        this.loadProjectReports(project);
      }
      this.restoreMobileReportsSidebarScrollPosition(project.id as string | number);
    }
  }

  openReportFilterSheet(project: Project) {
    if (!project) return;
    // Filter feature disabled or not implemented
  }

  closeReportsSidebar(force?: boolean) {
    if (this.isDestroying) return;
    if (this.showReportsMobileFilter && !force) {
      return;
    }
    this.sidebarVisibleProjectId = null;
  }

  toggleProject(project: Project) {
    if (this.selectedProject && this.selectedProject.id === project.id) {
      this.collapseProject(project);
    } else {
      this.selectProject(project);
    }
  }

  selectProject(project: Project, options: { syncUrl?: boolean } = {}) {
    if (!project?.id) {
      return;
    }

    // Capture reports table scroll position BEFORE clearing expanded rows
    // This ensures we remember the scroll position when switching projects
    this.captureReportsTableScrollPosition();

    // Clean up reports table scroll listener from previous project
    if (this.reportsTableScrollListener) {
      this.reportsTableScrollListener();
      this.reportsTableScrollListener = null;
    }

    const projectId = project.id.toString();
    this.startReportLoadTimer(projectId);
    this.selectedProject = project;
    this.updateReportColumnsForProject(project);

    // Enforce single expanded project at a time - always close all others
    // and expand only the selected project (accordion behavior)
    this.expandedRows = { [projectId]: true };
    if (this.client?.id) {
      this.clientService.setSelectedProject(this.client.id.toString(), projectId);
      this.scheduleStateSave();
    }

    // Always fetch fresh reports from server when project is selected/expanded
    this.loadProjectReports(project, { forceRefresh: true });

    if (options.syncUrl !== false) {
      this.navigateToProject(project, {}, { replaceUrl: true });
    }
  }

  private applyCachedReports(project: Project, projectId: string): boolean {
    if (!project?.id) {
      return false;
    }

    const previousTimer = this.reportLoadingTimers[projectId];

    if (project.reports && project.reports.length > 0) {
      this.updateProjectDerivedData(project);
      this.loadingReports[projectId] = false;
      const start = this.clearReportLoadTimer(projectId) ?? previousTimer ?? this.now();
      this.recordReportLoad(projectId, start, 'alreadyLoaded');
      this.logDuration('applyCachedReports (already loaded)', start, {
        projectId,
        reportCount: project.reports.length,
      });
      this.cdr.markForCheck();
      if (this.client?.id) {
        this.saveCurrentState();
      }
      // Restore reports table scroll position after cache hit
      this.onProjectExpanded();

      // Update filter options if this is the selected project
      if (this.selectedProject && this.selectedProject.id === project.id) {
        this.updateFilterOptions();
      }
      return true;
    }

    const snapshot = this.reportCacheService.peek(project.id);
    const cachedReports = snapshot?.data;
    if (Array.isArray(cachedReports) && cachedReports.length > 0) {
      project.reports = cachedReports;
      this.updateProjectDerivedData(project);
      this.loadingReports[projectId] = false;
      const start = this.clearReportLoadTimer(projectId) ?? previousTimer ?? this.now();
      this.recordReportLoad(projectId, start, 'cache');
      this.logDuration('applyCachedReports (cache hit)', start, {
        projectId,
        reportCount: cachedReports.length,
      });
      this.cdr.markForCheck();
      if (this.client?.id) {
        this.saveCurrentState();
      }
      // Restore reports table scroll position after cache hit
      this.onProjectExpanded(project.id);

      // Update filter options if this is the selected project
      if (this.selectedProject && this.selectedProject.id === project.id) {
        this.updateFilterOptions();
      }
      return true;
    }

    return false;
  }

  private recordReportLoad(projectId: string, startTime: number, source: 'api' | 'cache' | 'alreadyLoaded' | 'error'): void {
    const duration = Math.max(0, this.now() - startTime);
    this.reportLoadDurations[projectId] = duration;
    this.reportLoadSources[projectId] = source;
  }

  getReportLoadMessage(projectId?: string | number): string {
    if (projectId === undefined || projectId === null) {
      return '';
    }

    const key = projectId.toString();
    const duration = this.reportLoadDurations[key];
    const source = this.reportLoadSources[key];

    if (duration === undefined || !source) {
      return '';
    }

    const sourceLabel = source === 'api' ? 'API' : source === 'cache' ? 'Cache' : source === 'alreadyLoaded' ? 'Memory' : 'Error';

    return `${sourceLabel} ${duration.toFixed(0)}ms`;
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

  onRowExpand(event: TableRowExpandEvent) {
    const project = event.data as Project;

    // Enforce single expanded project at a time (accordion behavior)
    // Close any other expanded projects and expand only the clicked one
    if (project?.id) {
      this.expandedRows = { [project.id.toString()]: true };
    }

    if (project) {
      this.selectedProject = project;
      this.updateReportColumnsForProject(project);
      if (this.client?.id && project.id) {
        this.clientService.setSelectedProject(this.client.id.toString(), project.id.toString());
      }
    }

    if (this.client?.id) {
      this.saveCurrentState();
    }
    if (project?.id) {
      // Force refresh data from server on expand
      this.loadProjectReports(project, { forceRefresh: true });
      this.navigateToProject(project, {}, { replaceUrl: true });
    }

    this.cdr.markForCheck();
  }

  // Method to collapse the currently expanded project
  collapseProject(project?: Project): void {
    if (project?.id) {
      // If a specific project is provided, only collapse that one
      if (this.expandedRows[project.id.toString()]) {
        delete this.expandedRows[project.id.toString()];
        // Create a new object reference to trigger change detection
        this.expandedRows = { ...this.expandedRows };
      }

      // If the collapsed project was the selected one, clear selection and sidebar
      if (this.selectedProject?.id === project.id) {
        this.selectedProject = null;
        if (this.client?.id) {
          this.clientService.setSelectedProject(this.client.id.toString(), null);
          // If route points to a specific project, navigate back to client
          const projectRouteId = this.route.snapshot.paramMap.get('projectId') || this.route.snapshot.paramMap.get('projectSlug');
          if (projectRouteId) {
            this.navigateWithFilters(['/clients', this.client.id], {}, { replaceUrl: true });
          }
        }
      }

      // If no projects remain expanded, ensure sidebar is unactive
      if (Object.keys(this.expandedRows).length === 0) {
        this.selectedProject = null;
        if (this.client?.id) {
          this.clientService.setSelectedProject(this.client.id.toString(), null);
          // If route points to a specific project, navigate back to client
          const projectRouteId = this.route.snapshot.paramMap.get('projectId') || this.route.snapshot.paramMap.get('projectSlug');
          if (projectRouteId) {
            this.navigateWithFilters(['/clients', this.client.id], {}, { replaceUrl: true });
          }
        }
      }
    } else {
      // Fallback to old behavior: collapse all
      this.expandedRows = {};
      this.selectedProject = null;

      if (this.client?.id) {
        this.clientService.setSelectedProject(this.client.id.toString(), null);
        // If route points to a specific project, navigate back to client
        const projectRouteId = this.route.snapshot.paramMap.get('projectId') || this.route.snapshot.paramMap.get('projectSlug');
        if (projectRouteId) {
          this.navigateWithFilters(['/clients', this.client.id], {}, { replaceUrl: true });
        }
      }
    }
    // Persist state so sidebar updates immediately (expandedRowsChange$)
    if (this.client?.id) {
      this.saveCurrentState();
    }
    this.cdr.markForCheck();
  }

  // Modify the existing onRowCollapse method to also update the route
  onRowCollapse(event: TableRowCollapseEvent) {
    // Capture reports table scroll position BEFORE it gets destroyed
    this.captureReportsTableScrollPosition();

    // Clean up reports table scroll listener
    if (this.reportsTableScrollListener) {
      this.reportsTableScrollListener();
      this.reportsTableScrollListener = null;
    }

    // Always call collapseProject to properly update expandedRows and sidebar
    this.collapseProject(event.data as Project);

    // Save state after collapse
    if (this.client?.id) {
      this.saveCurrentState();
    }
    this.cdr.markForCheck();
  }

  /**
   * Capture reports table scroll position per project before expanding a different project.
   * Stores scroll position keyed by project ID so each project's reports table keeps its own position.
   */
  private captureReportsTableScrollPosition(): void {
    const containers = document.querySelectorAll('.reports-table-container[data-project-id]');
    containers.forEach((container) => {
      const projectId = (container as HTMLElement).getAttribute('data-project-id');
      if (!projectId) return;
      const scrollPos = this.findScrollPositionInElement(container as HTMLElement);
      if (scrollPos > 0) {
        this.reportsTableScrollPositionByProject[projectId] = scrollPos;
      }
    });
    if (containers.length === 0) {
      const fallback = document.querySelector('.expanded-row-cell');
      if (fallback) {
        const scrollPos = this.findScrollPositionInElement(fallback as HTMLElement);
        const expandedIds = Object.keys(this.expandedRows || {}).filter((k) => this.expandedRows?.[k]);
        if (scrollPos > 0 && expandedIds.length > 0) {
          this.reportsTableScrollPositionByProject[expandedIds[0]] = scrollPos;
        }
      }
    }
  }

  private findScrollPositionInElement(el: HTMLElement): number {
    const selectors = ['.p-scroller', '.p-datatable-wrapper', '.p-datatable-scrollable-body', '.p-datatable-table-container'];
    for (const sel of selectors) {
      const found = el.querySelector(sel) as HTMLElement;
      if (found && found.scrollTop > 0) return found.scrollTop;
    }
    const divs = el.querySelectorAll('div');
    for (let i = 0; i < divs.length; i++) {
      const div = divs[i] as HTMLElement;
      if (div.scrollTop > 0) {
        const style = window.getComputedStyle(div);
        if (style.overflowY === 'auto' || style.overflowY === 'scroll') return div.scrollTop;
      }
    }
    return 0;
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
    this.myDate = date;
  }

  onFavoriteChanged(newStatus: boolean, project: Project): void {
    // Optimistically update the UI
    const previousStatus = project.isFavorite;
    project.isFavorite = newStatus;
    this.cdr.markForCheck();

    // Call backend to toggle favorite status
    this.projectService
      .toggleFavoriteStatus(project.id!)
      .pipe(
        catchError((error) => {
          console.error('❌ Error toggling project favorite status:', error);

          // Revert the optimistic update on error
          project.isFavorite = previousStatus;
          this.cdr.markForCheck();
          this.toast.error('Fehler beim Aktualisieren des Favoritenstatus');

          return of(null);
        }),
      )
      .subscribe({
        next: (result) => {
          if (result) {
            // Update the status based on server response
            project.isFavorite = result.isFavorite;
            this.cdr.markForCheck();

            if (result.isFavorite) {
              this.toast.success('Projekt zu Favoriten hinzugefügt');
            } else {
              this.toast.info('Projekt aus Favoriten entfernt');
            }
          }
        },
      });
  }

  /**
   * Calculate the percentage of reported orders for a project
   */
  /**
   * Preload reports for all projects in the background to enable status percentage calculation
   */
  private preloadReportsForAllProjects(projects: Project[]): void {
    if (!projects || projects.length === 0) {
      return;
    }

    projects.forEach((project) => {
      if (project && project.id) {
        // Only load if reports are not already loaded
        if (!project.reports) {
          // Load reports in background without showing loading indicator for preload
          this.reportCacheService
            .getProjectReports(project.id)
            .pipe(take(1))
            .subscribe({
              next: (reports) => {
                project.reports = reports;
              },
              error: (err) => {
                console.error(`Error preloading reports for project ${project.id}:`, err);
                project.reports = [];
              },
            });
        }
      }
    });
  }

  getReportedPercentage(project: Project): number {
    // Use backend-calculated value if available, otherwise fallback to 0
    return project.reportedPercentage ?? 0;
  }

  private getReportBranchKey(report: Report): string | null {
    if (report.branch?.id) {
      return `branch-id-${report.branch.id}`;
    }

    const branchNumber = report.branch?.branchNumber?.toString().trim();
    if (branchNumber) {
      return `branch-number-${branchNumber}`;
    }

    const branchName = report.branch?.name?.toString().trim();
    if (branchName) {
      return `branch-name-${branchName}`;
    }

    if (report.id !== undefined) {
      return `report-${report.id}`;
    }

    return null;
  }

  // Add this method to handle favorite changes for reports
  onReportFavoriteChanged(newStatus: boolean, report: Report): void {
    const previousStatus = report.isFavorite;
    report.isFavorite = newStatus;
    this.cdr.markForCheck();

    this.reportService.toggleFavoriteStatus(report.id!).subscribe({
      next: (result) => {
        if (result) {
          report.isFavorite = result.isFavorite;
          this.cdr.markForCheck();
          // Optionally show a toast: result.message
        }
      },
      error: (error) => {
        report.isFavorite = previousStatus; // revert on error
        this.cdr.markForCheck();
        // Optionally show a toast: 'Fehler beim Aktualisieren der Favoriten'
      },
    });
  }

  // Method to open file input when CSV icon is clicked
  openCsvUploader(project: Project): void {
    this.selectedProject = project;
    // Trigger click on hidden file input
    if (this.csvFileInput) {
      this.csvFileInput.nativeElement.click();
    }
  }

  // Handle CSV file upload
  handleCsvFileUpload(event: Event): void {
    const fileInput = event.target as HTMLInputElement;
    const file = fileInput?.files?.[0];

    if (file && this.selectedProject) {
      // Here you would typically handle the CSV file upload using a service

      // Example of reading the file content
      const reader = new FileReader();
      reader.onload = (e) => {
        const contents = e.target?.result as string;

        // Process the CSV content using PapaParse
        this.processCsvContent(contents);

        // After parsing, automatically trigger bulk insert if data is present
        if (this.selectedProject && this.uploadedCsvData.length > 0) {
          this.bulkInsertCsvReports(this.selectedProject);
        }

        // Reset file input
        fileInput.value = '';
      };

      reader.readAsText(file);
    }
  }

  // Process CSV content using PapaParse
  private processCsvContent(csvContent: string): void {
    Papa.parse(csvContent, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        this.uploadedCsvData = (results.data as any[]).map((row) => this.mapExcelRowToReport(row));
      },
      error: (err) => {
        console.error('CSV parsing error:', err);
      },
    });
  }

  private sanitizeExcelFileNamePart(value?: string): string {
    const sanitized = (value || 'report')
      .trim()
      .replace(/ä/g, 'ae')
      .replace(/ö/g, 'oe')
      .replace(/ü/g, 'ue')
      .replace(/Ä/g, 'Ae')
      .replace(/Ö/g, 'Oe')
      .replace(/Ü/g, 'Ue')
      .replace(/ß/g, 'ss')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '_');

    return sanitized || 'report';
  }

  // Download Excel for project
  downloadProjectCsv(project: Project): void {
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
        link.download = `${this.sanitizeExcelFileNamePart(project.name)}_reports_export.xlsx`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);

        // Clear loading state
        this.downloadingExcel[project.id] = false;

        // Show success message
        this.toast.success('Excel-Export erfolgreich heruntergeladen', {
          position: 'bottom-right',
          duration: 4000,
          icon: '✅',
        });
      },
      error: (error) => {
        console.error('❌ Error exporting Excel:', error);

        // Clear loading state
        this.downloadingExcel[project.id] = false;

        // Check if it's a "no data" error - generate empty template
        if (error.status === 404 || error.error?.error === 'NO_DATA_FOUND' || (error.status === 400 && error.error?.message?.includes('Keine Daten'))) {
          // Generate empty Excel template
          this.generateEmptyExcelTemplate(project);
        } else {
          this.toast.error('Excel-Export fehlgeschlagen!', {
            position: 'bottom-right',
            duration: 5000,
            icon: '❌',
          });
        }
      },
    });
  }

  // Generate empty Excel template with headers
  private generateEmptyExcelTemplate(project: Project): void {
    try {
      // Create workbook
      const workbook = XLSX.utils.book_new();

      // Define headers based on the mapExcelRowToReport function
      // These headers match what the upload function expects
      const headers = [
        'FILIALNUMMER',
        'FILIALE\n(Text)',
        'STRABE +\nHAUSNUM\nMER',
        'PLZ',
        'ORT',
        'LAND',
        'TELEFON\nFILIALE\n(Text)',
        'NOTIZ\n(Text)',
        'MERCHANDISER\n(Text)',
        'BESUCHSDATUM',
        'Report bis',
        'Feedback\n1. JA\n2. NEIN',
      ];

      // Create worksheet with just headers
      const worksheet = XLSX.utils.aoa_to_sheet([headers]);

      // Set column widths
      const columnWidths = headers.map(() => ({ wch: 20 }));
      worksheet['!cols'] = columnWidths;

      // Style the header row using xlsx-js-style (gray background)
      const headerStyle = {
        font: { bold: true, color: { rgb: '000000' } },
        fill: { fgColor: { rgb: 'D3D3D3' } },
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      };

      // Apply header style to first row
      const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
      for (let col = range.s.c; col <= range.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
        if (!worksheet[cellAddress]) {
          worksheet[cellAddress] = { v: headers[col], t: 's' };
        }
        worksheet[cellAddress].s = headerStyle;
      }

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Reports');

      // Generate Excel file
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${this.sanitizeExcelFileNamePart(project.name)}_template.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      this.toast.success('Excel-Vorlage erfolgreich heruntergeladen (leer, zum Ausfüllen)', {
        position: 'bottom-right',
        duration: 4000,
        icon: '✅',
      });
    } catch (error) {
      console.error('❌ Error generating empty Excel template:', error);
      this.toast.error('Fehler beim Erstellen der Excel-Vorlage!', {
        position: 'bottom-right',
        duration: 5000,
        icon: '❌',
      });
    }
  }

  // Generate CSV content from project data
  private generateProjectCsv(project: Project): string {
    // Create CSV header row
    let csv = 'ID,Filialnummer,Filiale,Status,Geplant,Merchandiser,Adresse,Notiz,Report bis,Feedback\n';

    // Add data rows
    if (project.reports && project.reports.length > 0) {
      project.reports.forEach((report) => {
        csv += `${report.id || ''},`;
        csv += `${this.escapeCsvValue(report.branch?.branchNumber || '')},`;
        csv += `${this.escapeCsvValue(report.branch?.name || '')},`;
        csv += `${report.status?.name || ''},`;
        csv += `${report.plannedOn || ''},`;
        csv += `${this.escapeCsvValue(this.getReportMerchandiserName(report))},`;
        csv += `${this.escapeCsvValue(report.address || '')},`;
        csv += `${this.escapeCsvValue(report.note || '')},`;
        csv += `${report.reportTo || ''},`;
        csv += `${report.feedback ? 'Ja' : 'Nein'}\n`;
      });
    }

    return csv;
  }

  // Helper method to escape CSV values that might contain commas
  private escapeCsvValue(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      // Escape quotes by doubling them and wrap in quotes
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  // Add these new methods for handling sort
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
    this.cdr.markForCheck();

    // Save state after sorting
    if (this.client?.id) {
      this.saveCurrentState();
    }
  }

  onReportSort(field: string, project: Project, event?: Event): void {
    // Stop event propagation to prevent column toggle and date picker opening
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }

    // Save state after sort change
    if (this.client?.id) {
      this.scheduleStateSave();
    }

    if (this.reportSortField === field) {
      // If clicking on the same field, toggle the sort order
      this.reportSortOrder = this.reportSortOrder * -1;
    } else {
      // New sort field, default to ascending
      this.reportSortField = field;
      this.reportSortOrder = 1;
    }

    if (project) {
      this.updateProjectDerivedData(project);
      this.cdr.markForCheck();
    }

    // Save state after sorting
    if (this.client?.id) {
      this.saveCurrentState();
    }
  }

  private sortProjects(field: string, order: number): void {
    this.filteredProjects = this.applyProjectSorting(this.filteredProjects, field, order);
  }

  private getWeekNumber(date: Date): number {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  }

  private ensureProjectZeitraum(projects: Project[]): void {
    if (!projects) return;
    projects.forEach((project) => {
      if (!project.zeitraum) {
        project.zeitraum = this.getProjectZeitraum(project);
      }
      if (!project.calendarWeek && project.startDate) {
        const startDate = new Date(project.startDate);
        if (!isNaN(startDate.getTime())) {
          project.calendarWeek = `KW ${this.getWeekNumber(startDate)}`;
        }
      }
    });
  }

  /** Timestamp for sorting/filtering by project interval (uses startDate). */
  private getProjectZeitraumSortValue(project: Project): number {
    if (project.startDate) {
      const start = new Date(project.startDate);
      if (!isNaN(start.getTime())) {
        return start.getTime();
      }
    }
    return 0;
  }

  getProjectZeitraum(project: Project): string {
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
        return `${startStr} bis ${endStr}`;
      }
    }
    return '';
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

  private getReportField(report: Report, field: string): any {
    // Handle status field
    if (field === 'status') {
      return report.status?.name || '';
    }

    // Handle address field - use getReportAddress method
    if (field === 'address') {
      return this.getReportAddress(report);
    }

    // Handle merchandiser field - use getReportMerchandiserName method
    if (field === 'merchandiser') {
      return this.getReportMerchandiserName(report);
    }

    // Handle nested branch.name field
    if (field === 'branch.name') {
      return report.branch?.name || '';
    }

    // Handle date fields - convert to comparable format
    if (field === 'plannedOn' || field === 'reportTo') {
      const dateValue = report[field as keyof Report];
      if (dateValue) {
        // Convert to timestamp for proper sorting
        const date = new Date(dateValue as string);
        return isNaN(date.getTime()) ? 0 : date.getTime();
      }
      return 0;
    }

    if (field === 'feedback') {
      return report.feedback === true || report.feedback === 'true' ? 'Ja' : 'Nein';
    }

    // Handle note field
    if (field === 'note') {
      return report.note || '';
    }

    // Default: try to get the field value directly
    const value = report[field as keyof Report];
    return value !== undefined && value !== null ? String(value) : '';
  }

  applyProjectSorting(projects: Project[] = [], field: string, order: number): Project[] {
    if (!field) {
      return [...projects];
    }

    const sorted = [...projects];
    sorted.sort((a, b) => {
      const valueA = this.getProjectSortValue(a, field);
      const valueB = this.getProjectSortValue(b, field);

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

  private getProjectSortValue(project: Project, field: string): string | number {
    switch (field) {
      case 'formattedZeitraum':
        return this.getProjectZeitraumSortValue(project);
      case 'filialen':
        return project.branchesCount ?? 0;
      case 'status':
        return this.getReportedPercentage(project);
      default:
        return (project as any)?.[field] ?? '';
    }
  }

  applyReportSorting(reports: Report[] = [], field: string, order: number): Report[] {
    if (!field) {
      return [...reports];
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

  private getReportSortValue(report: Report, field: string): string | number {
    switch (field) {
      case 'status':
        return report.status?.name || '';
      case 'merchandiser':
        return this.getReportMerchandiserName(report);
      case 'branch.name':
        return report.branch?.name || '';
      case 'address':
        return this.getReportAddress(report);
      case 'plannedOn':
      case 'reportTo': {
        const dateValue = report[field as keyof Report];
        if (dateValue) {
          const parsed = new Date(dateValue as string);
          return isNaN(parsed.getTime()) ? 0 : parsed.getTime();
        }
        return 0;
      }
      case 'feedback':
        return report.feedback === true || report.feedback === 'true' ? 'Ja' : 'Nein';
      default:
        return (report as any)?.[field] ?? '';
    }
  }

  /**
   * Generate address string for a report using street, zipCode, branch city, and country
   * Format: STREET + HOUSE NUMBER, ZIP CODE, CITY, COUNTRY
   */
  getReportAddress(report: Report): string {
    return formatReportAddress(report);
  }

  getReportBranchLabel(report: Report | null | undefined): string {
    if (!report || !report.branch) {
      return '';
    }

    const number = (report.branch.branchNumber ?? '').toString().trim();
    const name = (report.branch.name ?? '').trim();

    if (number && name) {
      return `${number} - ${name}`;
    }

    return number || name || '';
  }

  /**
   * Get display name for branch: "Branch Name #Number" format
   */
  getBranchDisplayName(report: Report | null | undefined): string {
    if (!report || !report.branch) {
      return '';
    }

    const name = (report.branch.name ?? '').trim();
    const number = (report.branch.branchNumber ?? '').toString().trim();

    if (name && number) {
      return `${name} #${number}`;
    }

    return name || '';
  }

  /**
   * TrackBy function for projects table to improve rendering performance
   */
  trackByProjectId(index: number, project: Project): string | number {
    return project.id ?? index;
  }

  /**
   * TrackBy function for reports table to improve rendering performance
   */
  trackByReportId(index: number, report: Report): string | number {
    return report.id ?? index;
  }

  /**
   * TrackBy function for columns to improve rendering performance
   */
  trackByColumnField(index: number, column: Column): string {
    return column.field;
  }

  trackByRenderToken(_index: number, token: number): number {
    return token;
  }

  getProjectsExpandedColspan(): number {
    return 2 + (this._visibleProjectColumns?.length ?? 0);
  }

  getProjectsTableStyle(): Record<string, string> {
    const visibleCount = this._visibleProjectColumns?.length ?? 0;
    const columnCount = 2 + visibleCount;
    const minWidthRem = Math.max(32, columnCount * 11);
    return {
      width: '100%',
      'min-width': `${minWidthRem}rem`,
      'table-layout': 'fixed',
    };
  }

  getReportsTableStyle(): Record<string, string> {
    const visibleCount = this._visibleReportColumns?.length ?? 0;
    const columnCount = 2 + visibleCount;
    const minWidthRem = Math.max(48, columnCount * 12);
    return {
      width: '100%',
      'min-width': `${minWidthRem}rem`,
      'table-layout': 'auto',
    };
  }

  private bumpProjectsTableLayout(): void {
    this.projectsTableRenderToken++;
  }

  private bumpReportsTableLayout(): void {
    this.reportsTableRenderToken++;
  }

  private reorderVisibleColumn(orderedColumns: Column[], visibleColumns: Column[], dragIndex: number, dropIndex: number): Column[] {
    const movedColumn = visibleColumns[dragIndex];
    if (!movedColumn) {
      return orderedColumns;
    }

    const newOrdered = [...orderedColumns];
    const currentIndex = newOrdered.findIndex((col) => col.field === movedColumn.field);
    if (currentIndex === -1) {
      return orderedColumns;
    }

    newOrdered.splice(currentIndex, 1);

    const targetColumn = visibleColumns[dropIndex];
    const insertIndex = targetColumn ? newOrdered.findIndex((col) => col.field === targetColumn.field) : newOrdered.length;

    newOrdered.splice(insertIndex === -1 ? newOrdered.length : insertIndex, 0, movedColumn);
    return newOrdered;
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
   * Get formatted date for tooltip (EU format DD.MM.YYYY)
   */
  getFormattedDateForTooltip(date: string | Date | null | undefined): string {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}.${month}.${year}`;
  }

  /**
   * Load all merchandisers for the dropdown
   */
  loadMerchandisers(): void {
    this.merchandiserService.getMerchandisers(1, 0).subscribe({
      next: (response) => {
        this.merchandisers = response.data;
      },
      error: (error) => {
        console.error('❌ Error loading merchandisers:', error);
      },
    });
  }

  /**
   * Start editing merchandiser (show dropdown)
   */
  startEditingMerchandiser(report: Report): void {
    if (this.isReportClosedForEditing(report)) return;
    // Keep only one inline editor open at a time.
    if (this.editingPlannedOnReportId !== null) {
      this.cancelEditingPlannedOn();
    }

    this.editingMerchandiserReportId = report.id ?? null;
    this.selectedMerchandiserId = report.merchandiser?.id ?? null;

    // Load merchandisers if not already loaded
    if (this.merchandisers.length === 0) {
      this.loadMerchandisers();
    }

    this.shouldOpenMerchandiserDropdown = true;
  }

  /**
   * Cancel editing merchandiser
   */
  cancelEditingMerchandiser(): void {
    this.editingMerchandiserReportId = null;
    this.selectedMerchandiserId = null;
  }

  /**
   * Show provision alert
   */
  showProvisionAlert(): void {
    alert('Please provide more information.');
  }

  /**
   * Handle merchandiser selection change (assign or remove)
   */
  onMerchandiserChange(report: Report, newMerchandiserId: number | null | undefined): void {
    const currentMerchandiserId = report.merchandiser?.id ?? null;
    // PrimeNG clear can emit null or undefined — treat both as removal.
    const normalizedMerchandiserId = newMerchandiserId === null || newMerchandiserId === undefined ? null : newMerchandiserId;

    if (normalizedMerchandiserId === currentMerchandiserId) {
      return;
    }

    // Removing is only allowed when a merchandiser is currently assigned.
    if (normalizedMerchandiserId === null && !currentMerchandiserId) {
      return;
    }

    this.merchandiserChangeReport = report;
    this.newMerchandiserId = normalizedMerchandiserId;
    this.isRemovingMerchandiser = normalizedMerchandiserId === null;
    this.showMerchandiserChangeDialog = true;
  }

  /**
   * Confirm merchandiser change or removal
   */
  confirmMerchandiserChange(): void {
    if (!this.merchandiserChangeReport) {
      return;
    }

    // Assign requires a new merchandiser id; remove uses explicit null.
    if (!this.isRemovingMerchandiser && !this.newMerchandiserId) {
      return;
    }

    const reportId = this.merchandiserChangeReport.id;
    if (!reportId) {
      return;
    }

    // Set loading state
    this.savingMerchandiserReportId = reportId;
    this.cdr.markForCheck();

    const newMerchandiser = this.isRemovingMerchandiser ? null : (this.merchandisers.find((m) => m.id === this.newMerchandiserId) ?? null);

    // Create FormData to match the backend's expected format
    const formData = new FormData();
    const updateData = {
      merchandiserId: this.isRemovingMerchandiser ? null : this.newMerchandiserId,
    };
    formData.append('data', JSON.stringify(updateData));

    // Update the report with new merchandiser using FormData
    this.reportService
      .updateReportWithFormData(reportId, formData)
      .pipe(
        catchError((error) => {
          console.error('❌ Error updating merchandiser:', error);
          alert(this.isRemovingMerchandiser ? 'Fehler beim Entfernen des Merchandisers' : 'Fehler beim Aktualisieren des Merchandisers');
          // Clear loading state on error
          this.savingMerchandiserReportId = null;
          this.cdr.markForCheck();
          return of(null);
        }),
      )
      .subscribe((updatedReport) => {
        // Clear loading state
        this.savingMerchandiserReportId = null;
        this.cdr.markForCheck();

        if (updatedReport && this.merchandiserChangeReport) {
          if ((updatedReport as any)._emailSendFailed) {
            this.toast.warning('Merchandiser geändert, aber die Zuweisungs-E-Mail konnte nicht gesendet werden. Bitte überprüfen Sie die E-Mail-Einstellungen.', {
              position: 'bottom-right',
              duration: 6000,
              icon: '⚠️',
            });
          } else {
            this.toast.success(this.isRemovingMerchandiser ? 'Merchandiser entfernt' : 'Merchandiser geändert - Anfrage wurde an den neuen Merchandiser gesendet', {
              position: 'bottom-right',
              duration: 4000,
              icon: '✅',
            });
          }

          const normalizedReport = this.isRemovingMerchandiser ? { ...updatedReport, merchandiser: null } : updatedReport;

          // Sync merchandiser + status immediately from the API response.
          this.applyUpdatedReportLocally(this.merchandiserChangeReport, normalizedReport, {
            merchandiserFallback: newMerchandiser,
            clearMerchandiser: this.isRemovingMerchandiser,
          });
        }

        // Close dialog and reset editing state
        this.showMerchandiserChangeDialog = false;
        this.merchandiserChangeReport = null;
        this.newMerchandiserId = null;
        this.isRemovingMerchandiser = false;
        this.editingMerchandiserReportId = null;
        this.selectedMerchandiserId = null;
      });
  }

  /**
   * Cancel merchandiser change
   */
  cancelMerchandiserChange(): void {
    this.showMerchandiserChangeDialog = false;

    // Revert the value in the dropdown to the original one
    if (this.merchandiserChangeReport) {
      this.selectedMerchandiserId = this.merchandiserChangeReport.merchandiser?.id || null;
    }

    this.merchandiserChangeReport = null;
    this.newMerchandiserId = null;
    this.isRemovingMerchandiser = false;
    // We don't close the editing mode here, giving the user a chance to select another one or cancel editing manually
    // But we restored the previous value so the dropdown is not empty
  }

  /**
   * Get merchandiser display name
   */
  getMerchandiserDisplayName(merchandiser: Merchandiser): string {
    if (merchandiser && merchandiser.user) {
      return `${merchandiser.user.firstName} ${merchandiser.user.lastName}`.trim();
    }
    return '';
  }

  /**
   * Check if report status is NEW
   */
  isReportStatusNew(report: Report): boolean {
    return report.status?.name?.toUpperCase() === 'NEW' || report.status?.id === 1;
  }

  // Initialize visible columns
  initializeVisibleColumns() {
    // Set all project columns to visible by default
    this.cols.forEach((col) => {
      this.projectsVisibleColumns[col.field] = true;
    });

    // Set all report columns to visible by default, except feedback
    this.reportCols.forEach((col) => {
      // Exclude feedback from default visibility
      if (col.field !== 'feedback') {
        this.reportsVisibleColumns[col.field] = true;
      } else {
        this.reportsVisibleColumns[col.field] = false;
      }
    });

    this.updateVisibleColumns();
  }

  // Update cached visible columns
  private updateVisibleColumns(): void {
    this._visibleProjectColumns = this.projectsOrderedColumns.filter((col) => this.projectsVisibleColumns[col.field]);
    this._visibleReportColumns = this.reportsOrderedColumns.filter((col) => this.reportsVisibleColumns[col.field]);
  }

  // Get visible columns for projects table
  getProjectsVisibleColumns(): Column[] {
    return this._visibleProjectColumns;
  }

  // Get visible columns for reports table
  getReportsVisibleColumns(): Column[] {
    return this._visibleReportColumns;
  }

  // Handle column reordering for projects table
  onProjectsColReorder(event: any) {
    if (event && typeof event.dragIndex === 'number' && typeof event.dropIndex === 'number') {
      this.projectsOrderedColumns = this.reorderVisibleColumn(this.projectsOrderedColumns, this._visibleProjectColumns, event.dragIndex, event.dropIndex);
      this.updateVisibleColumns();
      this.syncProjectColumnSelectionFromVisibility();
      this.bumpProjectsTableLayout();
      this.cdr.markForCheck();

      // Save state after column reorder
      if (this.client?.id) {
        this.scheduleStateSave();
      }
    }
  }

  // Handle column reordering for reports table
  onReportsColReorder(event: any) {
    if (event && typeof event.dragIndex === 'number' && typeof event.dropIndex === 'number') {
      this.reportsOrderedColumns = this.reorderVisibleColumn(this.reportsOrderedColumns, this._visibleReportColumns, event.dragIndex, event.dropIndex);
      this.updateVisibleColumns();
      this.syncReportColumnSelectionFromVisibility();
      this.bumpReportsTableLayout();
      this.cdr.markForCheck();

      // Save state after column reorder
      if (this.client?.id) {
        this.scheduleStateSave();
      }
    }
  }

  private syncProjectColumnSelectionFromVisibility(): void {
    this.selectedColumns = this.projectsOrderedColumns.filter((col) => this.projectsVisibleColumns[col.field]);
  }

  private syncReportColumnSelectionFromVisibility(): void {
    this.selectedReportColumns = this.reportsOrderedColumns.filter((col) => this.reportsVisibleColumns[col.field]);
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

    this.updateVisibleColumns();
    this.syncProjectColumnSelectionFromVisibility();
    this.bumpProjectsTableLayout();
    this.cdr.markForCheck();

    // Save state after column changes
    if (this.client?.id) {
      this.saveCurrentState();
    }
  }

  // Update visible columns for reports
  onReportsColumnsChange(selectedColumns: Column[]) {
    // Ensure reportsOrderedColumns has all columns (in case of partial cache restoration)
    if (this.reportsOrderedColumns.length < this.reportCols.length) {
      this.reportsOrderedColumns = this.hydrateOrderedColumns(this.reportsOrderedColumns, this.reportCols);
    }

    // Reset all to false
    Object.keys(this.reportsVisibleColumns).forEach((key) => {
      this.reportsVisibleColumns[key] = false;
    });

    // Set selected columns to true
    selectedColumns.forEach((col) => {
      this.reportsVisibleColumns[col.field] = true;
    });

    this.updateVisibleColumns();
    this.syncReportColumnSelectionFromVisibility();
    this.bumpReportsTableLayout();
    this.cdr.markForCheck();

    // Save state after column changes
    if (this.client?.id) {
      this.saveCurrentState();
    }
  }

  // Add filter methods
  onClientSearch(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.clientSearchTerm = target.value.toLowerCase();
    this.applyFilters();
  }

  onMobileProjectSearchChange(value: string): void {
    this.projectSearchTerm = value.toLowerCase();
    if (this.searchDebounceTimer) clearTimeout(this.searchDebounceTimer);
    this.searchDebounceTimer = window.setTimeout(() => this.applyFilters(), 300);
  }

  onMobileFilialeSearchChange(value: string): void {
    this.filialeSearchTerm = value.toLowerCase();
    if (this.searchDebounceTimer) clearTimeout(this.searchDebounceTimer);
    this.searchDebounceTimer = window.setTimeout(() => this.applyFilters(), 300);
  }

  onProjectSearch(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.projectSearchTerm = target.value.toLowerCase();

    // Debounce the filter application
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }
    this.searchDebounceTimer = setTimeout(() => {
      this.applyFilters();
      if (this.client?.id) {
        this.scheduleStateSave();
      }
    }, this.SEARCH_DEBOUNCE_MS);
  }

  onFilialeSearch(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.filialeSearchTerm = target.value.toLowerCase();

    // Debounce the filter application
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }
    this.searchDebounceTimer = setTimeout(() => {
      this.applyFilters();
      if (this.client?.id) {
        this.scheduleStateSave();
      }
    }, this.SEARCH_DEBOUNCE_MS);
  }

  clearProjectSearch(): void {
    this.projectSearchTerm = '';
    this.applyFilters();
    this.refreshProjectMobileFilterSheetState();
  }

  clearFilialeSearch(): void {
    this.filialeSearchTerm = '';
    this.applyFilters();
    this.refreshProjectMobileFilterSheetState();
  }

  onProjectSearchTermChange(term: string): void {
    this.projectSearchTerm = term.toLowerCase();
    if (this.searchDebounceTimer) clearTimeout(this.searchDebounceTimer);
    this.searchDebounceTimer = setTimeout(() => {
      this.applyFilters();
      this.refreshProjectMobileFilterSheetState();
      if (this.client?.id) this.scheduleStateSave();
    }, this.SEARCH_DEBOUNCE_MS);
  }

  onFilialeSearchTermChange(term: string): void {
    this.filialeSearchTerm = term.toLowerCase();
    if (this.searchDebounceTimer) clearTimeout(this.searchDebounceTimer);
    this.searchDebounceTimer = setTimeout(() => {
      this.applyFilters();
      this.refreshProjectMobileFilterSheetState();
      if (this.client?.id) this.scheduleStateSave();
    }, this.SEARCH_DEBOUNCE_MS);
  }

  private getFilteredProjectsList(excludeFilterType?: string | string[]): Project[] {
    if (!Array.isArray(this.projects) || this.projects.length === 0) {
      return [];
    }

    const excluded = Array.isArray(excludeFilterType) ? excludeFilterType : excludeFilterType ? [excludeFilterType] : [];

    return this.projects.filter((project) => {
      // Ensure derived data is up-to-date before evaluating filters
      this.updateProjectDerivedData(project);

      const projectFilters = this.getProjectReportFilters(project);
      const dateRangeActive = this.isDateRangeActive();
      // Client search - search in project name (since we're in client context)
      const matchesClient = excluded.includes('clientSearch') || !this.clientSearchTerm || (project.name && project.name.toLowerCase().includes(this.clientSearchTerm));

      // Project search - search in project name
      const matchesProject = excluded.includes('projectSearch') || !this.projectSearchTerm || (project.name && project.name.toLowerCase().includes(this.projectSearchTerm));

      // Project name filter - filter by selected project names
      const matchesProjectName =
        excluded.includes('projectName') ||
        !this.projectNameFilter ||
        !Array.isArray(this.projectNameFilter) ||
        this.projectNameFilter.length === 0 ||
        (project.name && this.projectNameFilter.includes(project.name));

      // Filiale search - search in reports' branch name, branch number, and address fields
      // Check if project has any matching reports (use raw reports, not filtered ones)
      const matchesFiliale =
        excluded.includes('filialeSearch') ||
        !this.filialeSearchTerm ||
        (() => {
          // Use raw reports for project-level filtering check (reports themselves are filtered separately in getFilteredReports)
          const reportsToSearch = project.reports;

          // If no reports loaded, we can't determine if it matches, so include it
          // Reports will be loaded when expanded, and then filtering will work correctly
          if (!reportsToSearch || reportsToSearch.length === 0) {
            return true;
          }

          // Search in branch name, branch number, and address fields
          const searchTerm = this.filialeSearchTerm.toLowerCase();
          return reportsToSearch.some((report) => {
            // Search in branch label (number + name)
            const branchLabel = this.getReportBranchLabel(report).toLowerCase();
            if (branchLabel.includes(searchTerm)) return true;

            // Search in branch name separately
            const branchName = (report.branch?.name || '').toLowerCase();
            if (branchName.includes(searchTerm)) return true;

            // Search in branch number separately
            const branchNumber = (report.branch?.branchNumber || '').toString().toLowerCase();
            if (branchNumber.includes(searchTerm)) return true;

            // Search in full address
            const address = this.getReportAddress(report).toLowerCase();
            if (address.includes(searchTerm)) return true;

            // Search in individual address components
            const street = (report.street || '').toLowerCase();
            if (street.includes(searchTerm)) return true;

            const zipCode = (report.zipCode || '').toLowerCase();
            if (zipCode.includes(searchTerm)) return true;

            // Search in city
            if (report.branch && (report.branch as any).city) {
              const city = ((report.branch as any).city.name || '').toLowerCase();
              if (city.includes(searchTerm)) return true;
            }

            // Search in country
            if (report.branch && (report.branch as any).city && (report.branch as any).city.country) {
              const countryObj = (report.branch as any).city.country;
              const country = (countryObj.name?.de || countryObj.name || '').toLowerCase();
              if (country.includes(searchTerm)) return true;
            }

            return false;
          });
        })();

      // Date range filter — project start/end (Zeitraum), not report Geplant
      const matchesDate = !dateRangeActive || excluded.includes('dateRange') || this.isProjectInDateRange(project);

      // Status filter - filter by report status
      const matchesStatus = excluded.includes('status') || !this.statusFilter || this.projectMatchesStatusFilter(project);

      // Project column filters (Zeitraum, Filialen, Status)
      // Guard against this.cols being undefined when applyFilters is called early
      const matchesColumnFilters =
        Array.isArray(this.cols) && this.cols.length > 0
          ? this.cols.every((col) => {
              if (excluded.includes(col.field)) return true;

              const filterValues = this.projectColumnFilterValues[col.field];
              if (!filterValues || !Array.isArray(filterValues) || filterValues.length === 0) {
                return true; // No filter applied for this column
              }

              let projectValue: string = '';
              if (col.field === 'formattedZeitraum') {
                projectValue = this.getProjectZeitraum(project);
              } else if (col.field === 'filialen') {
                const count = this.getProjectStoresCountForFilter(project);
                projectValue = `${count} Stores`;
              } else if (col.field === 'status') {
                // Use reportedPercentage which reflects filtered reports
                const percentage = project.reportedPercentage ?? 0;
                projectValue = `${percentage}% reported`;
              } else {
                projectValue = project[col.field as keyof Project]?.toString() || '';
              }

              return filterValues.includes(this.normalizeColumnFilterValue(projectValue));
            })
          : true;

      // Check if all basic filters match
      const basicFiltersMatch = matchesClient && matchesProject && matchesProjectName && matchesFiliale && matchesStatus && matchesColumnFilters && matchesDate;

      if (!basicFiltersMatch) {
        return false;
      }

      // If a status filter is active (from query params), filter by stores count and reports
      if (this.statusFilter && !excluded.includes('status')) {
        // Only show projects with stores (branchesCount > 0)
        const branchesCount = project.branchesCount ?? 0;
        if (branchesCount === 0) {
          return false;
        }

        // Check if reports are loaded
        if (project.reports) {
          // If project has 0 reports total, hide it when status filter is active
          if (project.reports.length === 0) {
            return false;
          }

          // Check filtered reports count
          const filteredReportsCount = project._filteredReports?.length ?? 0;
          // If there are 0 filtered reports matching the status, hide the project
          if (filteredReportsCount === 0) {
            return false;
          }
        }
      }

      // If report status filter is active (from column filter), check filtered reports
      if (projectFilters.status && Array.isArray(projectFilters.status) && projectFilters.status.length > 0) {
        if (project.reports) {
          const filteredReportsCount = this.filteredReports(project).length;
          // If there are 0 filtered reports, hide the project
          if (filteredReportsCount === 0) {
            return false;
          }
        }
      }

      // If Geplant Von–Bis range filter is active, hide projects with no matching reports
      if (this.isPlannedOnDateRangeActive()) {
        if (project.reports) {
          const filteredReportsCount = this.filteredReports(project).length;
          if (filteredReportsCount === 0) {
            return false;
          }
        }
      }

      return true;
    });
  }

  private applyFilters(): void {
    const start = this.now();
    this.logDebug('applyFilters start', {
      totalProjects: this.projects?.length ?? 0,
      filters: {
        status: this.statusFilter,
        clientSearch: this.clientSearchTerm,
        projectSearch: this.projectSearchTerm,
        filialeSearch: this.filialeSearchTerm,
      },
    });
    if (!Array.isArray(this.projects) || this.projects.length === 0) {
      this.filteredProjects = Array.isArray(this.projects) ? [...this.projects] : [];
      this.logDuration('applyFilters finished (no projects)', start, {
        filteredCount: this.filteredProjects.length,
      });
      return;
    }

    this.filteredProjects = this.getFilteredProjectsList();

    if (this.projectSortField) {
      this.filteredProjects = this.applyProjectSorting(this.filteredProjects, this.projectSortField, this.projectSortOrder);
    }

    // Filtering is purely client-side - no backend calls needed

    // Automatically expand all filtered projects when searching by branch or date
    const isBranchSearchActive = this.filialeSearchTerm && this.filialeSearchTerm.trim().length > 0;
    const isDateSearchActive = this.dateRange2?.start && this.dateRange2?.end;
    const isPlannedOnDateSearchActive = this.isPlannedOnDateRangeActive();
    const isStatusFilterActive = this.statusFilter && this.statusFilter.trim().length > 0;

    if (isBranchSearchActive || isDateSearchActive || isPlannedOnDateSearchActive || isStatusFilterActive) {
      // Expand all filtered projects
      const newExpandedRows: { [key: string]: boolean } = {};
      this.filteredProjects.forEach((project) => {
        if (project?.id) {
          newExpandedRows[project.id.toString()] = true;
        }
      });
      this.expandedRows = newExpandedRows;
    }

    // Update derived data for all filtered projects to ensure report filters are applied
    // (getFilteredProjectsList already updates projects when statusFilter is active)
    if (!this.statusFilter) {
      this.filteredProjects.forEach((project) => {
        this.updateProjectDerivedData(project);
      });
    }

    // If filiale search is active, preload reports for filtered projects that don't have reports loaded yet
    // (Date range filters by project Zeitraum only; no report preload needed.) Limit to first 10 projects.
    if (isBranchSearchActive) {
      const projectsToPreload = this.filteredProjects.filter((p) => p && p.id && (!p.reports || p.reports.length === 0)).slice(0, 10); // Limit to first 10 to avoid too many simultaneous requests

      projectsToPreload.forEach((project) => {
        if (project && project.id) {
          // Load reports in background for branch/date search without showing loading spinner
          this.reportCacheService
            .getProjectReports(project.id)
            .pipe(take(1))
            .subscribe({
              next: (reports) => {
                project.reports = reports;
                (project as any)._derivedDataSignature = null;
                this.updateProjectDerivedData(project);
                // Re-apply filters after reports are loaded to update the filtered list
                this.applyFilters();
                this.cdr.markForCheck();
              },
              error: (err) => {
                console.error(`Error preloading reports for branch/date search (project ${project.id}):`, err);
                project.reports = [];
                this.updateProjectDerivedData(project);
                this.cdr.markForCheck();
              },
            });
        }
      });
    }

    // If no project is currently selected, but we have project-specific report filters, re-select that project
    this.ensureProjectSelectionFromFilters();

    // Auto-expand first project if no visible project is expanded (skip when route targets a project)
    const routeProjectSlug = this.getRouteProjectSlug();
    const hasVisibleExpanded = this.filteredProjects.some((p) => p.id && this.expandedRows[p.id.toString()]);
    if (!routeProjectSlug && !hasVisibleExpanded && this.filteredProjects.length > 0) {
      const p = this.filteredProjects[0];
      if (p?.id) {
        this.selectProject(p);
      }
    }

    this.cdr.markForCheck();

    // Update sidebar with unfiltered projects (filters apply only to main content, not sidebar)
    if (this.client?.id && this.projects) {
      this.clientService.setClientProjects(
        this.client.id.toString(),
        this.projects.map((p) => ({
          id: p.id?.toString() ?? '',
          name: p.name ?? '',
          clientId: this.client!.id.toString(),
        })),
      );
    }

    // Update filter options
    this.updateFilterOptions();
    this.refreshActiveColumnFilterOptions();

    // Schedule state save (debounced) instead of immediate save
    if (this.client?.id) {
      this.scheduleStateSave();
    }
    this.logDuration('applyFilters finished', start, {
      filteredCount: this.filteredProjects.length,
    });
  }

  private updateFilterOptions(): void {
    // We no longer pre-calculate all filter options here as it causes massive performance issues
    // on every change detection/filter application.
    // Instead, options are calculated on-demand when the respective filter popup is opened.
  }

  private refreshActiveColumnFilterOptions(): void {
    if (!this.currentProjectFilterField) {
      return;
    }

    this.currentProjectColumnOptions = this.calculateUniqueValuesForProjectColumn(this.currentProjectFilterField);
  }

  private ensureProjectSelectionFromFilters(): void {
    if (this.selectedProject || !Array.isArray(this.projects) || this.projects.length === 0) {
      return;
    }

    const projectWithFilters = this.projects.find((proj) => this.hasAnyReportFilter(this.getProjectReportFilters(proj)));
    if (projectWithFilters && projectWithFilters.id) {
      this.selectedProject = projectWithFilters;
      this.updateReportColumnsForProject(projectWithFilters);
      this.expandedRows = { [projectWithFilters.id.toString()]: true };

      if (this.client?.id) {
        this.clientService.setSelectedProject(this.client.id.toString(), projectWithFilters.id.toString());
      }

      this.loadProjectReports(projectWithFilters);
    }
  }

  // Get unique project names for filter
  getUniqueProjectNames(): { label: string; value: string }[] {
    return this.projectNamesOptions;
  }

  calculateUniqueProjectNames(): { label: string; value: string }[] {
    if (!Array.isArray(this.projects) || this.projects.length === 0) {
      return [];
    }

    // Use filtered projects, excluding project name filter
    const projects = this.getFilteredProjectsList(['projectName', 'status']);

    const uniqueNames = new Set<string>();
    projects.forEach((project) => {
      if (project.name) {
        uniqueNames.add(project.name);
      }
    });
    this.appendSelectedFilterValues(uniqueNames, this.projectNameFilter);
    return Array.from(uniqueNames)
      .sort()
      .map((name) => ({ label: name, value: name }));
  }

  // Handle project name filter change
  onProjectNameFilterChange(): void {
    if (!this.projectNameFilter) {
      this.projectNameFilter = [];
    }

    // If project name filter is active, clear status filter
    if (this.projectNameFilter.length > 0 && this.statusFilter) {
      this.statusFilter = '';

      // Update URL to remove status param
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { status: null },
        queryParamsHandling: 'merge',
      });
    }

    this.applyFilters();
  }

  /** Whether to show column filter as centered modal (mobile) instead of popover. */
  isMobileColumnFilter(): boolean {
    return typeof window !== 'undefined' && window.innerWidth < 1024;
  }

  openProjectsMobileFilterSheet(): void {
    this.refreshProjectMobileFilterSheetState();

    this.showMobileProjectFilters = true;
  }

  private refreshProjectMobileFilterSheetState(): void {
    this.projectMobileColumns = [{ field: 'name', header: 'Projekt' }, ...(this._visibleProjectColumns || []).map((col) => ({ field: col.field, header: col.header }))];

    this.projectMobileFilterValues = {
      ...this.projectColumnFilterValues,
      name: this.projectNameFilter || [],
    };

    const refreshedOptions: { [key: string]: any[] } = {};
    const refreshedCanFilterMap: { [key: string]: boolean } = {};

    refreshedOptions['name'] = this.calculateUniqueProjectNames();
    refreshedCanFilterMap['name'] = this.hasProjectColumnData('name');

    (this._visibleProjectColumns || []).forEach((col) => {
      const field = col.field;
      refreshedOptions[field] = this.calculateUniqueValuesForProjectColumn(field);
      refreshedCanFilterMap[field] = this.hasProjectColumnData(field);
    });

    this.projectMobileColumnOptions = refreshedOptions;
    this.projectMobileCanFilterMap = refreshedCanFilterMap;
  }

  onProjectsMobileFilterChanged(event: { field: string; values: string[] }): void {
    const f = event.field;
    const v = event.values;

    if (f === 'name') {
      this.projectNameFilter = v;
    } else {
      this.projectColumnFilterValues[f] = v;
    }

    this.projectMobileFilterValues[f] = v;
    this.projectMobileFilterValues = { ...this.projectMobileFilterValues };
    this.applyFilters();
    this.cdr.markForCheck();
  }

  getTotalProjectsActiveFilters(): number {
    let count = 0;
    Object.values(this.projectMobileFilterValues).forEach((values) => {
      if (Array.isArray(values)) {
        count += values.length;
      }
    });
    return count;
  }

  onProjectsMobileFilterCleared(): void {
    this.projectColumnFilterValues = {};
    this.projectNameFilter = [];
    this.projectMobileFilterValues = {};
    this.applyFilters();
    this.cdr.markForCheck();
  }

  openReportsMobileFilterSheet(): void {
    const projectToUse = this.selectedProject || this.projects?.find((p) => p.id === this.sidebarVisibleProjectId);
    if (!projectToUse) return;
    this.selectedProject = projectToUse;
    this.syncUiFiltersFromProject(projectToUse);

    // 1. Build columns
    this.reportMobileColumns = [{ field: 'status', header: 'Status' }, ...(this._visibleReportColumns || []).map((col) => ({ field: col.field, header: col.header }))];

    // 2. Build filter values based on project._reportFilters
    this.reportMobileFilterValues = { ...this.genericFilterValues };
    this.reportMobileFilterValues['status'] = projectToUse._reportFilters?.status || [];
    this.reportMobileFilterValues['plannedOn'] = projectToUse._reportFilters?.plannedOn || [];
    this.reportMobileFilterValues['merchandiser'] = projectToUse._reportFilters?.merchandiser || [];
    this.reportMobileFilterValues['branch.name'] = projectToUse._reportFilters?.filialen || [];
    if (projectToUse._reportFilters?.generic) {
      Object.keys(projectToUse._reportFilters.generic).forEach((k) => {
        this.reportMobileFilterValues[k] = projectToUse._reportFilters?.generic[k] || [];
      });
    }

    // 3. Build options
    this.reportMobileColumnOptions['status'] = this.calculateUniqueReportStatuses(projectToUse);
    this.reportMobileCanFilterMap['status'] = this.canFilterStatus(projectToUse);

    this.reportMobileColumnOptions['plannedOn'] = this.calculateUniquePlannedOnDates(projectToUse);
    this.reportMobileCanFilterMap['plannedOn'] = this.canFilterPlannedOn(projectToUse);

    this.reportMobileColumnOptions['merchandiser'] = this.calculateUniqueMerchandisers(projectToUse);
    this.reportMobileCanFilterMap['merchandiser'] = this.canFilterMerchandiser(projectToUse);

    this.reportMobileColumnOptions['branch.name'] = this.calculateUniqueFilialen(projectToUse);
    this.reportMobileCanFilterMap['branch.name'] = this.canFilterFilialen(projectToUse);

    (this._visibleReportColumns || []).forEach((col) => {
      const f = col.field;
      if (f !== 'plannedOn' && f !== 'merchandiser' && f !== 'branch.name') {
        this.reportMobileColumnOptions[f] = this.calculateUniqueValuesForField(f, projectToUse);
        this.reportMobileCanFilterMap[f] = this.canFilterGenericField(f, projectToUse);
      }
    });

    this.showReportsMobileFilter = true;
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

  rememberMobileReportsSidebarState(projectId?: string | number): void {
    this.captureMobileReportsSidebarScrollPosition(projectId);
    if (this.client?.id) {
      this.saveCurrentState();
    }
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
    const maxAttempts = 120;
    const tryRestore = () => {
      const sidebarScrollContainer = document.querySelector(`[data-mobile-project-id="${key}"]`) as HTMLElement | null;
      if (sidebarScrollContainer) {
        // Apply multiple times to survive asynchronous content growth and sidebar animations.
        sidebarScrollContainer.scrollTop = targetPosition;
        requestAnimationFrame(() => {
          sidebarScrollContainer.scrollTop = targetPosition;
          setTimeout(() => {
            sidebarScrollContainer.scrollTop = targetPosition;
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

  onReportsMobileFilterChanged(event: { field: string; values: string[] }): void {
    const projectToUse = this.selectedProject || this.projects?.find((p) => p.id === this.sidebarVisibleProjectId);
    if (!projectToUse) return;
    if (!projectToUse._reportFilters) projectToUse._reportFilters = this.cloneProjectFilters(this.defaultReportFilters);

    const f = event.field;
    const v = event.values;

    if (f === 'status') projectToUse._reportFilters.status = v;
    else if (f === 'plannedOn') projectToUse._reportFilters.plannedOn = v;
    else if (f === 'merchandiser') projectToUse._reportFilters.merchandiser = v;
    else if (f === 'branch.name') projectToUse._reportFilters.filialen = v;
    else projectToUse._reportFilters.generic[f] = v;

    this.applyFilters();
    this.syncUiFiltersFromProject(projectToUse);

    this.reportMobileFilterValues[f] = v;
    this.reportMobileFilterValues = { ...this.reportMobileFilterValues };

    if (this.client?.id) this.scheduleStateSave();
  }

  onReportsMobileFilterCleared(): void {
    const projectToUse = this.selectedProject || this.projects?.find((p) => p.id === this.sidebarVisibleProjectId);
    if (!projectToUse) return;

    projectToUse._reportFilters = this.cloneProjectFilters(this.defaultReportFilters);
    this.applyFilters();
    this.syncUiFiltersFromProject(projectToUse);

    this.reportMobileFilterValues = {};

    if (this.client?.id) this.scheduleStateSave();
  }

  getTotalReportsActiveFilters(): number {
    if (!this.reportMobileFilterValues) return 0;
    let count = 0;
    Object.values(this.reportMobileFilterValues).forEach((arr: any) => {
      count += arr?.length || 0;
    });
    return count;
  }

  openColumnFilterModal(): void {
    this.showColumnFilterModal = true;
    this.cdr.detectChanges();
  }

  closeColumnFilterModal(): void {
    this.showColumnFilterModal = false;
    this.columnFilterModalType = null;
    this.cdr.detectChanges();
  }

  getColumnFilterModalTitle(): string {
    if (this.columnFilterModalType === 'projectName') {
      return 'Projekt';
    }
    if (this.columnFilterModalType === 'project' && this.currentProjectFilterField) {
      return this.getProjectColumnHeader(this.currentProjectFilterField);
    }
    if (this.columnFilterModalType === 'reportStatus') return 'Status';
    if (this.columnFilterModalType === 'reportMerchandiser') return 'VM';
    if (this.columnFilterModalType === 'reportFilialen') return 'Filialen';
    if (this.columnFilterModalType === 'reportPlannedOn') return 'Geplant am';
    if (this.columnFilterModalType === 'reportGeneric' && this.currentFilterField) {
      return this.getColumnHeader(this.currentFilterField);
    }
    return 'Filter';
  }

  hasColumnFilterModalSelection(): boolean {
    if (this.columnFilterModalType === 'projectName') {
      return (this.projectNameFilter || []).length > 0;
    }
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
      return (this.reportPlannedOnFilter || []).length > 0 || this.isPlannedOnDateRangeActive();
    }
    if (this.columnFilterModalType === 'reportGeneric' && this.currentFilterField) {
      return (this.genericFilterValues[this.currentFilterField] || []).length > 0;
    }
    return false;
  }

  onColumnFilterModalCleared(): void {
    if (this.columnFilterModalType === 'projectName') {
      this.projectNameFilter = [];
      this.onProjectNameFilterChange();
      return;
    }
    if (this.columnFilterModalType === 'project') {
      this.onProjectColumnFilterCleared();
      return;
    }
    if (this.columnFilterModalType === 'reportStatus') {
      this.reportStatusFilter = [];
      this.onReportStatusFilterChange([]);
      return;
    }
    if (this.columnFilterModalType === 'reportMerchandiser') {
      this.onReportMerchandiserFilterCleared();
      return;
    }
    if (this.columnFilterModalType === 'reportFilialen') {
      this.reportFilialenFilter = [];
      this.onReportFilialenFilterChange([]);
      return;
    }
    if (this.columnFilterModalType === 'reportPlannedOn') {
      this.onReportPlannedOnFilterCleared();
      this.plannedOnDateRange = { start: null, end: null };
      this.onPlannedOnRangeSelected({ start: null, end: null });
      return;
    }
    if (this.columnFilterModalType === 'reportGeneric' && this.currentFilterField) {
      this.genericFilterValues[this.currentFilterField] = [];
      this.onGenericFilterChange([]);
    }
  }

  // Open project column filter popover (desktop) or modal (mobile)
  openProjectColumnFilter(field: string, event: Event): void {
    event.stopPropagation();
    const targetElement = (event.currentTarget || event.target) as HTMLElement;
    if (!targetElement) {
      return;
    }

    const previousField = this.currentProjectFilterField;

    // On mobile: open centered modal instead of popover (same as dashboard)
    if (this.isMobileColumnFilter()) {
      const isSameField = previousField === field;
      if (isSameField && this.showColumnFilterModal && this.columnFilterModalType === 'project') {
        this.closeColumnFilterModal();
        return;
      }
      // If a column-filter modal is already open, swap content in place (avoids p-dialog onHide race).
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

  // Get filter value for a project column
  getProjectColumnFilterValue(field: string): string[] {
    return this.projectColumnFilterValues[field] || [];
  }

  // Get unique values for a project column
  getUniqueValuesForProjectColumn(field: string): { label: string; value: string }[] {
    if (field === this.currentProjectFilterField) {
      return this.currentProjectColumnOptions;
    }
    return this.calculateUniqueValuesForProjectColumn(field);
  }

  // Calculate unique values for a project column
  calculateUniqueValuesForProjectColumn(field: string): { label: string; value: string }[] {
    if (!Array.isArray(this.projects) || this.projects.length === 0) {
      return [];
    }

    // Use filtered projects, excluding only the current column filter.
    // Keep active status query filter applied so options reflect the visible set.
    const projects = this.getFilteredProjectsList([field]);

    const uniqueValues = new Set<string>();

    projects.forEach((project) => {
      let value: string = '';

      if (field === 'formattedZeitraum') {
        value = this.getProjectZeitraum(project);
      } else if (field === 'filialen') {
        const count = this.getProjectStoresCountForFilter(project);
        value = `${count} Stores`;
      } else if (field === 'status') {
        // Use reportedPercentage which reflects filtered reports
        const percentage = project.reportedPercentage ?? 0;
        value = `${percentage}% reported`;
      } else {
        value = project[field as keyof Project]?.toString() || '';
      }

      uniqueValues.add(this.normalizeColumnFilterValue(value));
    });
    this.appendSelectedFilterValues(uniqueValues, this.projectColumnFilterValues[field]);

    return this.sortColumnFilterValues(Array.from(uniqueValues)).map((val) => ({
      label: this.getColumnFilterOptionLabel(val),
      value: val,
    }));
  }

  // Get column header for project columns
  getProjectColumnHeader(field: string): string {
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

  /** Returns the number of selected values for a report column filter (for tooltip). */
  getReportFilterSelectedCount(project: Project | null | undefined, columnField: string): number {
    const filters = this.getProjectReportFilters(project);
    if (columnField === 'status') return filters.status?.length ?? 0;
    if (columnField === 'merchandiser') return filters.merchandiser?.length ?? 0;
    if (columnField === 'branch.name') return filters.filialen?.length ?? 0;
    if (columnField === 'plannedOn') {
      if (this.isPlannedOnDateRangeActive()) {
        return 1;
      }
      return filters.plannedOn?.length ?? 0;
    }
    return filters.generic?.[columnField]?.length ?? 0;
  }

  // Handle project column filter change
  onProjectColumnFilterChange(values?: string[] | null): void {
    if (this.currentProjectFilterField) {
      if (Array.isArray(values)) {
        this.projectColumnFilterValues[this.currentProjectFilterField] = values;
      } else if (values === null) {
        this.projectColumnFilterValues[this.currentProjectFilterField] = [];
      }
    }

    this.applyFilters();

    // Save state after filter change
    if (this.client?.id) {
      this.scheduleStateSave();
    }
  }

  onProjectColumnFilterCleared(): void {
    if (this.currentProjectFilterField) {
      this.projectColumnFilterValues[this.currentProjectFilterField] = [];
    }
    this.onProjectColumnFilterChange([]);
  }

  // Check if any project column filters are active
  hasProjectColumnFilters(): boolean {
    return Object.keys(this.projectColumnFilterValues).some(
      (key) => this.projectColumnFilterValues[key] && Array.isArray(this.projectColumnFilterValues[key]) && this.projectColumnFilterValues[key].length > 0,
    );
  }

  hasReportColumnFilters(project?: Project): boolean {
    if (this.isPlannedOnDateRangeActive()) {
      return true;
    }

    if (project) {
      return this.hasAnyReportFilter(this.getProjectReportFilters(project));
    }

    if (this.hasAnyReportFilter(this.defaultReportFilters)) {
      return true;
    }

    return (this.projects || []).some((proj) => this.hasAnyReportFilter(this.getProjectReportFilters(proj)));
  }

  hasReportStatusFilter(project?: Project): boolean {
    return this.getProjectReportFilters(project).status.length > 0;
  }

  hasReportMerchandiserFilter(project?: Project): boolean {
    return this.getProjectReportFilters(project).merchandiser.length > 0;
  }

  hasReportFilialenFilter(project?: Project): boolean {
    return this.getProjectReportFilters(project).filialen.length > 0;
  }

  hasReportPlannedOnFilter(project?: Project): boolean {
    if (this.isPlannedOnDateRangeActive()) {
      return true;
    }

    return this.getProjectReportFilters(project).plannedOn.length > 0;
  }

  hasReportGenericFilter(field: string, project?: Project): boolean {
    return this.getGenericFilterValue(field, project).length > 0;
  }

  hasActiveSorts(): boolean {
    return this.projectSortField !== '' || this.reportSortField !== '';
  }

  // Clear all filters
  clearFilters(): void {
    this.closeColumnFilterModal();
    this.statusFilter = '';
    this.clientSearchTerm = '';
    this.projectSearchTerm = '';
    this.projectNameFilter = [];
    this.projectColumnFilterValues = {};
    this.filialeSearchTerm = '';
    this.dateRange2 = { start: null, end: null };
    this.plannedOnDateRange = { start: null, end: null };
    this.reportPlannedOnFilter = [];

    // Clear report column filters
    // Note: We do NOT clear expandedRows here to keep projects expanded when clearing filters
    this.reportStatusFilter = [];
    this.reportMerchandiserFilter = [];
    this.reportFilialenFilter = [];
    this.genericFilterValues = {};

    // Reset per-project filters and defaults so filters stop leaking across projects
    this.defaultReportFilters = {
      status: [],
      merchandiser: [],
      filialen: [],
      plannedOn: [],
      generic: {},
    };
    if (Array.isArray(this.projects)) {
      this.projects.forEach((proj) => {
        if (proj) {
          proj._reportFilters = this.cloneProjectFilters(this.defaultReportFilters);
        }
      });
    }

    // Clear sort fields
    this.projectSortField = '';
    this.projectSortOrder = 1;
    this.reportSortField = '';
    this.reportSortOrder = 1;

    // Remove all filter query params (including dynamic project/generic filters)
    this.removeFilterQueryParams();

    // Recompute filtered lists and derived data (filialen counts) with no filters
    this.applyFilters();

    // Save state after clearing filters
    if (this.client?.id) {
      this.saveCurrentState();
    }

    // Reload reports for all expanded projects without filters
    this.reloadReportsForExpandedProjects();
  }

  /**
   * Check if a project matches the status filter
   * @param project The project to check
   * @returns true if the project matches the status filter
   */
  private projectMatchesStatusFilter(project: Project): boolean {
    if (!this.statusFilter) {
      return true; // No filter
    }

    // If no reports loaded yet, let the project through (reports will be loaded later)
    if (!project.reports || project.reports.length === 0) {
      return true;
    }

    // Check if any report in the project matches the status filter using the same logic as reportMatchesStatus
    return project.reports.some((report) => this.reportMatchesStatus(report, this.statusFilter));
  }

  /**
   * Get formatted status filter for display in heading
   */
  getStatusFilterDisplay(): string {
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

  /**
   * Check if any report in the project has a missing merchandiser
   */
  hasMissingMerchandisers(project: Project): boolean {
    if (!project._filteredReports || project._filteredReports.length === 0) {
      return false;
    }
    return project._filteredReports.some((report) => !report.merchandiser || !report.merchandiser.user);
  }

  /**
   * Check if any report in the project has a missing plannedOn date
   */
  hasMissingPlannedOn(project: Project): boolean {
    if (!project._filteredReports || project._filteredReports.length === 0) {
      return false;
    }
    return project._filteredReports.some((report) => !report.plannedOn);
  }

  /**
   * Get total count of filtered reports across all filtered projects
   * Only returns count when statusFilter exists in query params
   */
  getFilteredReportsCount(): number {
    if (!this.statusFilter || !this.filteredProjects || this.filteredProjects.length === 0) {
      return 0;
    }

    let totalCount = 0;
    this.filteredProjects.forEach((project) => {
      if (project._filteredReports && Array.isArray(project._filteredReports)) {
        totalCount += project._filteredReports.length;
      }
    });

    return totalCount;
  }

  /**
   * Get the current status filter value
   * @returns The status filter value
   */
  getStatusFilter(): string {
    return this.statusFilter;
  }

  private getReportFilterCacheKey(project: Project): string {
    if (project.id) {
      return `project-${project.id}`;
    }
    return `project-${project.name ?? 'unknown'}`;
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

  private getCurrentReportFilterSignature(project?: Project): string {
    const filters = this.getProjectReportFilters(project);
    const genericKeys = Object.keys(filters.generic).sort();
    const genericSignature = genericKeys.map((key) => `${key}:${this.formatFilterArray(filters.generic[key])}`).join('|');

    return [
      this.statusFilter || '',
      this.formatFilterArray(filters.status),
      this.formatFilterArray(filters.merchandiser),
      this.formatFilterArray(filters.filialen),
      this.formatFilterArray(filters.plannedOn),
      this.isPlannedOnDateRangeActive() ? `${this.normalizeDateToYmd(this.plannedOnDateRange.start)}-${this.normalizeDateToYmd(this.plannedOnDateRange.end)}` : '',
      genericSignature,
    ].join('||');
  }

  private loadClient(): void {
    const clientId = this.route.snapshot.paramMap.get('id') || this.route.snapshot.paramMap.get('clientId');
    if (clientId) {
      // this.client is set from the backend response in ngOnInit
    }
  }

  // Bulk insert reports for a project using uploaded CSV data
  bulkInsertCsvReports(project: Project): void {
    if (!project || !project.id || !this.uploadedCsvData.length) {
      console.warn('No project selected or no CSV data to insert.');
      return;
    }
    this.reportService.bulkInsertReports(project.id, this.uploadedCsvData).subscribe({
      next: (response: any) => {
        const createdCount = response?.reports?.length ?? 0;
        const errorCount = response?.errors?.length ?? 0;
        const skippedCount = response?.skipped?.length ?? 0;

        if (errorCount > 0 || skippedCount > 0) {
          const details: string[] = [];
          if (createdCount > 0) details.push(`${createdCount} Erfolgreich`);
          if (errorCount > 0) details.push(`${errorCount} Fehler`);
          if (skippedCount > 0) details.push(`${skippedCount} Übersprungen`);
          this.toast.warning(`CSV hochgeladen: ${details.join(', ')}`, {
            position: 'bottom-right',
            duration: 6000,
          });
        } else {
          this.toast.success(`${createdCount} CSV-Zeile(n) erfolgreich hochgeladen`, {
            position: 'bottom-right',
            duration: 4000,
            icon: '✅',
          });
        }
      },
      error: (error) => {
        console.error('Bulk insert failed:', error);
        this.toast.error('Bulk-Insert fehlgeschlagen!', {
          position: 'bottom-right',
          duration: 5000,
          icon: '❌',
        });
      },
    });
  }

  // Excel upload button handler
  openExcelUploader(project: Project): void {
    this.selectedProject = project;
    if (this.excelFileInput) {
      this.excelFileInput.nativeElement.value = '';
      this.excelFileInput.nativeElement.click();
    }
  }

  // Excel test upload button handler
  openExcelTestUploader(project: Project): void {
    this.selectedProject = project;
    if (this.excelTestFileInput) {
      this.excelTestFileInput.nativeElement.value = '';
      this.excelTestFileInput.nativeElement.click();
    }
  }

  // Helper: map Excel row to structured object
  /**
   * Convert Excel date serial number to date string (DD/MM/YYYY format)
   * Excel stores dates as days since 1899-12-30
   */
  private convertExcelDateToDateString(value: any): string {
    // If it's already a string, try to parse it or return as is
    if (typeof value === 'string') {
      const trimmed = value.trim();
      // If it's already a valid date string format, return it
      if (trimmed && (trimmed.includes('/') || trimmed.includes('-') || trimmed.includes('.'))) {
        return trimmed;
      }
      // Try to parse as number
      const numValue = parseFloat(trimmed);
      if (!isNaN(numValue)) {
        value = numValue;
      } else {
        return trimmed; // Return as is if it's a string but not a number
      }
    }

    // If it's a number (Excel serial date), convert it
    if (typeof value === 'number' && !isNaN(value) && value > 0) {
      // Excel epoch: December 30, 1899
      const excelEpoch = new Date(1899, 11, 30);
      // Calculate the actual date
      const date = new Date(excelEpoch.getTime() + value * 24 * 60 * 60 * 1000);

      // Format as DD/MM/YYYY
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();

      return `${day}/${month}/${year}`;
    }

    // Return empty string if value is invalid
    return '';
  }

  private normalizeExcelHeader(header: string): string {
    return header.toLowerCase().replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
  }

  private normalizeExcelCellValue(value: unknown): string {
    if (value === undefined || value === null) {
      return '';
    }
    return String(value).trim();
  }

  private normalizeExcelBranchNumber(value: unknown): string {
    const raw = this.normalizeExcelCellValue(value);
    if (!raw) {
      return '';
    }
    // Excel may read integer Filialnummer values as floats (e.g. 1.0, 5.0)
    if (/^\d+\.0+$/.test(raw)) {
      return raw.replace(/\.0+$/, '');
    }
    return raw;
  }

  private excelHeaderMatches(columnKey: string, expectedHeader: string): boolean {
    const keyNorm = this.normalizeExcelHeader(columnKey);
    const headerNorm = this.normalizeExcelHeader(expectedHeader);
    if (keyNorm === headerNorm) {
      return true;
    }

    // Prevent FILIALNUMMER from matching FILIALE header variations
    if (headerNorm === 'filiale' && keyNorm.includes('filialnummer')) {
      return false;
    }
    if (headerNorm.startsWith('filiale') && keyNorm.includes('filialnummer')) {
      return false;
    }
    if (keyNorm.startsWith('filiale') && headerNorm.includes('filialnummer')) {
      return false;
    }

    if (headerNorm.length >= 4 && (keyNorm.startsWith(headerNorm) || keyNorm.includes(headerNorm))) {
      return true;
    }
    return false;
  }

  private findExcelColumnValueByNormalizedKey(row: any, normalizedHeader: string): string | undefined {
    for (const key of Object.keys(row)) {
      if (this.normalizeExcelHeader(key) === normalizedHeader) {
        const value = this.normalizeExcelCellValue(row[key]);
        if (value.length > 0) {
          return value;
        }
      }
    }
    return undefined;
  }

  private findExcelColumnValue(row: any, possibleHeaders: string[]): string | undefined {
    for (const header of possibleHeaders) {
      if (row[header] !== undefined && row[header] !== null && row[header] !== '') {
        const value = this.normalizeExcelCellValue(row[header]);
        if (value.length > 0) {
          return value;
        }
      }
    }

    const rowKeys = Object.keys(row);
    for (const header of possibleHeaders) {
      for (const key of rowKeys) {
        if (this.excelHeaderMatches(key, header)) {
          const value = this.normalizeExcelCellValue(row[key]);
          if (value.length > 0) {
            return value;
          }
        }
      }
    }

    return undefined;
  }

  private mapExcelRowToReport(row: any): any {
    const getValue = (possibleHeaders: string[]): string => this.findExcelColumnValue(row, possibleHeaders) ?? '';

    const branchNumber = this.normalizeExcelBranchNumber(
      getValue(['FILIALNUMMER', 'Filialnummer', 'FILIAL NR', 'Filial Nr', 'BRANCH NUMBER', 'Branch Number']) ||
        this.findExcelColumnValueByNormalizedKey(row, 'filialnummer') ||
        '',
    );

    const getDateValue = (possibleHeaders: string[]): string => {
      const value = this.findExcelColumnValue(row, possibleHeaders);
      return value ? this.convertExcelDateToDateString(value) : '';
    };

    // Map static fields with multiple possible header variations
    const mapped: any = {
      branchNumber,
      branch: getValue(['FILIALE\n(Text)', 'FILIALE (Text)', 'Filiale', 'FILIALE', 'Branch', 'BRANCH', 'Filiale (Text)']),
      street: getValue(['STRABE +\nHAUSNUM\nMER', 'STRABE + HAUSNUM MER', 'Straße', 'STRASSE', 'Street', 'STREET', 'Straße + Hausnummer', 'STRABE + HAUSNUM MER']),
      zip: getValue(['PLZ', 'Postleitzahl', 'ZIP', 'Zip Code', 'ZIP Code']) || this.findExcelColumnValueByNormalizedKey(row, 'plz') || '',
      city: getValue(['ORT', 'Ort', 'City', 'CITY', 'Stadt']) || this.findExcelColumnValueByNormalizedKey(row, 'ort') || '',
      country: getValue(['LAND', 'Country', 'COUNTRY', 'Land']) || this.findExcelColumnValueByNormalizedKey(row, 'land') || '',
      phone: getValue(['TELEFON\nFILIALE\n(Text)', 'TELEFON FILIALE (Text)', 'Telefon', 'TELEFON', 'Phone', 'PHONE', 'Telefon Filiale', 'TELEFON\nFILIALE']),
      note: getValue(['NOTIZ\n(Text)', 'NOTIZ (Text)', 'Notiz', 'NOTIZ', 'Note', 'NOTE']),
      merchandiser: getValue(['MERCHANDISER\n(Text)', 'MERCHANDISER (Text)', 'Merchandiser', 'MERCHANDISER']),
      plannedOn: getDateValue(['BESUCHSDATUM', 'Besuchsdatum', 'Planned On', 'PLANNED ON', 'Visit Date']),
      reportTo: getDateValue(['Report bis', 'Report Bis', 'REPORT BIS', 'Report To', 'REPORT TO']),
      feedback: getValue(['Feedback\n1. JA\n2. NEIN', 'Feedback', 'FEEDBACK']).toLowerCase() === 'ja',
      questions: [],
    };
    // Extract questions
    Object.keys(row).forEach((key) => {
      if (key.startsWith('FRAGE')) {
        // Extract only the first line inside the quotes as the question text
        const match = key.match(/^FRAGE \d+:\n\"([\s\S]+?)\"/);
        let questionText = key;
        if (match) {
          // Take only the first line (before any \n)
          questionText = match[1].split('\n')[0].trim();
        }
        let answer = row[key];
        // If answer is 'Ja'/'Nein', convert to boolean
        if (answer === 'Ja') answer = true;
        else if (answer === 'Nein') answer = false;
        // If answer is comma-separated, convert to array
        else if (typeof answer === 'string' && answer.includes(',')) answer = answer.split(',').map((s: string) => s.trim());
        mapped.questions.push({ question: questionText, answer });
      }
    });
    return mapped;
  }

  // Handle Excel file upload (for real bulk insert, but for now just log)
  handleExcelFileUpload(event: Event): void {
    const fileInput = event.target as HTMLInputElement;
    const file = fileInput?.files?.[0];
    if (file && this.selectedProject) {
      this.excelUploadProjectId = this.selectedProject.id?.toString() || null;
      this.excelUploadInProgress = true;
      this.cdr.markForCheck();
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const json = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
        const mapped = json.map((row) => this.mapExcelRowToReport(row));
        // Call bulk insert logic
        this.reportService.bulkInsertReports(this.selectedProject.id, mapped).subscribe({
          next: (response: any) => {
            const createdCount = response?.reports?.length ?? 0;
            const errorCount = response?.errors?.length ?? 0;
            const skippedCount = response?.skipped?.length ?? 0;

            if (errorCount > 0 || skippedCount > 0) {
              const details: string[] = [];
              if (createdCount > 0) details.push(`${createdCount} Erfolgreich`);
              if (errorCount > 0) details.push(`${errorCount} Fehler`);
              if (skippedCount > 0) details.push(`${skippedCount} Übersprungen`);
              this.toast.warning(`Excel hochgeladen: ${details.join(', ')}`, {
                position: 'bottom-right',
                duration: 6000,
              });
            } else {
              this.toast.success(`${createdCount} Excel-Zeile(n) erfolgreich hochgeladen`, {
                position: 'bottom-right',
                duration: 4000,
                icon: '✅',
              });
            }
            this.refreshProjectsAfterExcelUpload();
          },
          error: () => {
            this.toast.error('Bulk-Insert fehlgeschlagen!', {
              position: 'bottom-right',
              duration: 5000,
              icon: '❌',
            });
            this.excelUploadInProgress = false;
            this.excelUploadProjectId = null;
            this.cdr.markForCheck();
          },
        });
        // Reset file input
        fileInput.value = '';
      };
      reader.readAsArrayBuffer(file);
      return;
    }

    this.excelUploadInProgress = false;
    this.excelUploadProjectId = null;
    this.cdr.markForCheck();
  }

  // Handle Excel file upload for a single row (e.g. exported from one report)
  handleExcelTestFileUpload(event: Event): void {
    const fileInput = event.target as HTMLInputElement;
    const file = fileInput?.files?.[0];
    if (file && this.selectedProject) {
      this.excelUploadProjectId = this.selectedProject.id?.toString() || null;
      this.excelUploadInProgress = true;
      this.cdr.markForCheck();
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const json = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
          const mapped = json.map((row) => this.mapExcelRowToReport(row));

          if (mapped.length === 0) {
            this.toast.error('Die Excel-Datei enthält keine Datenzeile.', {
              position: 'bottom-right',
              duration: 5000,
              icon: '❌',
            });
            this.excelUploadInProgress = false;
            this.excelUploadProjectId = null;
            this.cdr.markForCheck();
            fileInput.value = '';
            return;
          }

          if (mapped.length > 1) {
            this.toast.info('Mehrere Zeilen erkannt – es wird nur die erste Zeile hochgeladen.', {
              position: 'bottom-right',
              duration: 4000,
            });
          }

          const singleRow = mapped[0];
          this.reportService.bulkInsertReports(this.selectedProject!.id, [singleRow]).subscribe({
            next: (response: any) => {
              const errorCount = response?.errors?.length ?? 0;
              const skippedCount = response?.skipped?.length ?? 0;

              if (errorCount > 0 || skippedCount > 0) {
                const msg = response?.errors?.[0]?.message || response?.skipped?.[0]?.reason || 'Upload hatte Probleme';
                this.toast.warning(`Excel-Zeile hochgeladen, aber: ${msg}`, {
                  position: 'bottom-right',
                  duration: 6000,
                });
              } else {
                this.toast.success('Excel-Zeile erfolgreich hochgeladen', {
                  position: 'bottom-right',
                  duration: 4000,
                  icon: '✅',
                });
              }
              this.refreshProjectsAfterExcelUpload();
            },
            error: () => {
              this.toast.error('Upload der Excel-Zeile fehlgeschlagen!', {
                position: 'bottom-right',
                duration: 5000,
                icon: '❌',
              });
              this.excelUploadInProgress = false;
              this.excelUploadProjectId = null;
              this.cdr.markForCheck();
            },
          });
          fileInput.value = '';
        } catch (error) {
          console.error('❌ Error parsing Excel test file:', error);
          this.toast.error('Excel-Datei konnte nicht gelesen werden.', {
            position: 'bottom-right',
            duration: 5000,
            icon: '❌',
          });
          this.excelUploadInProgress = false;
          this.excelUploadProjectId = null;
          this.cdr.markForCheck();
          fileInput.value = '';
        }
      };
      reader.readAsArrayBuffer(file);
      return;
    }

    this.excelUploadInProgress = false;
    this.excelUploadProjectId = null;
    this.cdr.markForCheck();
  }

  private refreshProjectsAfterExcelUpload(options: { downloadExcel?: boolean } = {}): void {
    const projectForDownload = this.selectedProject;
    this.excelUploadInProgress = false;
    this.excelUploadProjectId = null;
    if (this.client && this.client.id) {
      this.clientCompanyService.getProjectsByClientCompany(this.client.id, true).subscribe({
        next: (resp) => {
          this.projects = resp.projects || [];
          this.applyFilters();

          const refreshed = this.projects.find((p) => p.id?.toString() === this.selectedProject?.id?.toString());
          if (refreshed) {
            this.selectedProject = refreshed;
            const projectId = refreshed.id?.toString();
            if (projectId) {
              this.expandedRows = { [projectId]: true };
              this.loadProjectReports(refreshed, { forceRefresh: true });
            }
          } else {
            this.expandedRows = {};
            this.selectedProject = null;
          }
          this.cdr.markForCheck();

          if (options.downloadExcel && projectForDownload) {
            this.downloadProjectCsv(projectForDownload);
          }
        },
        error: () => {
          this.projects = [];
          this.filteredProjects = [];
          this.expandedRows = {};
          this.selectedProject = null;
          this.cdr.markForCheck();
        },
      });
    } else {
      this.expandedRows = {};
      this.selectedProject = null;
      this.cdr.markForCheck();
    }
  }

  /**
   * Get filtered reports for a project, optionally excluding a specific filter type
   * Used for populating filter dropdowns with only relevant options
   */
  private getFilteredReports(project: Project, excludeFilterType?: string | string[]): Report[] {
    if (!project.reports) {
      return [];
    }

    let filtered = project.reports;
    const filters = this.getProjectReportFilters(project);

    const excluded = Array.isArray(excludeFilterType) ? excludeFilterType : excludeFilterType ? [excludeFilterType] : [];

    // Apply filiale search filter - filter reports by branch name, branch number, and address fields
    if (!excluded.includes('filialeSearch') && this.filialeSearchTerm && this.filialeSearchTerm.trim().length > 0) {
      const searchTerm = this.filialeSearchTerm.toLowerCase();
      filtered = filtered.filter((report) => {
        // Search in branch label (number + name)
        const branchLabel = this.getReportBranchLabel(report).toLowerCase();
        if (branchLabel.includes(searchTerm)) return true;

        // Search in branch name separately
        const branchName = (report.branch?.name || '').toLowerCase();
        if (branchName.includes(searchTerm)) return true;

        // Search in branch number separately
        const branchNumber = (report.branch?.branchNumber || '').toString().toLowerCase();
        if (branchNumber.includes(searchTerm)) return true;

        // Search in full address
        const address = this.getReportAddress(report).toLowerCase();
        if (address.includes(searchTerm)) return true;

        // Search in individual address components
        const street = (report.street || '').toLowerCase();
        if (street.includes(searchTerm)) return true;

        const zipCode = (report.zipCode || '').toLowerCase();
        if (zipCode.includes(searchTerm)) return true;

        // Search in city
        if (report.branch && (report.branch as any).city) {
          const city = ((report.branch as any).city.name || '').toLowerCase();
          if (city.includes(searchTerm)) return true;
        }

        // Search in country
        if (report.branch && (report.branch as any).city && (report.branch as any).city.country) {
          const countryObj = (report.branch as any).city.country;
          const country = (countryObj.name?.de || countryObj.name || '').toLowerCase();
          if (country.includes(searchTerm)) return true;
        }

        return false;
      });
    }

    // Apply global date range filter on report plannedOn date
    if (!excluded.includes('dateRange') && this.isDateRangeActive()) {
      filtered = filtered.filter((report) => {
        if (!report.plannedOn) return false;
        const reportYmd = this.normalizeDateToYmd(report.plannedOn);
        const filterStart = this.normalizeDateToYmd(this.dateRange2.start);
        const filterEnd = this.normalizeDateToYmd(this.dateRange2.end);
        if (!reportYmd || !filterStart || !filterEnd) return false;
        return reportYmd >= filterStart && reportYmd <= filterEnd;
      });
    }

    // Apply Geplant Von–Bis range filter (from column header date picker)
    if (!excluded.includes('plannedOnDateRange') && this.isPlannedOnDateRangeActive()) {
      filtered = filtered.filter((report) => this.isReportInPlannedOnDateRange(report));
    }

    // Apply general status filter from query params (but skip if we're getting status filter options)
    if (!excluded.includes('status') && this.statusFilter) {
      filtered = filtered.filter((report) => this.reportMatchesStatus(report, this.statusFilter));
    }

    // Apply column status filter (multiple selection)
    if (!excluded.includes('status') && filters.status && Array.isArray(filters.status) && filters.status.length > 0) {
      filtered = filtered.filter((report) => {
        const statusName = this.normalizeColumnFilterValue(report.status?.name);
        return filters.status.includes(statusName);
      });
    }

    // Apply column merchandiser filter (multiple selection)
    if (!excluded.includes('merchandiser') && filters.merchandiser && Array.isArray(filters.merchandiser) && filters.merchandiser.length > 0) {
      filtered = filtered.filter((report) => {
        const merchandiserName = this.normalizeColumnFilterValue(this.getReportMerchandiserName(report));
        return filters.merchandiser.includes(merchandiserName);
      });
    }

    // Apply column filialen filter (multiple selection)
    if (!excluded.includes('filialen') && filters.filialen && Array.isArray(filters.filialen) && filters.filialen.length > 0) {
      filtered = filtered.filter((report) => {
        const branchLabel = this.normalizeColumnFilterValue(this.getReportBranchLabel(report));
        return filters.filialen.includes(branchLabel);
      });
    }

    // Apply column plannedOn date filter (multiple selection)
    if (!excluded.includes('plannedOn') && filters.plannedOn && Array.isArray(filters.plannedOn) && filters.plannedOn.length > 0) {
      filtered = filtered.filter((report) => {
        const formattedDate = this.normalizeColumnFilterValue(report.plannedOn ? this.formatDateForFilter(report.plannedOn) : '');
        return filters.plannedOn.includes(formattedDate);
      });
    }

    // Apply generic filters for other columns
    Object.keys(filters.generic).forEach((field) => {
      if (!excluded.includes(field)) {
        const filterValues = filters.generic[field];
        if (filterValues && Array.isArray(filterValues) && filterValues.length > 0) {
          filtered = filtered.filter((report) => {
            const value = this.normalizeColumnFilterValue(this.getReportFieldValue(report, field));
            return filterValues.includes(value);
          });
        }
      }
    });

    return filtered;
  }

  private updateReportColumnsForProject(project: Project): void {
    const baseCols = [
      { field: 'plannedOn', header: 'Geplant' },
      { field: 'merchandiser', header: 'Merchandiser' },
      { field: 'branch.name', header: 'Filiale' },
      { field: 'address', header: 'Adresse' },
      { field: 'note', header: 'Notiz' },
      { field: 'reportTo', header: 'Report bis' },
    ];

    // Do not include feedback or dynamic question columns in the reports table
    this.reportCols = [...baseCols];

    // Reset ordered columns to match new columns
    this.reportsOrderedColumns = [...this.reportCols];

    // Update visibility
    const newVisibleColumns: { [key: string]: boolean } = {};
    this.reportCols.forEach((col) => {
      if (col.field.startsWith('question_')) {
        newVisibleColumns[col.field] = true;
      } else {
        // Preserve existing visibility for base columns
        if (this.reportsVisibleColumns[col.field] !== undefined) {
          newVisibleColumns[col.field] = this.reportsVisibleColumns[col.field];
        } else {
          newVisibleColumns[col.field] = col.field !== 'feedback';
        }
      }
    });
    this.reportsVisibleColumns = newVisibleColumns;

    this.updateVisibleColumns();
    this.syncReportColumnSelectionFromVisibility();
    this.bumpReportsTableLayout();
    this.cdr.markForCheck();
  }

  private formatAnswerValue(answer: Answer): string {
    if (answer.value === null || answer.value === undefined) return '';
    if (typeof answer.value === 'boolean') return answer.value ? 'Ja' : 'Nein';
    if (Array.isArray(answer.value)) return answer.value.join(', ');
    return String(answer.value);
  }

  private getDerivedDataSignature(project: Project): string {
    const filters = this.getProjectReportFilters(project);
    const genericKeys = Object.keys(filters.generic).sort();
    const genericSignature = genericKeys.map((key) => `${key}:${this.formatFilterArray(filters.generic[key])}`).join('|');

    return [
      project.reports ? project.reports.length : 0,
      // Include status fingerprint so local status changes (e.g. after VM remove) refresh derived data.
      project.reports ? project.reports.map((r) => `${r.id}:${r.status?.id ?? ''}:${r.merchandiser?.id ?? ''}:${r.plannedOn ?? ''}`).join(',') : '',
      this.statusFilter || '',
      this.filialeSearchTerm || '',
      this.projectSearchTerm || '',
      this.clientSearchTerm || '',
      this.formatFilterArray(filters.status),
      this.formatFilterArray(filters.merchandiser),
      this.formatFilterArray(filters.filialen),
      this.formatFilterArray(filters.plannedOn),
      this.isPlannedOnDateRangeActive() ? `${this.normalizeDateToYmd(this.plannedOnDateRange.start)}-${this.normalizeDateToYmd(this.plannedOnDateRange.end)}` : '',
      this.isDateRangeActive() ? `${this.normalizeDateToYmd(this.dateRange2.start)}-${this.normalizeDateToYmd(this.dateRange2.end)}` : '',
      genericSignature,
      this.reportSortField || '',
      this.reportSortOrder.toString(),
      this.projectNameFilter ? this.projectNameFilter.join(',') : '',
      this.hasProjectColumnFilters().toString(),
      this.hasReportColumnFilters(project).toString(),
    ].join('||');
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

    const signature = this.getDerivedDataSignature(project);
    if ((project as any)._derivedDataSignature === signature && project._filteredReports !== undefined) {
      return;
    }
    (project as any)._derivedDataSignature = signature;

    // Process dynamic columns for questions
    if (project.questions) {
      const overviewQuestions = project.questions.filter((q) => q.showInOverview);

      if (overviewQuestions.length > 0) {
        project.reports.forEach((report) => {
          overviewQuestions.forEach((q) => {
            const answer = report.answers?.find((a) => a.questionId === q.id || (a.question && a.question.id === q.id));
            (report as any)[`question_${q.id}`] = answer ? this.formatAnswerValue(answer) : '';
          });
        });
      }
    }

    // Get filtered reports without excluding any filters
    const filtered = this.getFilteredReports(project);

    const sortedReports = this.reportSortField ? this.applyReportSorting(filtered, this.reportSortField, this.reportSortOrder) : [...filtered];

    project._filteredReports = sortedReports;

    // Calculate displayed filialen
    const uniqueBranches = new Set<string>();
    filtered.forEach((report) => {
      const label = this.getReportBranchLabel(report);
      if (label) {
        uniqueBranches.add(label);
      }
    });

    // Display stores based on the actually loaded/filtered reports.
    // This avoids overstating the count with backend totals (e.g. showing 16 when only 4 are present in reports).
    project._displayedFilialen = uniqueBranches.size;

    // Calculate reported percentage (Status OK / Total rows shown)
    let validCount = 0;
    filtered.forEach((report) => {
      if (report.status && [ReportStatusEnum.APPROVED, ReportStatusEnum.VIEWED].includes(Number(report.status.id))) {
        validCount += 1;
      }
    });
    const denominator = Math.max(filtered.length, project.branchesCount ?? 0);
    if (denominator > 0) {
      project.reportedPercentage = (validCount / denominator) * 100;
    } else {
      project.reportedPercentage = 0;
    }
  }

  /**
   * Filter reports for a project based on the status filter
   * @param project The project to filter reports for
   * @returns Filtered reports array
   */
  filteredReports(project: Project): Report[] {
    if (project._filteredReports) {
      return project._filteredReports;
    }
    this.updateProjectDerivedData(project);
    return project._filteredReports || [];
  }

  getDisplayedFilialen(project: Project): number {
    if (project._displayedFilialen !== undefined) {
      return project._displayedFilialen;
    }
    this.updateProjectDerivedData(project);
    return project._displayedFilialen ?? project.branchesCount ?? 0;
  }

  private shouldUseFilteredFilialenCount(project?: Project): boolean {
    return (
      !!this.statusFilter ||
      !!this.projectSearchTerm ||
      !!this.filialeSearchTerm ||
      this.isPlannedOnDateRangeActive() ||
      (this.projectNameFilter && this.projectNameFilter.length > 0) ||
      this.hasProjectColumnFilters() ||
      this.hasReportColumnFilters(project)
    );
  }

  private getFilteredBranchCount(project: Project): number {
    const reports = this.filteredReports(project);
    const uniqueBranches = new Set<string>();

    reports.forEach((report) => {
      const label = this.getReportBranchLabel(report);
      if (label) {
        uniqueBranches.add(label);
      }
    });

    return uniqueBranches.size;
  }

  /**
   * Get unique status values from a project's reports
   * @param project The project to get statuses from (optional, defaults to selectedProject)
   * @returns Array of unique status objects
   */
  getUniqueReportStatuses(project?: Project): Array<{ label: string; value: string; color: string }> {
    if (project && project !== this.selectedProject) {
      return this.calculateUniqueReportStatuses(project);
    }
    return this.reportStatusOptions;
  }

  calculateUniqueReportStatuses(project?: Project): Array<{ label: string; value: string; color: string }> {
    const projectToUse = project || this.selectedProject;

    if (!projectToUse || !projectToUse.reports) {
      return [];
    }

    // Use filtered reports, excluding status filter
    const reports = this.getFilteredReports(projectToUse, ['status', 'merchandiser', 'filialen', 'plannedOn', 'generic']);

    const statusMap = new Map<string, string>();

    reports.forEach((report) => {
      const statusName = this.normalizeColumnFilterValue(report.status?.name);
      if (!statusMap.has(statusName)) {
        statusMap.set(statusName, report.status?.color || '#cccccc');
      }
    });
    this.appendSelectedFilterValuesToMap(statusMap, this.getProjectReportFilters(projectToUse).status);

    return Array.from(statusMap.entries())
      .sort((a, b) => {
        const aEmpty = a[0] === '';
        const bEmpty = b[0] === '';
        if (aEmpty !== bEmpty) {
          return aEmpty ? 1 : -1;
        }
        return a[0].localeCompare(b[0], 'de', { sensitivity: 'base', numeric: true });
      })
      .map(([name, color]) => ({ label: this.getColumnFilterOptionLabel(name), value: name, color }));
  }

  /**
   * Get unique merchandiser values from a project's reports
   * @param project The project to get merchandisers from (optional, defaults to selectedProject)
   * @returns Array of unique merchandiser names
   */
  getUniqueMerchandisers(project?: Project): { label: string; value: string }[] {
    if (project && project !== this.selectedProject) {
      return this.calculateUniqueMerchandisers(project);
    }
    return this.merchandiserOptions;
  }

  calculateUniqueMerchandisers(project?: Project): { label: string; value: string }[] {
    const projectToUse = project || this.selectedProject;

    if (!projectToUse || !projectToUse.reports) {
      return [];
    }

    // Use filtered reports, excluding merchandiser filter
    const reports = this.getFilteredReports(projectToUse, ['merchandiser', 'status']);

    const merchandiserSet = new Set<string>();

    reports.forEach((report) => {
      const merchandiserName = this.normalizeColumnFilterValue(this.getReportMerchandiserName(report));
      merchandiserSet.add(merchandiserName);
    });
    this.appendSelectedFilterValues(merchandiserSet, this.getProjectReportFilters(projectToUse).merchandiser);

    return this.sortColumnFilterValues(Array.from(merchandiserSet)).map((m) => ({
      label: this.getColumnFilterOptionLabel(m, 'Nicht Existiert'),
      value: m,
    }));
  }

  /**
   * Get unique filialen (branch) values from a project's reports
   * @param project The project to get branches from (optional, defaults to selectedProject)
   * @returns Array of unique branch names
   */
  getUniqueFilialen(project?: Project): { label: string; value: string }[] {
    if (project && project !== this.selectedProject) {
      return this.calculateUniqueFilialen(project);
    }
    return this.filialenOptions;
  }

  calculateUniqueFilialen(project?: Project): { label: string; value: string }[] {
    const projectToUse = project || this.selectedProject;

    if (!projectToUse || !projectToUse.reports) {
      return [];
    }

    // Use filtered reports, excluding filialen filter
    const reports = this.getFilteredReports(projectToUse, ['filialen', 'status']);

    const branchSet = new Set<string>();

    reports.forEach((report) => {
      const label = this.normalizeColumnFilterValue(this.getReportBranchLabel(report));
      branchSet.add(label);
    });
    this.appendSelectedFilterValues(branchSet, this.getProjectReportFilters(projectToUse).filialen);

    return this.sortColumnFilterValues(Array.from(branchSet)).map((f) => ({
      label: this.getColumnFilterOptionLabel(f),
      value: f,
    }));
  }

  /**
   * Clear the report status column filter
   */
  clearReportStatusFilter(project?: Project): void {
    this.reportStatusFilter = [];
    this.persistUiFiltersToProject(project);
    this.applyFilters();
  }

  /**
   * Clear the report merchandiser column filter
   */
  clearReportMerchandiserFilter(project?: Project): void {
    this.reportMerchandiserFilter = [];
    this.persistUiFiltersToProject(project);
    this.applyFilters();
  }

  /**
   * Clear the report filialen column filter
   */
  clearReportFilialenFilter(project?: Project): void {
    this.reportFilialenFilter = [];
    this.persistUiFiltersToProject(project);
    this.applyFilters();
  }

  /**
   * Handle report status filter change
   */
  onReportStatusFilterChange(values?: string[]): void {
    if (Array.isArray(values)) {
      this.reportStatusFilter = values;
    }

    // Clear global status filter if column filter is used
    if (this.reportStatusFilter.length > 0 && this.statusFilter) {
      this.statusFilter = '';
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { status: null },
        queryParamsHandling: 'merge',
      });
    }

    this.persistUiFiltersToProject(this.selectedProject);
    this.applyFilters();
    if (this.client?.id) {
      this.scheduleStateSave();
    }
  }

  /**
   * Handle report merchandiser filter change
   */
  onReportMerchandiserFilterChange(values?: string[] | null): void {
    if (Array.isArray(values)) {
      this.reportMerchandiserFilter = values;
    } else if (values === null) {
      this.reportMerchandiserFilter = [];
    }

    // Clear global status filter if column filter is used
    if (this.reportMerchandiserFilter.length > 0 && this.statusFilter) {
      this.statusFilter = '';
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { status: null },
        queryParamsHandling: 'merge',
      });
    }

    this.persistUiFiltersToProject(this.selectedProject);
    this.applyFilters();
    if (this.client?.id) {
      this.scheduleStateSave();
    }
  }

  onReportMerchandiserFilterCleared(): void {
    this.reportMerchandiserFilter = [];
    this.onReportMerchandiserFilterChange([]);
  }

  /**
   * Handle report filialen filter change
   */
  onReportFilialenFilterChange(values?: string[]): void {
    if (Array.isArray(values)) {
      this.reportFilialenFilter = values;
    }

    // Clear global status filter if column filter is used
    if (this.reportFilialenFilter.length > 0 && this.statusFilter) {
      this.statusFilter = '';
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { status: null },
        queryParamsHandling: 'merge',
      });
    }

    this.persistUiFiltersToProject(this.selectedProject);
    this.applyFilters();
    if (this.client?.id) {
      this.scheduleStateSave();
    }
  }

  /**
   * Handle report plannedOn filter change
   */
  onReportPlannedOnFilterChange(values?: string[] | null): void {
    if (Array.isArray(values)) {
      this.reportPlannedOnFilter = values;
    } else if (values === null) {
      this.reportPlannedOnFilter = [];
    }

    // Clear global status filter if column filter is used
    if (this.reportPlannedOnFilter.length > 0 && this.statusFilter) {
      this.statusFilter = '';
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { status: null },
        queryParamsHandling: 'merge',
      });
    }

    this.persistUiFiltersToProject(this.selectedProject);
    this.applyFilters();
    if (this.client?.id) {
      this.scheduleStateSave();
    }
  }

  /**
   * Handle report plannedOn filter cleared
   */
  onReportPlannedOnFilterCleared(): void {
    this.reportPlannedOnFilter = [];
    this.onReportPlannedOnFilterChange([]);
  }

  /**
   * Handle generic filter change
   */
  onGenericFilterChange(values?: string[]): void {
    if (Array.isArray(values)) {
      this.genericFilterValues[this.currentFilterField] = values;
    }

    // Check if we have active generic filters
    const hasActiveGenericFilters = Object.values(this.genericFilterValues).some((filterValues) => Array.isArray(filterValues) && filterValues.length > 0);

    // If active generic filters, clear status filter
    if (hasActiveGenericFilters && this.statusFilter) {
      this.statusFilter = '';
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { status: null },
        queryParamsHandling: 'merge',
      });
    }

    this.persistUiFiltersToProject(this.selectedProject);
    this.applyFilters();
    if (this.client?.id) {
      this.scheduleStateSave();
    }
  }

  /**
   * Get unique plannedOn dates from a project's reports
   * @param project The project to get dates from (optional, defaults to selectedProject)
   * @returns Array of unique formatted date strings
   */
  getUniquePlannedOnDates(project?: Project): { label: string; value: string }[] {
    if (project && project !== this.selectedProject) {
      return this.calculateUniquePlannedOnDates(project);
    }
    return this.plannedOnOptions;
  }

  calculateUniquePlannedOnDates(project?: Project): { label: string; value: string }[] {
    const projectToUse = project || this.selectedProject;

    if (!projectToUse || !projectToUse.reports) {
      return [];
    }

    // Use filtered reports, excluding plannedOn filter
    const reports = this.getFilteredReports(projectToUse, ['plannedOn', 'plannedOnDateRange', 'status']);

    const dateSet = new Set<string>();

    reports.forEach((report) => {
      const formattedDate = report.plannedOn ? this.formatDateForFilter(report.plannedOn) : '';
      dateSet.add(this.normalizeColumnFilterValue(formattedDate));
    });
    this.appendSelectedFilterValues(dateSet, this.getProjectReportFilters(projectToUse).plannedOn);

    return this.sortColumnFilterValues(Array.from(dateSet)).map((d) => ({
      label: this.getColumnFilterOptionLabel(d),
      value: d,
    }));
  }

  /**
   * Format a date for filtering (consistent format - ISO YYYY-MM-DD)
   */
  private formatDateForFilter(date: string | Date): string {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    // Format as YYYY-MM-DD (ISO format) for consistent storage and comparison
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Check if a project column has any data to allow filtering
  hasProjectColumnData(field: string): boolean {
    if (!this.projects || this.projects.length === 0) {
      return false;
    }

    // We check the entire unfiltered project list (or filtered, but button is for column filtering which means we filter within the current result set)
    // Actually, to know if filter should be clickable, calculateUniqueValuesForProjectColumn needs to return > 0 items
    // But that recalculates often. A simple check is if ANY project has data.
    return this.filteredProjects.some((project) => {
      let value: string = '';
      if (field === 'formattedZeitraum') {
        value = this.getProjectZeitraum(project);
      } else if (field === 'filialen') {
        const count = this.getProjectStoresCountForFilter(project);
        return count > 0;
      } else if (field === 'status') {
        return true; // We always allow status filtering
      } else {
        value = project[field as keyof Project]?.toString() || '';
      }
      return value !== null && value !== '' && value !== undefined;
    });
  }

  // Check if a report column has any data for a specific project
  hasReportColumnData(field: string, project?: Project): boolean {
    if (!project || !project.reports || project.reports.length === 0) {
      return false;
    }

    return project.reports.some((report) => {
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

  /**
   * Check if status filter can be applied
   */
  canFilterStatus(project?: Project): boolean {
    return this.hasReportColumnData('status', project);
  }

  /**
   * Check if merchandiser filter can be applied
   */
  canFilterMerchandiser(project?: Project): boolean {
    return this.hasReportColumnData('merchandiser', project);
  }

  /**
   * Check if filialen filter can be applied
   */
  canFilterFilialen(project?: Project): boolean {
    return this.hasReportColumnData('branch.name', project);
  }

  /**
   * Check if plannedOn filter can be applied
   */
  canFilterPlannedOn(project?: Project): boolean {
    return this.hasReportColumnData('plannedOn', project);
  }

  /**
   * Check if generic field filter can be applied
   */
  canFilterGenericField(field: string, project?: Project): boolean {
    return this.hasReportColumnData(field, project);
  }

  /**
   * Open generic filter popover for a field
   */
  openGenericFilter(field: string, event: Event, project?: Project): void {
    // Store the actual DOM element for positioning - use currentTarget (the div wrapper)
    const targetElement = (event.currentTarget || event.target) as HTMLElement;

    if (!targetElement) {
      return;
    }

    const previousFilterField = this.currentFilterField;
    const previousProjectId = this.selectedProject?.id;

    if (project) {
      this.selectedProject = project;
    }

    const projectForFilters = project || this.selectedProject;
    this.syncUiFiltersFromProject(projectForFilters);
    this.currentFilterField = field;
    this.currentGenericOptions = this.calculateUniqueValuesForField(field, projectForFilters);

    // Initialize filter values if not exists
    if (!this.genericFilterValues[field]) {
      this.genericFilterValues[field] = [];
    }

    event.stopPropagation();

    // Mobile: use centered modal
    if (this.isMobileColumnFilter()) {
      const sameContext = previousFilterField === field && previousProjectId === projectForFilters?.id && this.showColumnFilterModal && this.columnFilterModalType === 'reportGeneric';
      if (sameContext) {
        this.closeColumnFilterModal();
        return;
      }
      if (this.showColumnFilterModal) {
        this.columnFilterModalType = 'reportGeneric';
        this.cdr.detectChanges();
        return;
      }
      this.columnFilterModalType = 'reportGeneric';
      this.openColumnFilterModal();
      return;
    }

    // Desktop: use popover anchored to column header (like project filters)
    this.openFilterPopover(this.genericFilterPopover, targetElement, `report-generic-${field}`);
  }

  /**
   * Close all filter popovers
   */
  closeAllFilterPopovers(): void {
    this.hideFilterPopovers();
    this.hideSettingsPopovers();
  }

  private hideFilterPopovers(except?: any): void {
    if (this.filterPopoverTimeout) {
      clearTimeout(this.filterPopoverTimeout);
      this.filterPopoverTimeout = null;
    }

    const popovers = [
      this.genericFilterPopover,
      this.projectColumnFilterPopover,
      this.statusFilterPopover,
      this.merchandiserFilterPopover,
      this.filialenFilterPopover,
      this.plannedOnFilterPopover,
      this.projectFilterPopover,
    ];

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

  onProjectNameFilterPopoverClose(): void {
    if (this.projectFilterPopover) {
      this.projectFilterPopover.hide();
    }
    if (this.activeFilterPopover === this.projectFilterPopover) {
      this.activeFilterPopover = null;
      this.activeFilterId = null;
    }
  }

  onProjectColumnFilterPopoverClose(): void {
    if (this.projectColumnFilterPopover) {
      this.projectColumnFilterPopover.hide();
    }
    if (this.activeFilterPopover === this.projectColumnFilterPopover) {
      this.activeFilterPopover = null;
      this.activeFilterId = null;
    }
  }

  onStatusFilterPopoverClose(): void {
    if (this.statusFilterPopover) {
      this.statusFilterPopover.hide();
    }
    if (this.activeFilterPopover === this.statusFilterPopover) {
      this.activeFilterPopover = null;
      this.activeFilterId = null;
    }
  }

  onMerchandiserFilterPopoverClose(): void {
    if (this.merchandiserFilterPopover) {
      this.merchandiserFilterPopover.hide();
    }
    if (this.activeFilterPopover === this.merchandiserFilterPopover) {
      this.activeFilterPopover = null;
      this.activeFilterId = null;
    }
  }

  onFilialenFilterPopoverClose(): void {
    if (this.filialenFilterPopover) {
      this.filialenFilterPopover.hide();
    }
    if (this.activeFilterPopover === this.filialenFilterPopover) {
      this.activeFilterPopover = null;
      this.activeFilterId = null;
    }
  }

  onPlannedOnFilterPopoverClose(): void {
    if (this.plannedOnFilterPopover) {
      this.plannedOnFilterPopover.hide();
    }
    if (this.activeFilterPopover === this.plannedOnFilterPopover) {
      this.activeFilterPopover = null;
      this.activeFilterId = null;
    }
  }

  onGenericFilterPopoverClose(): void {
    if (this.genericFilterPopover) {
      this.genericFilterPopover.hide();
    }
    if (this.activeFilterPopover === this.genericFilterPopover) {
      this.activeFilterPopover = null;
      this.activeFilterId = null;
    }
  }

  private hideSettingsPopovers(except?: any): void {
    const popovers = [this.projectSettingsPopover, this.reportSettingsPopover];

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

    // Delay before showing to ensure clean state and allow UI to update
    this.filterPopoverTimeout = setTimeout(() => {
      popoverRef.show(positioningEvent);
      this.activeFilterPopover = popoverRef;
      this.activeFilterId = uniqueId || null;

      // Immediately open the first dropdown/multiselect inside the popover so the user doesn't need a second click
      this.scheduleOpenFirstDropdown(popoverRef);

      this.cdr.detectChanges();
    }, 120);
  }

  private scheduleOpenFirstDropdown(popoverRef: any): void {
    // Try a few times to catch the overlay once it is rendered
    [0, 50, 120].forEach((delay) => setTimeout(() => this.tryOpenFirstDropdown(popoverRef), delay));
  }

  private openSettingsColumnsSelector(popoverRef: any): void {
    const targetMultiSelect = popoverRef === this.projectSettingsPopover ? this.projectColumnsMultiSelect : this.reportColumnsMultiSelect;

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
    const targetMultiSelect = popoverRef === this.projectSettingsPopover ? this.projectColumnsMultiSelect : this.reportColumnsMultiSelect;

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

  private openFilterPopover(popoverRef: any, targetElement: HTMLElement, uniqueId?: string): void {
    if (!popoverRef || !targetElement) {
      return;
    }

    // Check if the same popover AND same ID is already open
    const isSamePopover = this.activeFilterPopover === popoverRef;
    const isSameId = uniqueId ? this.activeFilterId === uniqueId : true;

    // If clicking on the same popover/field that's already open, just close it
    if (isSamePopover && isSameId) {
      this.hideFilterPopovers();
      return;
    }

    this.hideSettingsPopovers();
    // Hide ALL filter popovers first
    this.hideFilterPopovers();

    // Then show the new one
    this.showFilterPopover(popoverRef, targetElement, uniqueId);
  }

  toggleProjectSettingsPopover(event: Event): void {
    this.toggleSettingsPopover(this.projectSettingsPopover, event);
  }

  toggleReportSettingsPopover(event: Event): void {
    this.toggleSettingsPopover(this.reportSettingsPopover, event);
  }

  private toggleSettingsPopover(popoverRef: any, event: Event): void {
    const targetElement = (event.currentTarget || event.target) as HTMLElement;
    if (!popoverRef || !targetElement) {
      return;
    }

    event.stopPropagation();

    if (this.activeSettingsPopover === popoverRef) {
      this.closeSettingsColumnsSelector(popoverRef);
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
      this.openSettingsColumnsSelector(popoverRef);
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
   * Open status filter popover
   */
  openStatusFilter(event: Event, project?: Project): void {
    const targetElement = (event.currentTarget || event.target) as HTMLElement;
    if (!targetElement) {
      return;
    }
    event.stopPropagation();

    if (project) {
      this.selectedProject = project;
    }

    this.syncUiFiltersFromProject(project || this.selectedProject);
    this.reportStatusOptions = this.calculateUniqueReportStatuses();

    // Mobile: use centered modal
    if (this.isMobileColumnFilter()) {
      if (this.showColumnFilterModal && this.columnFilterModalType === 'reportStatus') {
        this.closeColumnFilterModal();
        return;
      }
      if (this.showColumnFilterModal) {
        this.columnFilterModalType = 'reportStatus';
        this.cdr.detectChanges();
        return;
      }
      this.columnFilterModalType = 'reportStatus';
      this.openColumnFilterModal();
      return;
    }

    // Desktop: use popover anchored to column header (like project filters)
    this.openFilterPopover(this.statusFilterPopover, targetElement, 'report-status');
  }

  /**
   * Open merchandiser filter popover
   */
  openMerchandiserFilter(event: Event, project?: Project): void {
    const targetElement = (event.currentTarget || event.target) as HTMLElement;
    if (!targetElement) {
      return;
    }
    event.stopPropagation();

    if (project) {
      this.selectedProject = project;
    }

    this.syncUiFiltersFromProject(project || this.selectedProject);
    this.merchandiserOptions = this.calculateUniqueMerchandisers();

    // Mobile: use centered modal
    if (this.isMobileColumnFilter()) {
      if (this.showColumnFilterModal && this.columnFilterModalType === 'reportMerchandiser') {
        this.closeColumnFilterModal();
        return;
      }
      if (this.showColumnFilterModal) {
        this.columnFilterModalType = 'reportMerchandiser';
        this.cdr.detectChanges();
        return;
      }
      this.columnFilterModalType = 'reportMerchandiser';
      this.openColumnFilterModal();
      return;
    }

    // Desktop: use popover anchored to column header (like project filters)
    this.openFilterPopover(this.merchandiserFilterPopover, targetElement, 'report-merchandiser');
  }

  /**
   * Open filialen filter popover
   */
  openFilialenFilter(event: Event, project?: Project): void {
    const targetElement = (event.currentTarget || event.target) as HTMLElement;
    if (!targetElement) {
      return;
    }
    event.stopPropagation();

    if (project) {
      this.selectedProject = project;
    }

    this.syncUiFiltersFromProject(project || this.selectedProject);
    this.filialenOptions = this.calculateUniqueFilialen();

    // Mobile: use centered modal
    if (this.isMobileColumnFilter()) {
      if (this.showColumnFilterModal && this.columnFilterModalType === 'reportFilialen') {
        this.closeColumnFilterModal();
        return;
      }
      if (this.showColumnFilterModal) {
        this.columnFilterModalType = 'reportFilialen';
        this.cdr.detectChanges();
        return;
      }
      this.columnFilterModalType = 'reportFilialen';
      this.openColumnFilterModal();
      return;
    }

    // Desktop: use popover anchored to column header (like project filters)
    this.openFilterPopover(this.filialenFilterPopover, targetElement, 'report-filialen');
  }

  /**
   * Open plannedOn filter popover
   */
  openPlannedOnFilter(event: Event, project?: Project): void {
    const targetElement = (event.currentTarget || event.target) as HTMLElement;
    if (!targetElement) {
      return;
    }
    event.stopPropagation();

    if (project) {
      this.selectedProject = project;
    }

    this.syncUiFiltersFromProject(project || this.selectedProject);
    this.plannedOnOptions = this.calculateUniquePlannedOnDates();

    // Mobile: use centered modal
    if (this.isMobileColumnFilter()) {
      if (this.showColumnFilterModal && this.columnFilterModalType === 'reportPlannedOn') {
        this.closeColumnFilterModal();
        return;
      }
      if (this.showColumnFilterModal) {
        this.columnFilterModalType = 'reportPlannedOn';
        this.cdr.detectChanges();
        return;
      }
      this.columnFilterModalType = 'reportPlannedOn';
      this.openColumnFilterModal();
      return;
    }

    // Desktop: use popover anchored to column header (like project filters)
    this.openFilterPopover(this.plannedOnFilterPopover, targetElement, 'report-plannedOn');
  }

  /**
   * Open project filter popover
   */
  openProjectFilter(event: Event): void {
    if (!this.hasProjectColumnData('name')) {
      event.stopPropagation();
      return;
    }

    const targetElement = (event.currentTarget || event.target) as HTMLElement;
    if (!targetElement) {
      return;
    }
    event.stopPropagation();

    this.projectNamesOptions = this.calculateUniqueProjectNames();

    if (this.isMobileColumnFilter()) {
      if (this.showColumnFilterModal && this.columnFilterModalType === 'projectName') {
        this.closeColumnFilterModal();
        return;
      }
      if (this.showColumnFilterModal) {
        this.columnFilterModalType = 'projectName';
        this.cdr.detectChanges();
        return;
      }
      this.columnFilterModalType = 'projectName';
      this.openColumnFilterModal();
      return;
    }

    this.openFilterPopover(this.projectFilterPopover, targetElement, 'project');
  }

  /**
   * Get unique values for a specific field across all reports in the selected project
   */
  getUniqueValuesForField(field: string, project?: Project): { label: string; value: string }[] {
    if (field === this.currentFilterField && (!project || project === this.selectedProject)) {
      return this.currentGenericOptions;
    }
    return this.calculateUniqueValuesForField(field, project);
  }

  calculateUniqueValuesForField(field: string, project?: Project): { label: string; value: string }[] {
    const projectToUse = project || this.selectedProject;
    if (!projectToUse || !projectToUse.reports) {
      return [];
    }

    // Use filtered reports, excluding the current field filter
    const reports = this.getFilteredReports(projectToUse, [field, 'status']);

    const valueSet = new Set<string>();

    reports.forEach((report) => {
      const value = this.normalizeColumnFilterValue(this.getReportFieldValue(report, field));
      valueSet.add(value);
    });
    this.appendSelectedFilterValues(valueSet, this.getProjectReportFilters(projectToUse).generic?.[field]);

    return this.sortColumnFilterValues(Array.from(valueSet)).map((val) => ({
      label: this.getColumnFilterOptionLabel(val),
      value: val,
    }));
  }

  /**
   * Get the column header for a field
   */
  getColumnHeader(field: string): string {
    const col = this.reportCols.find((c) => c.field === field);
    return col ? col.header : field;
  }

  /**
   * Get the generic filter value for a field
   */
  getGenericFilterValue(field: string, project?: Project | null): string[] {
    const filters = this.getProjectReportFilters(project || this.selectedProject);
    return filters.generic[field] || [];
  }

  /**
   * Get the value of a report field for filtering
   */
  private getReportFieldValue(report: Report, field: string): string {
    if (field === 'address') {
      return this.getReportAddress(report);
    }

    if (field === 'feedback') {
      return report.feedback === true || report.feedback === 'true' ? 'Ja' : '';
    }
    if (field === 'reportTo') {
      return this.formatDateForFilter(report.reportTo) || '';
    }
    if (field === 'note') {
      return report.note || '';
    }
    if (field === 'plannedOn') {
      return report.plannedOn || '';
    }

    // Handle nested fields
    if (field.includes('.')) {
      const parts = field.split('.');
      let value: any = report;
      for (const part of parts) {
        value = value?.[part];
      }
      return value ? String(value) : '';
    }

    return report[field as keyof Report] ? String(report[field as keyof Report]) : '';
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

    // Convert status id to number for comparison (handles both string and number types from API)
    const statusId = Number(report.status.id);

    // Handle different status filter values - matching backend logic using enum
    switch (statusFilter.toLowerCase()) {
      case 'new':
        return categorizeReportForAkzente(statusId) === 'new';

      case 'completed':
        return categorizeReportForAkzente(statusId) === 'completed';

      case 'ongoing':
        return categorizeReportForAkzente(statusId) === 'ongoing';

      default:
        // For any other status, do exact match by name
        return report.status.name?.toLowerCase() === statusFilter.toLowerCase();
    }
  }

  /**
   * Get navigation params for report links that include the current status filter
   */
  getReportNavParams(report: Report): Record<string, any> {
    return this.getReportNavigationQueryParams(report);
  }

  /**
   * Clear the status filter and refresh the view
   */
  clearStatusFilter(): void {
    this.statusFilter = '';

    // Navigate back to the same route without the status query parameter
    if (this.client) {
      this.navigateBackToClient();
    }
  }

  private attachTableScrollListener(element?: HTMLElement): void {
    // If listener already exists, don't attach again
    if (this.tableScrollListener) {
      return;
    }

    // If no element provided, try to find it
    if (!element) {
      const tableEl = this.projectsTable?.el?.nativeElement;
      if (!tableEl) return;

      element = tableEl.querySelector('.p-datatable-wrapper') || tableEl.querySelector('.p-datatable-scrollable-body') || tableEl.querySelector('.p-datatable-table-container');

      // Deep fallback: look for any div with overflow-y auto/scroll
      if (!element) {
        const divs = tableEl.querySelectorAll('div');
        for (let i = 0; i < divs.length; i++) {
          const style = window.getComputedStyle(divs[i]);
          if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
            element = divs[i] as HTMLElement;
            break;
          }
        }
      }
    }

    if (element) {
      this.tableScrollListener = this.renderer.listen(element, 'scroll', (event) => {
        const target = event.target as HTMLElement;
        this.tableScrollPosition = target.scrollTop;
      });
    }
  }

  private attachWindowScrollListener(): void {
    if (this.windowScrollListener) {
      return;
    }

    this.windowScrollListener = this.renderer.listen('window', 'scroll', () => {
      this.windowScrollPosition = window.scrollY || document.documentElement.scrollTop;
    });
  }

  private shouldPersistState(): boolean {
    if (!this.nextUrl) return false;
    // Persist state if navigating to reports or edit-report within the same client/project context
    return this.nextUrl.includes('/reports/') || this.nextUrl.includes('/edit-report/');
  }

  ngAfterViewInit(): void {
    this.attachWindowScrollListener();

    // Restore window scroll position if available
    if (this.windowScrollPosition > 0) {
      setTimeout(() => {
        window.scrollTo(0, this.windowScrollPosition);
      }, 100);
    }

    // Restore table scroll position (this also attaches the listener)
    this.restoreTableScrollPosition();

    // Subscribe to dropdown changes to auto-open when editing starts
    this.editDropdowns.changes.pipe(takeUntil(this.destroy$)).subscribe((list: QueryList<Dropdown>) => {
      if (list.length > 0 && this.shouldOpenMerchandiserDropdown) {
        const dropdown = list.first;
        // Use setTimeout to ensure the dropdown is fully rendered and ready
        setTimeout(() => {
          if (dropdown && !dropdown.overlayVisible) {
            dropdown.show();
            dropdown.focus();
          }
        }, 50);
        this.shouldOpenMerchandiserDropdown = false;
      }
    });
  }

  resetView(): void {
    // Reset all filters and state
    this.closeReportsSidebar(true);
    this.expandedRows = {};
    this.statusFilter = '';
    this.clientSearchTerm = '';
    this.projectSearchTerm = '';
    this.filialeSearchTerm = '';
    this.reportStatusFilter = [];
    this.reportMerchandiserFilter = [];
    this.reportFilialenFilter = [];
    this.reportPlannedOnFilter = [];
    this.projectNameFilter = [];
    this.projectColumnFilterValues = {};
    this.genericFilterValues = {};
    this.dateRange2 = { start: null, end: null };
    this.plannedOnDateRange = { start: null, end: null };

    // Reset sorting
    this.projectSortField = '';
    this.projectSortOrder = 1;
    this.reportSortField = '';
    this.reportSortOrder = 1;

    // Reset columns to default
    this.selectedColumns = [...this.cols];
    this.selectedReportColumns = this.reportCols.filter((col) => col.field !== 'feedback');
    this.syncVisibleColumnSelections();

    // Apply filters to update view
    this.applyFilters();

    // Force change detection
    this.cdr.markForCheck();
  }

  private isDestroying = false;

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.isDestroying = true;
    if (this.tableScrollListener) {
      this.tableScrollListener();
    }

    if (this.reportsTableScrollListener) {
      this.reportsTableScrollListener();
    }

    if (this.windowScrollListener) {
      this.windowScrollListener();
    }

    if (this.routerSubscription) {
      this.routerSubscription.unsubscribe();
    }

    if (this.resetSubscription) {
      this.resetSubscription.unsubscribe();
    }

    // Save current state when leaving the page if navigating to child routes
    if (this.client?.id) {
      if (this.shouldPersistState()) {
        // State is already saved in NavigationStart to ensure DOM access
      } else {
        // Optional: Clear state if navigating away completely?
        // For now, we keep the behavior of saving state only when needed,
        // but maybe we should clear it if we go back to list?
        // The requirement is "remembering... while going to the edit or show and back".
        // If we go to list and come back, maybe we want a fresh start?
        // Dashboard clears state if not persisting.
        // this.clientDetailStateService.clearState(this.client.id);
        // However, clientDetailStateService might be used for other things.
        // Let's stick to saving only when shouldPersistState is true.
        // But wait, if I don't save, the OLD state remains in the service.
        // If I navigate to "Home" and come back, the OLD state (from before I went to Home) is restored.
        // That might be confusing if I scrolled to top before leaving.
        // So I should probably update the state with current position (even if 0) OR clear it.
        // If I clear it, it resets to top.
        // If I don't clear it, it remembers the LAST saved state (which might be deep scroll).
        // If I navigate to Home, I probably want to reset.
        // So clearing seems correct if NOT persisting.
        this.clientDetailStateService.clearState(this.client.id);
      }
    }
  }

  private createProjectsSnapshot(): Project[] {
    if (!Array.isArray(this.projects)) {
      return [];
    }

    return this.projects.map((project) => {
      if (!project) {
        return project;
      }

      const { reports: _reports, ...rest } = project as Project & { reports?: Report[] };
      return { ...rest } as Project;
    });
  }

  /**
   * Save current state to the state service
   */
  private saveCurrentState(): void {
    if (!this.client?.id) return;

    const start = this.now();
    this.logDebug('saveCurrentState invoked', {
      clientId: this.client.id,
      projectCount: this.projects?.length ?? 0,
      expandedCount: Object.keys(this.expandedRows || {}).length,
    });

    // Get scroll position from the table
    let tableScrollPosition = this.tableScrollPosition;

    // Fallback: Try to get from component reference first if local var is 0 (maybe not updated yet?)
    if (this.projectsTable?.el?.nativeElement) {
      const tableEl = this.projectsTable.el.nativeElement;
      let scrollContainer = tableEl.querySelector('.p-datatable-scrollable-body') || tableEl.querySelector('.p-datatable-wrapper') || tableEl.querySelector('.p-datatable-table-container');

      // Deep fallback: look for any div with overflow-y auto/scroll
      if (!scrollContainer) {
        const divs = tableEl.querySelectorAll('div');
        for (let i = 0; i < divs.length; i++) {
          const style = window.getComputedStyle(divs[i]);
          if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
            scrollContainer = divs[i];
            break;
          }
        }
      }

      if (scrollContainer && scrollContainer.scrollTop > 0) {
        tableScrollPosition = scrollContainer.scrollTop;
      }
    }
    // Fallback: try to find by selector if component ref is missing (e.g. during destroy)
    if (tableScrollPosition === 0) {
      const scrollContainer =
        document.querySelector('app-client-detail .p-datatable-scrollable-body') ||
        document.querySelector('app-client-detail .p-datatable-wrapper') ||
        document.querySelector('app-client-detail .p-datatable-table-container');
      if (scrollContainer) {
        tableScrollPosition = scrollContainer.scrollTop || 0;
      }
    }

    this.captureReportsTableScrollPosition();
    this.captureMobileReportsSidebarScrollPosition();

    // Convert columns to StoredColumn format
    const storedProjectsOrderedColumns = this.projectsOrderedColumns.map((col) => ({ field: col.field, header: col.header }));
    const storedReportsOrderedColumns = this.reportsOrderedColumns.map((col) => ({ field: col.field, header: col.header }));
    const storedSelectedColumns = this.selectedColumns?.map((col) => ({ field: col.field, header: col.header })) || [];
    const storedSelectedReportColumns = this.selectedReportColumns?.map((col) => ({ field: col.field, header: col.header })) || [];

    this.clientDetailStateService.saveState(this.client.id, {
      client: this.client,
      projects: this.createProjectsSnapshot(),
      expandedRows: this.expandedRows,
      statusFilter: this.statusFilter,
      clientSearchTerm: this.clientSearchTerm,
      projectSearchTerm: this.projectSearchTerm,
      filialeSearchTerm: this.filialeSearchTerm,
      reportStatusFilter: this.reportStatusFilter,
      reportMerchandiserFilter: this.reportMerchandiserFilter,
      reportFilialenFilter: this.reportFilialenFilter,
      reportPlannedOnFilter: this.reportPlannedOnFilter,
      projectNameFilter: this.projectNameFilter,
      projectColumnFilterValues: this.projectColumnFilterValues,
      genericFilterValues: this.genericFilterValues,
      dateRange: this.dateRange2,
      plannedOnDateRange: this.plannedOnDateRange,
      projectsVisibleColumns: this.projectsVisibleColumns,
      reportsVisibleColumns: this.reportsVisibleColumns,
      projectsOrderedColumns: storedProjectsOrderedColumns,
      reportsOrderedColumns: storedReportsOrderedColumns,
      selectedColumns: storedSelectedColumns,
      selectedReportColumns: storedSelectedReportColumns,
      projectSortField: this.projectSortField,
      projectSortOrder: this.projectSortOrder,
      reportSortField: this.reportSortField,
      reportSortOrder: this.reportSortOrder,
      scrollPosition: this.windowScrollPosition,
      tableScrollPosition: tableScrollPosition,
      reportsTableScrollPosition: this.reportsTableScrollPosition,
      reportsTableScrollPositionByProject: { ...this.reportsTableScrollPositionByProject },
      mobileReportsSidebarScrollPositionByProject: { ...this.mobileReportsSidebarScrollPositionByProject },
      defaultReportFilters: this.defaultReportFilters,
      projectReportFilters: this.buildProjectFiltersMap(),
      sidebarVisibleProjectId: this.sidebarVisibleProjectId,
    });
    this.logDuration('saveCurrentState completed', start, {
      clientId: this.client.id,
    });
  }

  private saveScheduled = false;

  private scheduleStateSave(): void {
    if (this.saveScheduled || !this.client?.id) {
      return;
    }

    this.saveScheduled = true;
    const callback = () => {
      this.saveScheduled = false;
      this.saveCurrentState();
    };

    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(callback, { timeout: 100 });
    } else {
      setTimeout(callback, 0);
    }
  }

  /**
   * Restore state from cache
   */
  private restoreStateFromCache(clientId: number): boolean {
    const start = this.now();
    this.logDebug('restoreStateFromCache invoked', { clientId });
    const cachedState = this.clientDetailStateService.getState(clientId);
    const hasCachedData = !!(cachedState?.client && cachedState?.projects && cachedState.projects.length > 0);

    if (cachedState && this.clientDetailStateService.isCacheValid(clientId)) {
      if (!hasCachedData) {
        this.client = undefined;
        this.projects = [];
        this.filteredProjects = [];
      }

      // Restore client info
      if (hasCachedData && cachedState.client) {
        this.client = cachedState.client;
      }

      // Restore projects and expanded rows
      if (hasCachedData && cachedState.projects && cachedState.projects.length > 0) {
        this.projects = cachedState.projects;
        this.filteredProjects = [...cachedState.projects]; // Initialize filteredProjects
        this.expandedRows = cachedState.expandedRows || {};

        if (this.client?.id) {
          // setClientProjects uses unfiltered projects so sidebar shows all projects
          this.clientService.setClientProjects(
            this.client.id.toString(),
            this.projects.map((p) => ({
              id: p.id?.toString() ?? '',
              name: p.name ?? '',
              clientId: this.client!.id.toString(),
            })),
          );

          const activeProjectId = Object.keys(this.expandedRows || {}).find((projectId) => this.expandedRows?.[projectId]);
          this.clientService.setSelectedProject(this.client.id.toString(), activeProjectId ?? null);
        }
        // Populate in-memory copies from persisted cache entries when available
        const restoredStatusFilter = cachedState.statusFilter || '';
        this.statusFilter = restoredStatusFilter;
        this.projects.forEach((proj) => {
          if (!proj?.id) {
            return;
          }

          // Don't filter by status when peeking - we want all reports and filter client-side
          const snapshot = this.reportCacheService.peek(proj.id);
          if (snapshot?.data?.length) {
            (proj as Project & { reports?: Report[] }).reports = snapshot.data;
            this.reportCacheService.seed(proj.id, snapshot.data);
          }
        });
      }
      if (!hasCachedData) {
        this.expandedRows = cachedState.expandedRows || {};
      }

      // Restore filter states from cache
      this.statusFilter = cachedState.statusFilter || '';
      this.clientSearchTerm = cachedState.clientSearchTerm || '';
      this.projectSearchTerm = cachedState.projectSearchTerm || '';
      this.filialeSearchTerm = cachedState.filialeSearchTerm || '';
      this.reportStatusFilter = cachedState.reportStatusFilter || [];
      this.reportMerchandiserFilter = cachedState.reportMerchandiserFilter || [];
      this.reportFilialenFilter = cachedState.reportFilialenFilter || [];
      this.reportPlannedOnFilter = cachedState.reportPlannedOnFilter || [];
      this.projectNameFilter = cachedState.projectNameFilter || [];
      this.projectColumnFilterValues = cachedState.projectColumnFilterValues || {};
      this.genericFilterValues = cachedState.genericFilterValues || {};
      this.dateRange2 = cachedState.dateRange || { start: null, end: null };
      this.plannedOnDateRange = cachedState.plannedOnDateRange || { start: null, end: null };
      if (cachedState.defaultReportFilters) {
        this.defaultReportFilters = this.cloneProjectFilters(cachedState.defaultReportFilters as ProjectReportFilters);
      }

      // Restore per-project filters map
      if (cachedState.projectReportFilters) {
        Object.entries(cachedState.projectReportFilters).forEach(([projectId, filters]) => {
          const proj = this.projects?.find((p) => p?.id?.toString() === projectId);
          if (proj) {
            proj._reportFilters = this.cloneProjectFilters(filters as ProjectReportFilters);
          }
        });
      }

      // Keep defaults in sync with restored UI filter values so new projects start with the same baseline
      this.updateDefaultReportFiltersFromUi();

      // After restoring from cache, apply query params as overrides (if present)
      this.restoreFiltersFromQuery(this.route.snapshot.queryParamMap, true);

      // Restore column visibility and order
      if (cachedState.projectsVisibleColumns) {
        this.projectsVisibleColumns = cachedState.projectsVisibleColumns;
      }
      if (cachedState.reportsVisibleColumns) {
        this.reportsVisibleColumns = cachedState.reportsVisibleColumns;
      }
      if (cachedState.projectsOrderedColumns && cachedState.projectsOrderedColumns.length > 0) {
        this.projectsOrderedColumns = this.hydrateOrderedColumns(cachedState.projectsOrderedColumns, this.cols);
      } else if (this.projectsOrderedColumns.length === 0) {
        // Initialize if empty
        this.projectsOrderedColumns = [...this.cols];
      }
      if (cachedState.reportsOrderedColumns && cachedState.reportsOrderedColumns.length > 0) {
        this.reportsOrderedColumns = this.hydrateOrderedColumns(cachedState.reportsOrderedColumns, this.reportCols);
      } else if (this.reportsOrderedColumns.length === 0) {
        // Initialize if empty
        this.reportsOrderedColumns = [...this.reportCols];
      }

      // Sync selected columns with visible columns (like dashboard)
      // This will set selectedColumns based on visibleColumns and orderedColumns
      // Don't restore selectedColumns from cache - derive them from visibleColumns instead
      this.syncVisibleColumnSelections();

      // Restore sort states
      this.projectSortField = cachedState.projectSortField || '';
      this.projectSortOrder = cachedState.projectSortOrder || 1;
      this.reportSortField = cachedState.reportSortField || '';
      this.reportSortOrder = cachedState.reportSortOrder || 1;

      // If there's a status filter from query params, set it BEFORE applyFilters
      // and ensure all projects have their reports loaded so filtering works correctly
      const queryStatusFilter = this.route.snapshot.queryParamMap.get('status');
      if (hasCachedData && queryStatusFilter) {
        this.statusFilter = queryStatusFilter;
        let firstExpandedSet = false;
        // Iterate over ALL projects (not filteredProjects which hasn't been populated yet)
        this.projects.forEach((proj) => {
          if (proj && proj.id) {
            // Check if reports need to be loaded
            if (!proj.reports || proj.reports.length === 0) {
              // Mark as loading but don't block - we'll load asynchronously
              this.loadingReports[proj.id] = true;
              this.reportCacheService
                .getProjectReports(proj.id)
                .pipe(take(1))
                .subscribe({
                  next: (reports) => {
                    proj.reports = reports;
                    this.updateProjectDerivedData(proj);
                    this.loadingReports[proj.id] = false;
                    // After reports loaded, re-apply filters to show projects with matching reports
                    this.applyFilters();
                    // Expand projects that have matching reports
                    if (proj._filteredReports && proj._filteredReports.length > 0 && !firstExpandedSet) {
                      this.expandedRows = { [proj.id as string]: true };
                      firstExpandedSet = true;
                    }
                    this.cdr.markForCheck();
                  },
                  error: (err) => {
                    console.error(`Error fetching reports for project ${proj.id}:`, err);
                    proj.reports = [];
                    this.updateProjectDerivedData(proj);
                    this.loadingReports[proj.id] = false;
                    this.cdr.markForCheck();
                  },
                });
            } else {
              // Reports already loaded, update derived data with new status filter
              this.updateProjectDerivedData(proj);
              if (proj._filteredReports && proj._filteredReports.length > 0 && !firstExpandedSet) {
                this.expandedRows = { [proj.id as string]: true };
                firstExpandedSet = true;
              }
            }
          }
        });
      }

      // Apply filters now that we have client info from cache
      if (hasCachedData) {
        this.applyFilters();
      }

      // Restore scroll positions after view is initialized
      if (cachedState.tableScrollPosition !== undefined) {
        // New format: scrollPosition is window, tableScrollPosition is table
        if (cachedState.scrollPosition && cachedState.scrollPosition > 0) {
          this.windowScrollPosition = cachedState.scrollPosition;
          // Also try to scroll window here
          setTimeout(() => {
            window.scrollTo(0, this.windowScrollPosition);
          }, 100);
        }
        if (cachedState.tableScrollPosition && cachedState.tableScrollPosition > 0) {
          this.tableScrollPosition = cachedState.tableScrollPosition;
          this.restoreTableScrollPosition();
        }
        if (cachedState.reportsTableScrollPositionByProject && Object.keys(cachedState.reportsTableScrollPositionByProject).length > 0) {
          this.reportsTableScrollPositionByProject = { ...cachedState.reportsTableScrollPositionByProject };
        } else if (cachedState.reportsTableScrollPosition && cachedState.reportsTableScrollPosition > 0) {
          this.reportsTableScrollPosition = cachedState.reportsTableScrollPosition;
        }
        if (cachedState.mobileReportsSidebarScrollPositionByProject && Object.keys(cachedState.mobileReportsSidebarScrollPositionByProject).length > 0) {
          this.mobileReportsSidebarScrollPositionByProject = { ...cachedState.mobileReportsSidebarScrollPositionByProject };
        }
      } else {
        // Old format: scrollPosition was table scroll
        if (cachedState.scrollPosition && cachedState.scrollPosition > 0) {
          this.tableScrollPosition = cachedState.scrollPosition;
          this.restoreTableScrollPosition();
        }
      }

      if (cachedState.sidebarVisibleProjectId !== undefined) {
        this.sidebarVisibleProjectId = cachedState.sidebarVisibleProjectId;
        if (hasCachedData && this.sidebarVisibleProjectId) {
          this.restoreMobileReportsSidebarScrollPosition(this.sidebarVisibleProjectId);
          // Find the project and ensure reports are loaded
          const projectForSidebar = this.projects?.find((p) => p?.id?.toString() === this.sidebarVisibleProjectId?.toString());
          if (projectForSidebar && !this.loadingReports[projectForSidebar.id as string] && !projectForSidebar._filteredReports?.length) {
            this.loadProjectReports(projectForSidebar);
          }
        }
      }

      this.logDuration('restoreStateFromCache success', start, {
        clientId,
        projectCount: hasCachedData ? (this.projects?.length ?? 0) : 0,
        restoredViewStateOnly: !hasCachedData,
      });
      return hasCachedData;
    }
    this.logDuration('restoreStateFromCache miss', start, { clientId });
    return false;
  }

  /**
   * Sync selected columns with visible columns (like dashboard)
   */
  private syncVisibleColumnSelections(): void {
    // Ensure ordered columns are initialized
    if (this.projectsOrderedColumns.length === 0) {
      this.projectsOrderedColumns = [...this.cols];
    }
    if (this.reportsOrderedColumns.length === 0) {
      this.reportsOrderedColumns = [...this.reportCols];
    }

    // Sync projects columns - filter based on visible columns
    this.selectedColumns = this.projectsOrderedColumns.filter((col) => {
      // If visibility is explicitly set, use it; otherwise default to true
      return this.projectsVisibleColumns[col.field] !== false;
    });

    // If no columns selected, select all visible columns
    if (!this.selectedColumns.length) {
      this.selectedColumns = [...this.projectsOrderedColumns];
      this.selectedColumns.forEach((col) => {
        if (this.projectsVisibleColumns[col.field] === undefined) {
          this.projectsVisibleColumns[col.field] = true;
        }
      });
    }

    // Sync reports columns - filter based on visible columns
    // Exclude feedback by default if not explicitly visible
    this.selectedReportColumns = this.reportsOrderedColumns.filter((col) => {
      // If visibility is explicitly set, use it
      if (this.reportsVisibleColumns[col.field] !== undefined) {
        return this.reportsVisibleColumns[col.field] !== false;
      }
      // Default: exclude feedback
      if (col.field === 'feedback') {
        return false;
      }
      // Default: include all other columns
      return true;
    });

    // If no columns selected, select all visible columns (excluding feedback   by default)
    if (!this.selectedReportColumns.length) {
      this.selectedReportColumns = this.reportsOrderedColumns.filter((col) => col.field !== 'feedback');
      this.selectedReportColumns.forEach((col) => {
        if (this.reportsVisibleColumns[col.field] === undefined) {
          this.reportsVisibleColumns[col.field] = true;
        }
      });
    }

    this.updateVisibleColumns();
  }

  /**
   * Hydrate stored columns back to full Column objects
   */
  private hydrateOrderedColumns(storedColumns: any[], availableColumns: Column[]): Column[] {
    const columnMap = availableColumns.reduce<Record<string, Column>>((acc, col) => {
      acc[col.field] = col;
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
    availableColumns.forEach((col) => {
      if (!ordered.find((c) => c.field === col.field)) {
        ordered.push(col);
      }
    });

    return ordered;
  }

  /**
   * Restore table scroll position.
   * Uses a cancellation ID so only the most recent invocation's retry loop runs.
   * Once the position has been successfully restored, subsequent calls are no-ops.
   */
  private restoreTableScrollPosition(): void {
    if (this._scrollRestorationDone || this._deferScrollToRefresh) {
      return;
    }

    const targetPosition = this.tableScrollPosition;
    const restoreId = ++this._restoreScrollId;
    let attempts = 0;
    const maxAttempts = 30;

    const checkAndRestore = () => {
      if (restoreId !== this._restoreScrollId) return;

      const tableEl = this.projectsTable?.el?.nativeElement;

      let scrollableBody: HTMLElement | null = null;

      if (tableEl) {
        scrollableBody = tableEl.querySelector('.p-datatable-wrapper') || tableEl.querySelector('.p-datatable-scrollable-body') || tableEl.querySelector('.p-datatable-table-container');

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
        this.attachTableScrollListener(scrollableBody);

        if (targetPosition > 0 && Math.abs(scrollableBody.scrollTop - targetPosition) > 5) {
          scrollableBody.scrollTop = targetPosition;

          if (Math.abs(scrollableBody.scrollTop - targetPosition) > 5 && attempts < maxAttempts) {
            attempts++;
            requestAnimationFrame(checkAndRestore);
          } else {
            this._scrollRestorationDone = true;
          }
        } else if (targetPosition > 0) {
          this._scrollRestorationDone = true;
        }
      } else if (attempts < maxAttempts) {
        attempts++;
        requestAnimationFrame(checkAndRestore);
      }
    };

    checkAndRestore();
  }

  /**
   * Attach scroll listener to the reports table (nested table in expanded rows)
   * Uses DOM queries to find the scrollable element since the table is dynamically created
   */
  private attachReportsTableScrollListener(element?: HTMLElement, projectId?: string | number): void {
    // If listener already exists, don't attach again
    if (this.reportsTableScrollListener) {
      return;
    }

    // If no element provided, try to find it from the DOM
    if (!element) {
      const reportsContainer = document.querySelector('.reports-table-container[data-project-id]');
      const expandedRowCell = reportsContainer || document.querySelector('.expanded-row-cell');

      if (expandedRowCell) {
        // For PrimeNG virtual scroll, the scrollable element is .p-scroller
        const selectors = [
          '.p-scroller', // PrimeNG virtual scroll wrapper
          '.p-datatable-wrapper', // Standard PrimeNG wrapper
          '.p-datatable-scrollable-body', // Older PrimeNG versions
          '.p-datatable-table-container', // Table container
          '.p-virtualscroller', // Virtual scroller
          'cdk-virtual-scroll-viewport', // CDK virtual scroll
        ];

        for (const selector of selectors) {
          const el = expandedRowCell.querySelector(selector) as HTMLElement;
          if (el && el.scrollHeight > el.clientHeight) {
            element = el;
            break;
          }
        }

        // Fallback: look for any div with overflow-y auto/scroll
        if (!element) {
          const divs = expandedRowCell.querySelectorAll('div');
          for (let i = 0; i < divs.length; i++) {
            const div = divs[i] as HTMLElement;
            const style = window.getComputedStyle(div);
            if ((style.overflowY === 'auto' || style.overflowY === 'scroll') && div.scrollHeight > div.clientHeight) {
              element = div;
              break;
            }
          }
        }
      }
    }

    if (element) {
      const pid = projectId != null ? String(projectId) : null;
      this.reportsTableScrollListener = this.renderer.listen(element, 'scroll', (event) => {
        const target = event.target as HTMLElement;
        const top = target.scrollTop;
        this.reportsTableScrollPosition = top;
        if (pid) this.reportsTableScrollPositionByProject[pid] = top;
      });
    }
  }

  /**
   * Restore reports table scroll position for a specific project.
   * Only restores the scroll for the given project's reports table, not others.
   */
  private restoreReportsTableScrollPosition(projectId?: string): void {
    const targetPosition = projectId ? (this.reportsTableScrollPositionByProject[projectId] ?? 0) : this.reportsTableScrollPosition;

    if (!targetPosition || targetPosition <= 0) {
      this.attachReportsTableListenerOnly(projectId);
      return;
    }

    let attempts = 0;
    const maxAttempts = 30;

    const checkAndRestore = () => {
      let container: HTMLElement | null = null;
      if (projectId) {
        container = document.querySelector(`.reports-table-container[data-project-id="${projectId}"]`) as HTMLElement;
      }
      if (!container) {
        container = (document.querySelector('.reports-table-container[data-project-id]') as HTMLElement) || (document.querySelector('.expanded-row-cell') as HTMLElement);
      }
      if (!container) {
        if (attempts < maxAttempts) {
          attempts++;
          requestAnimationFrame(checkAndRestore);
        }
        return;
      }

      const scrollableBody = this.findScrollableInElement(container);
      if (scrollableBody) {
        this.attachReportsTableScrollListener(scrollableBody, projectId);
        const maxScroll = scrollableBody.scrollHeight - scrollableBody.clientHeight;
        if (maxScroll >= targetPosition - 5) {
          scrollableBody.scrollTo({ top: targetPosition, behavior: 'smooth' });
          return;
        }
      }
      if (attempts < maxAttempts) {
        attempts++;
        requestAnimationFrame(checkAndRestore);
      }
    };
    checkAndRestore();
  }

  private findScrollableInElement(el: HTMLElement): HTMLElement | null {
    const selectors = ['.p-scroller', '.p-datatable-wrapper', '.p-datatable-scrollable-body', '.p-datatable-table-container', '.p-virtualscroller', 'cdk-virtual-scroll-viewport'];
    for (const sel of selectors) {
      const found = el.querySelector(sel) as HTMLElement;
      if (found && found.scrollHeight > found.clientHeight) return found;
    }
    const divs = el.querySelectorAll('div');
    for (let i = 0; i < divs.length; i++) {
      const div = divs[i] as HTMLElement;
      const style = window.getComputedStyle(div);
      if ((style.overflowY === 'auto' || style.overflowY === 'scroll') && div.scrollHeight > div.clientHeight) return div;
    }
    return null;
  }

  private attachReportsTableListenerOnly(projectId?: string): void {
    let attempts = 0;
    const maxAttempts = 20;
    const tryAttach = () => {
      let container: HTMLElement | null = projectId
        ? (document.querySelector(`.reports-table-container[data-project-id="${projectId}"]`) as HTMLElement)
        : (document.querySelector('.reports-table-container[data-project-id]') as HTMLElement);
      if (!container) container = document.querySelector('.expanded-row-cell') as HTMLElement;
      if (container) {
        const el = this.findScrollableInElement(container);
        if (el) {
          const pid = container.getAttribute('data-project-id') || projectId;
          this.attachReportsTableScrollListener(el, pid || undefined);
          return;
        }
      }
      if (attempts < maxAttempts) {
        attempts++;
        requestAnimationFrame(tryAttach);
      }
    };
    tryAttach();
  }

  /**
   * Called when a project row is expanded to attach reports table listener.
   * Restores scroll only for the given project's reports table (not other projects).
   */
  onProjectExpanded(projectId?: string | number): void {
    if (this.reportsTableScrollListener) {
      this.reportsTableScrollListener();
      this.reportsTableScrollListener = null;
    }
    const pid = projectId != null ? String(projectId) : undefined;
    requestAnimationFrame(() => {
      this.restoreReportsTableScrollPosition(pid);
    });
  }
}
