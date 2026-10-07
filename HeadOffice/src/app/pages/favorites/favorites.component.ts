import { Component, OnInit, OnDestroy, AfterViewInit, Renderer2 } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { RouterModule, Router } from '@angular/router';
import { ImportsModule } from '@app/shared/imports';
import { AppIconComponent } from '../../shared/app-icon.component';
import { FavoriteToggleComponent } from '../../shared/components/favorite-toggle/favorite-toggle.component';
import { FavoritesService, FavoriteReport, FavoriteProject } from '@app/core/services/favorites.service';
import { FavoritesStateService, FavoriteClientCompanyWithCounts } from './favorites-state.service';
import { HotToastService } from '@ngxpert/hot-toast';
import { catchError, of } from 'rxjs';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-favorites',
  imports: [TranslateModule, RouterModule, ImportsModule, AppIconComponent, FavoriteToggleComponent],
  templateUrl: './favorites.component.html',
  styleUrl: './favorites.component.scss',
})
export class FavoritesComponent implements OnInit, OnDestroy, AfterViewInit {
  favoriteClientCompanies: FavoriteClientCompanyWithCounts[] = [];
  favoriteReports: FavoriteReport[] = [];
  favoriteProjects: FavoriteProject[] = [];
  loading = true;
  error = false;
  myClientIds: Set<number> = new Set(); // Store IDs of "my clients"

  private destroy$ = new Subject<void>();
  private scrollListener: (() => void) | null = null;
  private scrollPosition = 0;

  constructor(
    private favoritesService: FavoritesService,
    private favoritesStateService: FavoritesStateService,
    private toast: HotToastService,
    private router: Router,
    private renderer: Renderer2,
  ) {}

  ngOnInit(): void {
    // Try to restore from cache first
    const cachedData = this.favoritesStateService.getFavoritesDataSnapshot();
    if (cachedData) {
      this.scrollPosition = cachedData.scrollPosition || 0;
    }

    if (
      cachedData &&
      this.favoritesStateService.isCacheValid() &&
      ((cachedData.favoriteClientCompanies?.length || 0) > 0 || (cachedData.favoriteReports?.length || 0) > 0 || (cachedData.favoriteProjects?.length || 0) > 0)
    ) {
      this.favoriteClientCompanies = cachedData.favoriteClientCompanies || [];
      const myIds = this.favoriteClientCompanies.filter((client) => client?.isMyClient === true).map((client) => client.id);
      this.myClientIds = new Set(myIds);
      this.favoriteReports = cachedData.favoriteReports || [];
      this.favoriteProjects = cachedData.favoriteProjects || [];
      this.loading = false;

      // Load fresh data in background (without showing loader)
      this.loadFavorites({ showLoader: false });
    } else {
      // No valid cache, load from server with loader
      this.loadFavorites({ showLoader: true });
    }
  }

  ngAfterViewInit() {
    this.restoreScrollPosition();

    this.scrollListener = this.renderer.listen('window', 'scroll', () => {
      this.scrollPosition = window.scrollY || document.documentElement.scrollTop;
    });
  }

  ngOnDestroy(): void {
    if (this.scrollListener) {
      this.scrollListener();
    }
    this.saveCurrentState();
    this.destroy$.next();
    this.destroy$.complete();
  }

  private saveCurrentState() {
    this.favoritesStateService.saveState({
      favoriteClientCompanies: this.favoriteClientCompanies,
      favoriteReports: this.favoriteReports,
      favoriteProjects: this.favoriteProjects,
      scrollPosition: this.scrollPosition,
    });
  }

  private restoreScrollPosition(): void {
    if (this.scrollPosition > 0) {
      setTimeout(() => {
        window.scrollTo(0, this.scrollPosition);
      }, 100);
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
            // Transform client companies to include report counts and isMyClient flag
            const transformedData = {
              favoriteClientCompanies: (data.favoriteClientCompanies || []).map((client) => ({
                ...client,
                reportCounts: (client as any).reportCounts,
                isMyClient: (client as any).isMyClient || false,
              })),
              favoriteReports: data.favoriteReports || [],
              favoriteProjects: data.favoriteProjects || [],
            };

            // Update component state
            this.favoriteClientCompanies = transformedData.favoriteClientCompanies;
            // Extract myClientIds from the response
            const myIds = this.favoriteClientCompanies.filter((client) => client?.isMyClient === true).map((client) => client.id);
            this.myClientIds = new Set(myIds);
            this.favoriteReports = transformedData.favoriteReports;
            this.favoriteProjects = transformedData.favoriteProjects;

            // Save to store
            this.saveCurrentState();
            this.restoreScrollPosition();
          }
          this.loading = false;
        },
        error: () => {
          this.loading = false;
        },
      });
  }

  onFavoriteChanged(newStatus: boolean, item: any, type: 'client' | 'report' | 'project'): void {
    // If removing from favorites, we need to remove from the list
    if (!newStatus) {
      // Call the appropriate service method based on type
      if (type === 'client') {
        this.favoritesService.toggleClientCompanyFavorite(item.id).subscribe({
          next: (response) => {
            this.toast.success(response.message || 'Kunde aus Favoriten entfernt', {
              position: 'bottom-right',
              duration: 2000,
            });
            // Remove the client from the list
            this.favoriteClientCompanies = this.favoriteClientCompanies.filter((c) => c.id !== item.id);
            // Save updated state
            this.saveCurrentState();
          },
          error: (error) => {
            console.error('❌ Error toggling client company favorite:', error);
            this.toast.error('Fehler beim Aktualisieren der Favoriten', {
              position: 'bottom-right',
              duration: 4000,
            });
          },
        });
      } else if (type === 'report') {
        this.favoritesService.toggleReportFavorite(item.id).subscribe({
          next: (response) => {
            this.toast.success(response.message || 'Einsatz aus Favoriten entfernt', {
              position: 'bottom-right',
              duration: 2000,
            });
            // Remove the report from the list
            this.favoriteReports = this.favoriteReports.filter((r) => r.id !== item.id);
            // Save updated state
            this.saveCurrentState();
          },
          error: (error) => {
            console.error('❌ Error toggling mission favorite:', error);
            this.toast.error('Fehler beim Aktualisieren der Favoriten', {
              position: 'bottom-right',
              duration: 4000,
            });
          },
        });
      } else if (type === 'project') {
        this.favoritesService.toggleProjectFavorite(item.id).subscribe({
          next: (response) => {
            this.toast.success(response.message || 'Projekt aus Favoriten entfernt', {
              position: 'bottom-right',
              duration: 2000,
            });
            // Remove the project from the list
            this.favoriteProjects = this.favoriteProjects.filter((p) => p.id !== item.id);
            // Save updated state
            this.saveCurrentState();
          },
          error: (error) => {
            console.error('❌ Error toggling project favorite:', error);
            this.toast.error('Fehler beim Aktualisieren der Favoriten', {
              position: 'bottom-right',
              duration: 4000,
            });
          },
        });
      }
    }
  }

  // Helper method to get branch label with number
  getBranchLabel(report: FavoriteReport): string {
    if (!report.branch) {
      return 'Keine Filiale';
    }

    const branchNumber = (report.branch as any)?.branchNumber?.toString().trim() || '';
    const branchName = report.branch.name?.trim() || '';

    if (branchNumber && branchName) {
      return `#${branchNumber}  ${branchName}`;
    }

    return branchNumber || branchName || 'Unbekannte Filiale';
  }

  // Helper method to get report address
  getReportAddress(report: FavoriteReport): string {
    const parts: string[] = [];
    if (report.street) parts.push(report.street);
    if (report.zipCode) parts.push(report.zipCode);
    if (report.branch?.client?.name) parts.push(report.branch.client.name);
    return parts.length > 0 ? parts.join(', ') : '';
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

  isMyClient(clientId: number): boolean {
    return this.myClientIds.has(clientId);
  }

  // Helper method to get animation delay for client cards
  getClientCardAnimationDelay(index: number): string {
    return `${index * 0.05}s`;
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

  // Navigate to report detail
  navigateToReport(report: FavoriteReport, newTab: boolean = false): void {
    if (!report.clientCompany?.id || !report.project?.id || !report.id) {
      return;
    }

    const queryParams = {
      reportStatus: report.status?.name || '',
      referrer: 'favorites',
    };

    if (newTab) {
      const urlTree = this.router.createUrlTree(['/clients', report.clientCompany.id, 'projects', report.project.id, 'reports', report.id], { queryParams });
      const url = window.location.origin + urlTree.toString();
      window.open(url, '_blank');
    } else {
      this.router.navigate(['/clients', report.clientCompany.id, 'projects', report.project.id, 'reports', report.id], {
        queryParams,
      });
    }
  }

  openClientInNewTab(clientId: number, queryParams?: Record<string, any>): void {
    const urlTree = this.router.createUrlTree(['/clients', clientId], { queryParams: queryParams || {} });
    const url = window.location.origin + urlTree.toString();
    window.open(url, '_blank');
  }

  onReportContextMenu(event: MouseEvent, report: FavoriteReport): boolean {
    event.preventDefault();
    event.stopPropagation();
    this.navigateToReport(report, true);
    return false;
  }

  onClientContextMenu(event: MouseEvent, clientId: number, queryParams?: Record<string, any>): boolean {
    event.preventDefault();
    event.stopPropagation();
    this.openClientInNewTab(clientId, queryParams);
    return false;
  }

  // Navigate to project detail
  navigateToProject(project: FavoriteProject, newTab: boolean = false): void {
    if (!project.clientCompany?.id || !project.id) {
      return;
    }

    const queryParams = {
      referrer: 'favorites',
    };

    if (newTab) {
      const urlTree = this.router.createUrlTree(['/clients', project.clientCompany.id, 'projects', project.id], { queryParams });
      const url = window.location.origin + urlTree.toString();
      window.open(url, '_blank');
    } else {
      this.router.navigate(['/clients', project.clientCompany.id, 'projects', project.id], {
        queryParams,
      });
    }
  }

  onProjectContextMenu(event: MouseEvent, project: FavoriteProject): boolean {
    event.preventDefault();
    event.stopPropagation();
    this.navigateToProject(project, true);
    return false;
  }

  // Helper method to format project period
  getProjectPeriod(project: FavoriteProject): string {
    if (!project.startDate || !project.endDate) {
      return '';
    }
    const startDate = new Date(project.startDate);
    const endDate = new Date(project.endDate);

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

    return `${startDateFormatted} bis ${endDateFormatted}`;
  }

  // Helper method to get week number
  private getWeekNumber(date: Date): number {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  }
}
