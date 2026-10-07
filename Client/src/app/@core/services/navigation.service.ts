import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, combineLatest, interval } from 'rxjs';
import { NavMenuItem } from '@core/interfaces';
import { webSidebarMenuItems } from '@core/constants/nav-menu-items';
import { Router, NavigationEnd } from '@angular/router';
import { filter, debounceTime, startWith, switchMap, catchError } from 'rxjs/operators';
import { InitializerService, AssignedProject } from '@app/core/services/initializer.service';
import { NotificationsService } from '@app/core/services/notifications.service';
import { Store } from '@ngrx/store';
import * as AppDataSelectors from '@app/@core/store/app-data/app-data.selectors';
import { of } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class NavigationService {
  private menuItemsSubject = new BehaviorSubject<NavMenuItem[]>([]);
  private notificationCountSubject = new BehaviorSubject<number>(0);

  constructor(
    private initializerService: InitializerService,
    private router: Router,
    private store: Store,
    private notificationsService: NotificationsService,
  ) {
    this.initializeMenu();
    this.setupRouteListener();
    this.startNotificationPolling();
  }

  private setupRouteListener(): void {
    // Listen for route changes to detect project selection
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        debounceTime(100), // Small debounce to avoid rapid updates
      )
      .subscribe((event: NavigationEnd) => {
        const url = event.urlAfterRedirects;
        const projectMatch = url.match(/\/projects\/([^\/]+)/);

        if (projectMatch && projectMatch[1]) {
          const projectId = projectMatch[1];
        }
      });
  }

  private startNotificationPolling(): void {
    // Initial load to get the unseen count
    this.notificationsService
      .getMyUnseen()
      .pipe(
        catchError((error) => {
          console.error('Error fetching initial notifications:', error);
          return of([]);
        }),
      )
      .subscribe((notifications) => {
        const count = notifications.length;
        this.notificationCountSubject.next(count);
        this.updateMenuItems();
      });
  }

  private updateMenuItems(): void {
    // Trigger menu update when notification count changes
    const currentItems = this.menuItemsSubject.value;
    if (currentItems.length > 0) {
      this.menuItemsSubject.next([...currentItems]);
    }
  }

  private initializeMenu(): void {
    // Subscribe to assigned projects from the store and notification count
    combineLatest([this.store.select(AppDataSelectors.selectAssignedProjects), this.initializerService.currentClientCompany$, this.notificationCountSubject]).subscribe(
      ([assignedProjects, _currentClientCompany, notificationCount]) => {
        // Create deep copy of static menu items
        const menuItems = JSON.parse(JSON.stringify(webSidebarMenuItems));

        // Find the projects menu item
        const projectsMenuItem = menuItems.find((item) => item.href === '/projects');

        if (projectsMenuItem && assignedProjects.length > 0) {
          // Update the projects menu item with assigned projects as subitems
          projectsMenuItem.subItems = assignedProjects.map((project) => ({
            href: `/projects/${project.id}`,
            title: project.name,
            active: false,
          }));

          // Check if we're currently on a project route and update active state
          const currentPath = window.location.pathname;
          const currentProjectId = currentPath.match(/\/projects\/([^\/]+)/)?.[1];

          if (currentProjectId) {
            const projectSubItem = projectsMenuItem.subItems.find((subItem) => subItem.href === `/projects/${currentProjectId}`);
            if (projectSubItem) {
              projectSubItem.active = true;
            }
          }
        }

        // Update notification count tag
        const notificationsMenuItem = menuItems.find((item) => item.href === '/notifications');
        if (notificationsMenuItem) {
          notificationsMenuItem.tag = notificationCount > 0 ? notificationCount : false;
        }

        this.menuItemsSubject.next(menuItems);
      },
    );
  }

  getMenuItems(): Observable<NavMenuItem[]> {
    return this.menuItemsSubject.asObservable();
  }

  // Method to update notification count directly without backend call
  updateNotificationCount(count: number): void {
    this.notificationCountSubject.next(count);
    this.updateMenuItems();
  }

  refreshNotificationCount(): void {
    this.notificationsService
      .getMyUnseen()
      .pipe(
        catchError((error) => {
          console.error('Error fetching notifications:', error);
          return of([]);
        }),
      )
      .subscribe((notifications) => {
        const count = notifications.length;
        this.notificationCountSubject.next(count);
        this.updateMenuItems();
      });
  }
}
