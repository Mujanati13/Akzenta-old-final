import { Component, OnInit, ElementRef, ViewChild, HostListener, Output, EventEmitter } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { environment } from '@env/environment';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { filter } from 'rxjs/operators';
import { NavMode, ShellService } from '@app/shell/services/shell.service';
import { CredentialsService } from '@auth';
import { NavMenuItem } from '@core/interfaces';
import { NavigationService } from '@core/services/navigation.service';
import { FilterResetService } from '@core/services/filter-reset.service';
import { Store } from '@ngrx/store';
import * as AuthSelectors from '@app/@core/store/auth/auth.selectors';
import * as AppDataSelectors from '@app/@core/store/app-data/app-data.selectors';

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
    private filterResetService: FilterResetService,
    private store: Store,
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

    // Subscribe to dynamic menu items from navigation service
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

  onNavItemClick(): void {
    this.navigationService.refreshNotificationCount();
    this.closeSidebar.emit();
  }

  resetFilters(): void {
    this.filterResetService.reset();
  }

  activateSidebarSubItem(index: number, subItem: NavMenuItem): void {
    this.shellService.activateNavSubItem(index, subItem, this.sidebarItems);
  }

  navigateToDashboard(event: Event): void {
    event.preventDefault();
    this._router.navigate(['/dashboard']);
  }
}
