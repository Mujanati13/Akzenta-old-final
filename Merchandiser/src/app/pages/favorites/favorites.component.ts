import { Component, OnInit, OnDestroy, ViewEncapsulation } from '@angular/core';
import { Location } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
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
import { takeUntil } from 'rxjs/operators';

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
  clientCompany: {
    id: number;
    name: string;
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

  private destroy$ = new Subject<void>();

  constructor(
    private router: Router,
    private favoritesService: FavoritesService,
    private projectService: ProjectService,
    private reportService: ReportService,
    private favoritesStateService: FavoritesStateService,
    private toast: HotToastService,
    private location: Location,
  ) {}

  goBack(): void {
    this.location.back();
  }

  ngOnInit() {
    // Try to restore from cache first
    const cachedData = this.favoritesStateService.getFavoritesDataSnapshot();
    if (cachedData && this.favoritesStateService.isCacheValid()) {
      console.log('✅ Restoring favorites data from cache');
      this.favoriteProjects = cachedData.favoriteProjects || [];
      this.favoriteReports = cachedData.favoriteReports || [];
      this.missions = (cachedData.favoriteReports || []).map((report) => this.transformReportToMission(report));
      this.loading = false;

      // Load fresh data in background (without showing loader)
      this.loadFavorites({ showLoader: false });
    } else {
      // No valid cache, load from server with loader
      console.log('🔄 No cache found, loading favorites from server');
      this.loadFavorites({ showLoader: true });
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
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
            console.log('🔄 Raw favorites data:', data);

            // Transform favorite projects
            this.favoriteProjects = (data.favoriteProjects || []).map((project) => {
              console.log('🔄 Transforming project:', project);
              return this.transformProject(project);
            });
            console.log('🔄 Transformed projects:', this.favoriteProjects);
            // Store favorite reports directly (no transformation needed)
            this.favoriteReports = data.favoriteReports || [];
            // Also keep missions for backward compatibility if needed
            this.missions = (data.favoriteReports || []).map((report) => {
              console.log('🔄 Transforming report:', report);
              return this.transformReportToMission(report);
            });

            // Save to store
            this.favoritesStateService.setFavoritesData({
              favoriteProjects: this.favoriteProjects,
              favoriteReports: this.favoriteReports,
            });

            console.log('✅ Favorites data loaded:', {
              projectsCount: this.favoriteProjects.length,
              reportsCount: this.favoriteReports.length,
              missionsCount: this.missions.length,
            });
          }
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

    // Use real report counts from API data with fallbacks
    console.log('📊 Project reportCounts:', project.reportCounts);
    const stats = {
      new: project.reportCounts?.newReports || 0,
      open: project.reportCounts?.ongoingReports || 0,
      completed: project.reportCounts?.completedReports || 0,
    };
    console.log('📊 Computed stats:', stats);

    return {
      id: project.id,
      isFavorite: true, // All projects in favorites are favorite
      name: project.name,
      slug,
      dateRange,
      weekNumber,
      status,
      stats,
      clientCompany: project.clientCompany,
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
    console.log('🔄 FavoritesComponent: Toggling favorite status:', { id: item.id, newStatus });

    const previousStatus = item.isFavorite;
    item.isFavorite = newStatus;

    // Determine if it's a project or report and call appropriate service
    const isProject = 'stats' in item; // ProjectItem has stats property

    if (isProject) {
      // Handle project favorite toggle
      this.projectService.toggleFavoriteStatus(item.id.toString()).subscribe({
        next: (updatedProject) => {
          console.log('✅ FavoritesComponent: Project favorite status updated:', updatedProject);
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
          console.log('✅ FavoritesComponent: Report favorite status updated:', updatedReport);
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
    console.log('🔄 FavoritesComponent: Toggling report favorite status:', { id: report.id, newStatus });

    // Optimistically update the UI
    const previousStatus = true; // Reports in favorites are always favorite initially
    const reportIndex = this.favoriteReports.findIndex((r) => r.id === report.id);

    // Handle report favorite toggle
    this.reportService.toggleFavoriteStatus(report.id).subscribe({
      next: (updatedReport) => {
        console.log('✅ FavoritesComponent: Report favorite status updated:', updatedReport);
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
  navigateToProject(project: ProjectItem): void {
    // Navigate to projects module route for merchandiser app
    this.router.navigate(['/projects', project.id]);
  }

  /**
   * Navigate to mission report details
   */
  navigateToMissionReport(mission: MissionItem): void {
    // Navigate to the report detail page using the simplified route structure
    this.router.navigate(['/projects', mission.projectId, 'reports', mission.reportId]);
  }
}
