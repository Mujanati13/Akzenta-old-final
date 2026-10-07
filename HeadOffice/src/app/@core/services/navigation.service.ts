import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, combineLatest } from 'rxjs';
import { NavMenuItem } from '@core/interfaces';
import { Client, ClientService, Project } from './client.service';
import { webSidebarMenuItems } from '@core/constants/nav-menu-items';
import { Router, NavigationEnd } from '@angular/router';
import { filter, debounceTime, startWith, catchError } from 'rxjs/operators';
import { NotificationsService } from '../../core/services/notifications.service';
import { of } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class NavigationService {
  private menuItemsSubject = new BehaviorSubject<NavMenuItem[]>([]);
  private notificationCountSubject = new BehaviorSubject<number>(0);
  private readonly notificationRefreshCooldownMs = 30000;
  private lastNotificationRefreshAt = 0;
  private isRefreshingNotificationCount = false;

  constructor(
    private clientService: ClientService,
    private router: Router,
    private notificationsService: NotificationsService,
  ) {
    this.initializeMenu();
    this.setupRouteListener();
    this.startNotificationPolling();
  }

  private setupRouteListener(): void {
    // Listen for route changes to detect client selection
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        debounceTime(100), // Small debounce to avoid rapid updates
      )
      .subscribe((event: NavigationEnd) => {
        const url = event.urlAfterRedirects;
        const clientMatch = url.match(/\/clients\/([^\/]+)/);

        if (clientMatch && clientMatch[1] && clientMatch[1] !== 'list' && clientMatch[1] !== 'add') {
          const clientId = clientMatch[1];

          const client = this.clientService.getClientById(clientId);
          if (!client) {
            this.clientService.refreshFromStore();
          }

          this.syncSidebarFromReportRoute(url);
        } else if (!url.includes('/clients/') || url === '/clients/list' || url === '/clients/add') {
          this.clientService.clearSelectedClient();
        }
      });
  }

  private startNotificationPolling(): void {
    // Initial load to get the unseen count.
    this.refreshNotificationCount(true);
  }

  private syncSidebarFromReportRoute(url: string): void {
    const path = url.split('?')[0];
    const isReportRoute = path.includes('/reports/') || path.includes('/edit-report/');
    if (!isReportRoute) {
      return;
    }

    const match = path.match(/\/clients\/([^/]+)\/projects\/([^/]+)/);
    if (match) {
      this.clientService.syncReportSidebarContext(match[1], match[2]);
    }
  }

  private resolveSidebarProjects(client: Client, currentUrl: string): Project[] {
    const projects = [...(client.projects || [])];
    const match = currentUrl.match(/\/clients\/([^/]+)\/projects\/([^/]+)/);
    if (!match || match[1] !== String(client.id)) {
      return projects;
    }

    const routeProjectId = match[2];
    if (!projects.some((p) => String(p.id) === routeProjectId)) {
      projects.push({
        id: routeProjectId,
        name: 'Projekt',
        clientId: String(client.id),
      });
    }

    return projects;
  }

  private updateMenuItems(): void {
    // Trigger menu update when notification count changes
    const currentItems = this.menuItemsSubject.value;
    if (currentItems.length > 0) {
      this.menuItemsSubject.next([...currentItems]);
    }
  }

  private initializeMenu(): void {
    combineLatest([this.clientService.getClients(), this.clientService.getSelectedClient().pipe(startWith(null)), this.notificationCountSubject]).subscribe(
      ([clients, selectedClient, notificationCount]) => {
        // Create deep copy of static menu items
        const menuItems = JSON.parse(JSON.stringify(webSidebarMenuItems));
        const currentUrl = this.router.url.split('?')[0];

        // Find the clients menu item
        const clientsMenuItem = menuItems.find((item) => item.href === '/clients');

        if (clientsMenuItem && clients.length > 0) {
          // Update the subItems using IDs instead of slugs
          clientsMenuItem.subItems = clients.map((client) => ({
            href: `/clients/${client.id}`,
            title: client.name,
            active: false,
          }));

          if (selectedClient) {
            const clientBase = `/clients/${selectedClient.id}`;
            const clientSubItem = clientsMenuItem.subItems.find((subItem) => subItem.href === clientBase);
            if (clientSubItem) {
              clientSubItem.active = currentUrl === clientBase || currentUrl.startsWith(`${clientBase}/`);
            }
          }
        }

        // Similar for projects menu
        if (selectedClient) {
          let projectsMenuItem = menuItems.find((item) => item.href?.includes('/projects'));

          const clientIndex = menuItems.findIndex((item) => item.href === '/clients');

          if (!projectsMenuItem) {
            projectsMenuItem = {
              href: `/clients/${selectedClient.id}`,
              title: `Projekte`,
              active: false,
              icon: 'projects',
              subItems: [],
            };

            menuItems.splice(clientIndex + 1, 0, projectsMenuItem);
          } else {
            projectsMenuItem.href = `/clients/${selectedClient.id}`;
          }

          const sidebarProjects = this.resolveSidebarProjects(selectedClient, currentUrl);
          if (sidebarProjects.length > 0) {
            projectsMenuItem.subItems = sidebarProjects.map((project) => {
              const href = `/clients/${selectedClient.id}/projects/${project.id}`;
              const projectId = project.id?.toString();
              const isActiveBySelection = selectedClient.selectedProjectId === projectId;
              const isActiveByRoute = currentUrl.startsWith(href);

              return {
                href,
                title: project.name,
                active: isActiveBySelection || isActiveByRoute,
              };
            });

            projectsMenuItem.active = projectsMenuItem.subItems.some((subItem) => subItem.active);
          } else if (projectsMenuItem) {
            projectsMenuItem.subItems = [];
            projectsMenuItem.active = false;
          }
        } else {
          const projectMenuIndex = menuItems.findIndex((item) => item.href?.includes('/projects'));
          if (projectMenuIndex !== -1) {
            menuItems.splice(projectMenuIndex, 1);
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

  refreshNotificationCount(force = false): void {
    const now = Date.now();
    if (!force) {
      if (this.isRefreshingNotificationCount) {
        return;
      }
      if (now - this.lastNotificationRefreshAt < this.notificationRefreshCooldownMs) {
        return;
      }
    }

    this.isRefreshingNotificationCount = true;
    this.notificationsService
      .getMyUnseen()
      .pipe(
        catchError((error) => {
          console.error('Error fetching notifications:', error);
          return of([]);
        }),
      )
      .subscribe(
        (notifications) => {
          this.lastNotificationRefreshAt = Date.now();
          this.isRefreshingNotificationCount = false;
          const count = notifications.length;
          this.notificationCountSubject.next(count);
          this.updateMenuItems();
        },
        () => {
          this.isRefreshingNotificationCount = false;
        },
      );
  }
}
