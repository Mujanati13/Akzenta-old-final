import { Component, OnInit, OnDestroy, ViewEncapsulation } from '@angular/core';
import { Router } from '@angular/router';
import { Location } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { ImportsModule } from '@app/shared/imports';
import { AppIconComponent } from '../../shared/app-icon.component';
import { FavoriteToggleComponent } from '../../shared/components/favorite-toggle/favorite-toggle.component';
import { FavoritesService, FavoriteReport, FavoriteProject } from '@app/@core/services/favorites.service';
import { ProjectService } from '@app/@core/services/project.service';
import { ReportService } from '@app/@core/services/report.service';
import { FavoritesStateService } from './favorites-state.service';
import { HotToastService } from '@ngneat/hot-toast';
import { catchError, of } from 'rxjs';
import { Subject } from 'rxjs';
import { distinctUntilChanged, skip, takeUntil } from 'rxjs/operators';
import { RouterModule } from '@angular/router';
import { InitializerService } from '@app/core/services/initializer.service';
interface CardItem {
  id: number; // Or string
  isFavorite: boolean;
  name: string; // Example property
  city: string; // Example property
  image: string; // Example property
  // ... other properties
}

interface ProjectItem {
  id: number;
  isFavorite: boolean;
  name: string;
  slug?: string;
  dateRange: string;
  weekNumber: string;
  status: 'running' | 'completed';
  stats: {
    new: number;
    open: number;
    completed: number;
  };
}

interface MissionItem {
  id: number;
  isFavorite: boolean;
  season: string;
  period: string;
  projectId: number;
  reportId: number;
}

@Component({
  selector: 'app-favorites',
  imports: [TranslateModule, ImportsModule, AppIconComponent, FavoriteToggleComponent, RouterModule],
  templateUrl: './favorites.component.html',
  styleUrl: './favorites.component.scss',
  encapsulation: ViewEncapsulation.None,
})
export class FavoritesComponent implements OnInit, OnDestroy {
  // API data
  favoriteProjects: ProjectItem[] = [];
  favoriteReports: FavoriteReport[] = [];
  missions: MissionItem[] = [];

  // Loading and error states
  loading = true;
  error = false;

  // Check if can go back (has navigation history)
  canGoBack: boolean = false;

  private destroy$ = new Subject<void>();

  constructor(
    private router: Router,
    private favoritesService: FavoritesService,
    private projectService: ProjectService,
    private reportService: ReportService,
    private favoritesStateService: FavoritesStateService,
    private toast: HotToastService,
    private location: Location,
    private initializerService: InitializerService,
  ) {
    // Check if we have navigation history
    const navigation = this.router.getCurrentNavigation();
    this.canGoBack = !!navigation?.previousNavigation;
  }

  ngOnInit() {
    // Try to restore from cache first
    const cachedData = this.favoritesStateService.getFavoritesDataSnapshot();
    if (cachedData && this.favoritesStateService.isCacheValid()) {
      this.favoriteProjects = cachedData.favoriteProjects || [];
      this.favoriteReports = cachedData.favoriteReports || [];
      this.missions = (this.favoriteReports || []).map((report) => this.transformReportToMission(report));
      this.loading = false;

      // Load fresh data in background (without showing loader)
      this.loadFavorites({ showLoader: false });
    } else {
      // No valid cache, load from server with loader
      this.loadFavorites({ showLoader: true });
    }

    this.initializerService.currentClientCompany$
      .pipe(
        distinctUntilChanged((previous, current) => previous?.id === current?.id),
        skip(1),
        takeUntil(this.destroy$),
      )
      .subscribe(() => {
        this.favoritesStateService.clearCache();
        this.loadFavorites({ showLoader: true });
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

  loadFavorites(options: { showLoader: boolean } = { showLoader: true }): void {
    if (options.showLoader) {
      this.loading = true;
    }
    this.error = false;

    this.favoritesService
      .getFavorites()
      .pipe(
        takeUntil(this.destroy$),
        catchError((error) => {
          console.error('Error loading favorites:', error);
          this.error = true;
          if (options.showLoader) {
            this.toast.error('Fehler beim Laden der Favoriten', {
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
            const currentCompany = this.initializerService.getCurrentClientCompany();
            const visibleProjectIds = new Set(this.initializerService.getAssignedProjects().map((project) => Number(project.id)));

            // Transform favorite projects
            const transformedProjects = (data.favoriteProjects || []).filter((project) => !currentCompany || visibleProjectIds.has(project.id)).map((project) => this.transformProject(project));

            // Store favorite reports directly (no transformation needed)
            const reports = (data.favoriteReports || []).filter((report) => !currentCompany || report.clientCompany?.id === currentCompany.id);

            // Update component state
            this.favoriteProjects = transformedProjects;
            this.favoriteReports = reports;
            // Also keep missions for backward compatibility if needed
            this.missions = reports.map((report) => this.transformReportToMission(report));

            // Save to store
            this.favoritesStateService.setFavoritesData(transformedProjects, reports);
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
  private transformProject(project: FavoriteProject): ProjectItem {
    const startDate = new Date(project.startDate);
    const endDate = new Date(project.endDate);
    const today = new Date();

    // Determine status based on dates
    let status: 'running' | 'completed' = 'running';
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
      id: project.id,
      isFavorite: true, // All projects in favorites are favorite
      name: project.name,
      slug,
      dateRange,
      weekNumber,
      status,
      stats,
    };
  }

  /**
   * Transform favorite report to mission item
   */
  private transformReportToMission(report: FavoriteReport): MissionItem {
    const startDate = new Date(report.project.startDate);
    const endDate = new Date(report.project.endDate);

    // Generate period string
    const period = `KW ${this.getWeekNumber(startDate)}  ${startDate.getDate().toString().padStart(2, '0')}.${(startDate.getMonth() + 1).toString().padStart(2, '0')}. bis ${endDate.getDate().toString().padStart(2, '0')}.${(endDate.getMonth() + 1).toString().padStart(2, '0')}.${endDate.getFullYear()}`;

    return {
      id: report.id,
      isFavorite: true, // All reports in favorites are favorite
      season: report.project.name,
      period,
      projectId: report.project.id,
      reportId: report.id,
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

  getBranchLabel(report: FavoriteReport): string {
    if (!report.branch) {
      return 'Keine Filiale';
    }

    const branchNumber = (report.branch as any)?.branchNumber?.toString().trim() || '';
    const branchName = report.branch.name?.trim() || '';

    if (branchNumber && branchName) {
      return `${branchNumber} # ${branchName}`;
    }

    return branchNumber || branchName || 'Unbekannte Filiale';
  }

  // Helper method to format planned date
  getPlannedDate(report: FavoriteReport): string {
    if (!report.plannedOn) return '';
    const date = new Date(report.plannedOn);
    return date.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  // Helper method to format report period
  getReportPeriod(report: FavoriteReport): string {
    const startDate = new Date(report.project.startDate);
    const endDate = new Date(report.project.endDate);

    // Get the week number
    const weekNumber = this.getWeekNumber(startDate);

    // Format dates in German format (dd.MM.yyyy)
    const startDateFormatted = startDate.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

    const endDateFormatted = endDate.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

    return `KW ${weekNumber} ${startDateFormatted} bis ${endDateFormatted}`;
  }

  onFavoriteChanged(newStatus: boolean, item: ProjectItem | MissionItem): void {
    const previousStatus = item.isFavorite;
    item.isFavorite = newStatus;

    // Determine if it's a project or report and call appropriate service
    const isProject = 'stats' in item; // ProjectItem has stats property

    if (isProject) {
      // Handle project favorite toggle
      this.projectService.toggleFavoriteStatus(item.id.toString()).subscribe({
        next: (updatedProject) => {
          item.isFavorite = updatedProject.isFavorite;
        },
        error: (err) => {
          console.error('❌ FavoritesComponent: Error updating project favorite status:', err);
          item.isFavorite = previousStatus; // Revert on error
        },
      });
    } else {
      // Handle report favorite toggle
      this.reportService.toggleFavoriteStatus(item.id).subscribe({
        next: (updatedReport) => {
          item.isFavorite = updatedReport.isFavorite;
        },
        error: (err) => {
          console.error('❌ FavoritesComponent: Error updating report favorite status:', err);
          item.isFavorite = previousStatus; // Revert on error
        },
      });
    }
  }

  onFavoriteReportChanged(newStatus: boolean, report: FavoriteReport): void {
    // Optimistically update the UI
    const previousStatus = true; // Reports in favorites are always favorite initially
    const reportIndex = this.favoriteReports.findIndex((r) => r.id === report.id);

    // Handle report favorite toggle
    this.reportService.toggleFavoriteStatus(report.id).subscribe({
      next: (updatedReport) => {
        if (!updatedReport.isFavorite && reportIndex !== -1) {
          // Remove from favorites if unfavorited
          this.favoriteReports.splice(reportIndex, 1);
        }
      },
      error: (err) => {
        console.error('❌ FavoritesComponent: Error updating report favorite status:', err);
        this.toast.error('Fehler beim Aktualisieren des Favoritenstatus', {
          position: 'bottom-right',
          duration: 4000,
        });
      },
    });
  }

  /**
   * Navigate to project detail without any filters
   */
  navigateToProject(project: ProjectItem, newTab: boolean = false): void {
    if (newTab) {
      const urlTree = this.router.createUrlTree(['/projects', project.id]);
      const url = window.location.origin + urlTree.toString();
      window.open(url, '_blank');
    } else {
      this.router.navigate(['/projects', project.id]);
    }
  }

  /**
   * Navigate to mission report details
   */
  navigateToMissionReport(mission: MissionItem, newTab: boolean = false): void {
    if (newTab) {
      const urlTree = this.router.createUrlTree(['/projects', mission.projectId, 'reports', mission.reportId]);
      const url = window.location.origin + urlTree.toString();
      window.open(url, '_blank');
    } else {
      this.router.navigate(['/projects', mission.projectId, 'reports', mission.reportId]);
    }
  }

  openProjectInNewTab(project: ProjectItem): void {
    this.navigateToProject(project, true);
  }

  openMissionReportInNewTab(mission: MissionItem): void {
    this.navigateToMissionReport(mission, true);
  }

  onProjectContextMenu(event: MouseEvent, project: ProjectItem): boolean {
    event.preventDefault();
    event.stopPropagation();
    this.openProjectInNewTab(project);
    return false;
  }

  onMissionReportContextMenu(event: MouseEvent, mission: MissionItem): boolean {
    event.preventDefault();
    event.stopPropagation();
    this.openMissionReportInNewTab(mission);
    return false;
  }

  navigateToProjectReports(project: ProjectItem, reportType: 'new' | 'ongoing' | 'completed', newTab: boolean = false): void {
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

  onProjectReportsContextMenu(event: MouseEvent, project: ProjectItem, reportType: 'new' | 'ongoing' | 'completed'): boolean {
    event.preventDefault();
    event.stopPropagation();
    this.navigateToProjectReports(project, reportType, true);
    return false;
  }
}
