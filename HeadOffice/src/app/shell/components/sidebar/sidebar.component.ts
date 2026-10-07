import { Component, OnInit, ElementRef, ViewChild, HostListener, Output, EventEmitter } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { environment } from '@env/environment';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { filter } from 'rxjs/operators';
import { NavMode, ShellService } from '@app/shell/services/shell.service';
import { CredentialsService } from '@auth';
import { NavMenuItem } from '@core/interfaces';
import { NavigationService } from '@core/services/navigation.service';
import { Store } from '@ngrx/store';
import * as AuthSelectors from '@app/@core/store/auth/auth.selectors';
import * as AppDataSelectors from '@app/@core/store/app-data/app-data.selectors';
import { ClientDetailStateService } from '@app/pages/clients/client-detail/client-detail-state.service';
import { UsersListStateService } from '@app/pages/users/list/users-list-state.service';
import { ClientsStateService } from '@app/pages/clients/list/clients-state.service';
import { StaffStateService } from '@app/pages/staff/list/staff-state.service';
import { FavoritesStateService } from '@app/pages/favorites/favorites-state.service';
import { NotificationsStateService } from '@app/pages/notifications/notifications-state.service';
import { DashboardStateService } from '@app/core/services/dashboard-state.service';

@UntilDestroy({ checkProperties: true })
@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss'],
  standalone: false,
})
export class SidebarComponent implements OnInit {
  @Output() closeSidebar = new EventEmitter<void>();

  version: string = environment.version;
  year: number = new Date().getFullYear();
  sidebarItems: NavMenuItem[] = [];
  sidebarExtendedItem = -1;
  navExpanded = true;
  isProfileMenuOpen = false;
  userName = 'User';

  @ViewChild('profileButton') profileButton: ElementRef;
  @ViewChild('profileMenu') profileMenu: ElementRef;

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    // Check if click is outside of profile menu and profile button
    if (this.isProfileMenuOpen) {
      const profileButtonEl = this.profileButton?.nativeElement;
      const profileMenuEl = this.profileMenu?.nativeElement;

      if (profileButtonEl && profileMenuEl) {
        if (!profileButtonEl.contains(event.target) && !profileMenuEl.contains(event.target)) {
          this.closeProfileMenu();
        }
      }
    }
  }

  constructor(
    private readonly _router: Router,
    private readonly _credentialsService: CredentialsService,
    public shellService: ShellService,
    private navigationService: NavigationService,
    private store: Store,
    // Injected to ensure it initializes and monitors navigation for state clearing
    private clientDetailStateService: ClientDetailStateService,
    private usersListStateService: UsersListStateService,
    private clientsStateService: ClientsStateService,
    private staffStateService: StaffStateService,
    private favoritesStateService: FavoritesStateService,
    private notificationsStateService: NotificationsStateService,
    private dashboardStateService: DashboardStateService,
  ) {}

  ngOnInit(): void {
    // Get user name from store for display
    // First try app data store (which has more complete info)
    this.store
      .select(AppDataSelectors.selectUserDisplayName)
      .pipe(untilDestroyed(this))
      .subscribe((name) => {
        if (name !== 'User') {
          this.userName = name;
        } else {
          // Fallback to auth store if not available in app data
          this.store
            .select(AuthSelectors.selectUserDisplayName)
            .pipe(untilDestroyed(this))
            .subscribe((authName) => {
              this.userName = authName;
            });
        }
      });

    // Subscribe to dynamic menu items
    this.navigationService
      .getMenuItems()
      .pipe(untilDestroyed(this))
      .subscribe((items) => {
        this.sidebarItems = items;
        this.shellService.activeNavTab(this.sidebarItems, this.sidebarExtendedItem);
      });

    this._router.events
      .pipe(untilDestroyed(this))
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => {
        this.shellService.activeNavTab(this.sidebarItems, this.sidebarExtendedItem);
      });

    // Also update sidebar when expandedRows changes (e.g., project expanded/collapsed)
    this.clientDetailStateService.expandedRowsChange$.pipe(untilDestroyed(this)).subscribe((change) => {
      if (change) {
        // Check if we're currently on this client's detail page or related routes
        const currentMatch = this._router.url.match(/\/clients\/(\d+)/);
        const currentClientId = currentMatch ? Number(currentMatch[1]) : null;
        if (currentClientId === change.clientId) {
          // Update sidebar active state
          this.shellService.activeNavTab(this.sidebarItems, this.sidebarExtendedItem);
        }
      }
    });

    this.shellService.navMode$.pipe(untilDestroyed(this)).subscribe((mode) => {
      this.navExpanded = mode === NavMode.Free;
    });
  }

  toggleSidebar(isEnterEvent: boolean): void {
    this.shellService.navMode$.pipe(untilDestroyed(this)).subscribe((mode) => {
      if (isEnterEvent) {
        this.navExpanded = true;
      } else if (!isEnterEvent && mode === NavMode.Free) {
        this.navExpanded = false;
      }
    });
  }

  toggleProfileMenu(): void {
    this.isProfileMenuOpen = !this.isProfileMenuOpen;
  }

  closeProfileMenu(): void {
    this.isProfileMenuOpen = false;
  }

  onNavItemClick(item: NavMenuItem): void {
    // Refresh notification count on any navigation
    this.navigationService.refreshNotificationCount();

    // If we are on a client detail page with a project expanded, ensure it collapses before switching
    if (item?.href === '/projects') {
      const match = this._router.url.match(/\/clients\/(\d+)/);
      const clientId = match ? Number(match[1]) : null;
      if (clientId && !isNaN(clientId)) {
        // Avoid persisting current expanded state when jumping away
        this.clientDetailStateService.preventSave = true;
        this.clientDetailStateService.requestReset(clientId);
      }
    }

    // Clear filters based on the clicked item
    switch (item?.href) {
      case '/users':
        this.usersListStateService.clearViewState();
        break;
      case '/clients':
        this.clientsStateService.clearState();
        break;
      case '/staff':
        this.staffStateService.clearCache();
        break;
      case '/filiale-suchen':
        // Keep filiale-suchen view state (column filters, settings, scroll) on navigation.
        break;
      case '/favorites':
        this.favoritesStateService.clearCache();
        break;
      case '/notifications':
        this.notificationsStateService.clearCache();
        break;
      case '/dashboard':
        // Keep dashboard view state (filters + scroll) so returning from report detail/edit
        // restores the previous dashboard context.
        break;
    }
  }

  activateSidebarSubItem(index: number, subItem: NavMenuItem): void {
    // Check if this is a client link and clear state if needed
    if (subItem.href && subItem.href.startsWith('/clients/')) {
      const parts = subItem.href.split('/');
      // href is usually /clients/123
      if (parts.length === 3) {
        const targetClientId = Number(parts[2]);
        if (!isNaN(targetClientId)) {
          // Get current client ID from URL
          const currentMatch = this._router.url.match(/\/clients\/(\d+)/);
          const currentClientId = currentMatch ? Number(currentMatch[1]) : null;

          // If navigating to the same client, prevent saving the current state
          // so that the resetViewState takes effect and resets the view
          if (currentClientId === targetClientId) {
            this.clientDetailStateService.preventSave = true;
            this.clientDetailStateService.requestReset(targetClientId);
          }

          // Instead of clearing the entire state (which removes data),
          // we only reset the view state (filters, expansion) but keep the data.
          this.clientDetailStateService.resetViewState(targetClientId);
        }
      }
    }

    this.shellService.activateNavSubItem(index, subItem, this.sidebarItems);
  }

  navigateToDashboard(event: Event): void {
    event.preventDefault();
    this._router.navigate(['/dashboard']);
  }
}
