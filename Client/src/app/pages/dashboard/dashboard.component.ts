import { Component, OnInit, OnDestroy, ViewEncapsulation } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { Location } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { ImportsModule } from '@app/shared/imports';
import { AppIconComponent } from '../../shared/app-icon.component';
import { FavoriteToggleComponent } from '@app/shared/components/favorite-toggle/favorite-toggle.component';
import { DateRangePickerComponent } from '@app/shared/components/date-range-picker/date-range-picker.component';
import { MobileFilterSheetComponent } from '@app/shared/components/mobile-filter-sheet/mobile-filter-sheet.component';
import { DashboardService, DashboardProject } from '@app/core/services/dashboard.service';
import { ProjectService } from '@app/@core/services/project.service';
import { DashboardStateService } from './dashboard-state.service';
import { HotToastService } from '@ngneat/hot-toast';
import { catchError, of } from 'rxjs';
import { Subject } from 'rxjs';
import { distinctUntilChanged, skip, takeUntil } from 'rxjs/operators';
import { RouterModule } from '@angular/router';
import { InitializerService } from '@app/core/services/initializer.service';
@Component({
  selector: 'app-dashboard',
  imports: [TranslateModule, ImportsModule, AppIconComponent, DateRangePickerComponent, FavoriteToggleComponent, RouterModule, MobileFilterSheetComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
  encapsulation: ViewEncapsulation.None,
})
export class DashboardComponent implements OnInit, OnDestroy {
  showDashboardMobileFilterSheet = false;
  // Filter states
  activeFilter: 'all' | 'running' | 'completed' | 'favorites' = 'all';
  dateRange = { start: null, end: null };

  // API data
  projects: DashboardProject[] = [];
  loading = true;
  error = false;

  // Check if can go back (has navigation history)
  canGoBack: boolean = false;

  private destroy$ = new Subject<void>();

  // Computed properties for templates
  get favoriteProjects(): DashboardProject[] {
    return this.projects.filter((project) => project.isFavorite);
  }

  get nonFavoriteProjects(): DashboardProject[] {
    return this.projects.filter((project) => !project.isFavorite);
  }

  // Add computed property for favorite projects in filtered results
  get favoriteFilteredProjects(): DashboardProject[] {
    return this.filteredProjects.filter((project) => project.isFavorite);
  }

  // Add computed property for non-favorite projects in filtered results
  get nonFavoriteFilteredProjects(): DashboardProject[] {
    return this.filteredProjects.filter((project) => !project.isFavorite);
  }

  // Add this computed property for filtered projects
  get filteredProjects(): DashboardProject[] {
    return this.projects.filter((project) => {
      // Filter by favorites
      if (this.activeFilter === 'favorites' && !project.isFavorite) {
        return false;
      }

      // Filter by status (skip if filtering by favorites)
      if (this.activeFilter !== 'all' && this.activeFilter !== 'favorites') {
        if (this.activeFilter === 'completed') {
          // For completed projects, check if all reports have status "ok" (VALID)
          // A project is completed only if:
          // - It has at least one report (to exclude projects with no reports)
          // - All reports are completed (no new or ongoing reports)
          const totalReports = (project.reportCounts?.newReports || 0) + (project.reportCounts?.ongoingReports || 0) + (project.reportCounts?.completedReports || 0);

          const hasAllReportsOk =
            totalReports > 0 && (project.reportCounts?.newReports || 0) === 0 && (project.reportCounts?.ongoingReports || 0) === 0 && (project.reportCounts?.completedReports || 0) > 0;

          if (!hasAllReportsOk) {
            return false;
          }
        } else if (this.activeFilter === 'running') {
          // For running projects, only show projects that have ongoing reports count > 0
          // This means projects with only completed reports (but no ongoing reports) should NOT be included
          const ongoingReportsCount = project.reportCounts?.ongoingReports || 0;
          if (ongoingReportsCount === 0) {
            return false;
          }
        }
      }

      // Filter by date range if dates are selected
      if (this.dateRange.start && this.dateRange.end) {
        // Parse project dates
        const projectStartDate = new Date(project.startDate);
        const projectEndDate = new Date(project.endDate);

        // Check if project date range overlaps with selected range
        if (projectEndDate < this.dateRange.start || projectStartDate > this.dateRange.end) {
          return false;
        }
      }

      return true;
    });
  }

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private dashboardService: DashboardService,
    private projectService: ProjectService,
    private dashboardStateService: DashboardStateService,
    private toast: HotToastService,
    private location: Location,
    private initializerService: InitializerService,
  ) {
    // Check if we have navigation history
    const navigation = this.router.getCurrentNavigation();
    this.canGoBack = !!navigation?.previousNavigation;
  }

  ngOnInit() {
    // Listen to query params for filter
    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      if (params['filter']) {
        const filter = params['filter'];
        if (['all', 'running', 'completed'].includes(filter)) {
          this.activeFilter = filter as any;
        }
      }
    });

    // Try to restore from cache first
    const cachedData = this.dashboardStateService.getDashboardDataSnapshot();
    if (cachedData && this.dashboardStateService.isCacheValid()) {
      this.projects = cachedData.projects || [];
      this.loading = false;

      // Load fresh data in background (without showing loader)
      this.loadDashboardData({ showLoader: false });
    } else {
      // No valid cache, load from server with loader
      this.loadDashboardData({ showLoader: true });
    }

    this.initializerService.currentClientCompany$
      .pipe(
        distinctUntilChanged((previous, current) => previous?.id === current?.id),
        skip(1),
        takeUntil(this.destroy$),
      )
      .subscribe(() => {
        this.dashboardStateService.clearCache();
        this.loadDashboardData({ showLoader: true });
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  navigateBack(): void {
    if (this.canGoBack) {
      this.location.back();
    }
  }

  loadDashboardData(options: { showLoader: boolean } = { showLoader: true }): void {
    if (options.showLoader) {
      this.loading = true;
    }
    this.error = false;

    this.dashboardService
      .getDashboardData(this.initializerService.getCurrentClientCompany()?.id)
      .pipe(
        takeUntil(this.destroy$),
        catchError((error) => {
          console.error('Error loading dashboard data:', error);
          this.error = true;
          if (options.showLoader) {
            this.toast.error('Fehler beim Laden der Dashboard-Daten', {
              position: 'bottom-right',
              duration: 4000,
            });
          }
          return of(null);
        }),
      )
      .subscribe({
        next: (data) => {
          if (data) {
            const companyProjects = data.assignedProjects || [];

            // Transform the API data to add computed properties
            const transformedProjects = companyProjects.map((project) => this.transformProject(project));

            // Update component state
            this.projects = transformedProjects;

            // Save to store
            this.dashboardStateService.setDashboardData(transformedProjects);
          }
          this.loading = false;
        },
        error: () => {
          this.loading = false;
        },
      });
  }

  /**
   * Transform raw project data from API to include computed properties
   */
  private transformProject(project: DashboardProject): DashboardProject {
    const startDate = new Date(project.startDate);
    const endDate = new Date(project.endDate);
    const today = new Date();

    // Determine status based on dates
    let status: 'running' | 'completed' = 'running';
    // A project is completed only if its end date has passed
    if (endDate < today) {
      status = 'completed';
    }

    // Generate date range string
    const dateRange = `${startDate.getDate().toString().padStart(2, '0')}.${(startDate.getMonth() + 1).toString().padStart(2, '0')}. - ${endDate.getDate().toString().padStart(2, '0')}.${(endDate.getMonth() + 1).toString().padStart(2, '0')}.${endDate.getFullYear()}`;

    // Generate week number
    const weekNumber = `KW ${this.getWeekNumber(startDate)}`;

    // Generate slug from name
    const slug = project.name
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');

    // Use real report counts from API data
    const stats = {
      new: project.reportCounts.newReports,
      open: project.reportCounts.ongoingReports,
      completed: project.reportCounts.completedReports,
    };

    return {
      ...project,
      slug,
      dateRange,
      weekNumber,
      status,
      isFavorite: project.isFavorite || false, // Use the actual isFavorite value from API
      stats,
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

  // Filter methods
  setFilter(filter: 'all' | 'running' | 'completed'): void {
    this.activeFilter = filter;
  }

  // Handle date range selection
  onRangeSelected(range: { start: Date | null; end: Date | null }) {
    this.dateRange = range;
  }

  hasActiveFilters(): boolean {
    // Only show "Zurücksetzen" button when date range filter is active
    // Filter buttons (Alle Projekte, Laufende Projekte, Abgeschlossene Projekte) don't count as active filters
    return !!this.dateRange.start || !!this.dateRange.end;
  }

  clearFilters(): void {
    this.activeFilter = 'all';
    this.dateRange = { start: null, end: null };
  }

  // Handle favorite toggle
  onFavoriteChanged(newStatus: boolean, project: DashboardProject): void {
    // Optimistically update the UI
    const previousStatus = project.isFavorite;
    project.isFavorite = newStatus;

    // Call backend to toggle favorite status using ProjectService
    this.projectService
      .toggleFavoriteStatus(project.id.toString())
      .pipe(
        catchError((error) => {
          console.error('❌ Error toggling project favorite status:', error);

          // Revert the optimistic update on error
          project.isFavorite = previousStatus;

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
            project.isFavorite = result.isFavorite;

            this.toast.success(result.message, {
              position: 'bottom-right',
              duration: 2000,
            });
          }
        },
      });
  }

  // Add these methods for filter buttons
  showAllClients(): void {
    this.activeFilter = 'all';
  }

  showRunningProjects(): void {
    this.activeFilter = 'running';
  }

  showCompletedProjects(): void {
    this.activeFilter = 'completed';
  }

  openDashboardMobileFilterSheet(): void {
    this.showDashboardMobileFilterSheet = true;
  }

  hasDashboardMobileFilterSheetBadge(): boolean {
    return this.hasActiveFilters();
  }

  /**
   * Navigate to project detail without any filters
   */
  navigateToProject(project: DashboardProject, newTab: boolean = false): void {
    if (newTab) {
      const urlTree = this.router.createUrlTree(['/projects', project.id]);
      const url = window.location.origin + urlTree.toString();
      window.open(url, '_blank');
    } else {
      this.router.navigate(['/projects', project.id]);
    }
  }

  /**
   * Navigate to project reports filtered by specific type
   */
  navigateToProjectReports(project: DashboardProject, reportType: 'new' | 'ongoing' | 'completed', newTab: boolean = false): void {
    // Map internal report types to API report types
    const apiReportType = reportType === 'ongoing' ? 'ongoingReports' : reportType === 'new' ? 'newReports' : 'completedReports';

    if (newTab) {
      const urlTree = this.router.createUrlTree(['/projects', project.id], {
        queryParams: { reportFilter: apiReportType },
      });
      const url = window.location.origin + urlTree.toString();
      window.open(url, '_blank');
    } else {
      this.router.navigate(['/projects', project.id], {
        queryParams: { reportFilter: apiReportType },
      });
    }
  }

  openProjectInNewTab(project: DashboardProject): void {
    this.navigateToProject(project, true);
  }

  openProjectReportsInNewTab(project: DashboardProject, reportType: 'new' | 'ongoing' | 'completed'): void {
    this.navigateToProjectReports(project, reportType, true);
  }

  onProjectContextMenu(event: MouseEvent, project: DashboardProject): boolean {
    event.preventDefault();
    event.stopPropagation();
    this.openProjectInNewTab(project);
    return false;
  }

  onProjectReportsContextMenu(event: MouseEvent, project: DashboardProject, reportType: 'new' | 'ongoing' | 'completed'): boolean {
    event.preventDefault();
    event.stopPropagation();
    this.openProjectReportsInNewTab(project, reportType);
    return false;
  }
}
