import { Route, Router, Routes } from '@angular/router';

import { AuthenticationGuard, PERMISSIONS, PermissionService } from '@app/auth';
import { ShellComponent } from '@app/shell/shell.component';
import { BehaviorSubject } from 'rxjs';
import { Injectable } from '@angular/core';
import { NavMenuItem } from '@core/interfaces';
import { PermissionGuard } from '@app/auth/guard/permission.guard';

/**
 * Provides helper methods to create routes.
 */
export class Shell {
  /**
   * Creates routes using the shell component and authentication.
   * @param routes The routes to add.
   * @return The new route using shell as the base.
   */
  static childRoutes(routes: Routes): Route {
    return {
      path: '',
      component: ShellComponent,
      children: routes,
      canActivate: [AuthenticationGuard, PermissionGuard],

      data: { reuse: true },
    };
  }
}

export enum NavMode {
  Compact = 'compact',
  Free = 'free',
}

@Injectable({
  providedIn: 'root',
})
export class ShellService {
  private readonly _navState = new BehaviorSubject<NavMode>(NavMode.Free);
  readonly navMode$ = this._navState.asObservable();

  constructor(
    private readonly _router: Router,
    public readonly _permissionService: PermissionService,
  ) {}

  allowedAccess(item: NavMenuItem): boolean {
    if (item.roles && item.roles.length) {
      return item.roles.includes(this._permissionService.userRole);
    }

    return true;
  }

  /**
   * Sets active state for main navigation tabs
   */
  activeNavTab(items: NavMenuItem[], extendedItem: number): void {
    // Get current URL path
    const currentPath = window.location.pathname;
    const isProjectOpenRoute = /\/clients\/\d+\/projects\/\d+|\/projects\/\d+/.test(currentPath);
    const isClientDetailRoute = /\/clients\/\d+(\/|$)/.test(currentPath);

    // Reset all active states
    items.forEach((item) => {
      if (item.subItems && item.subItems.length > 0) {
        // Special case for projects routes (client app)
        if (item.href === '/projects' && currentPath.startsWith('/projects')) {
          item.active = true;
        }
        // Special case for clients routes (headoffice app)
        else if (item.href === '/clients' && (currentPath === '/clients/list' || currentPath === '/clients/add')) {
          item.active = true;
        }
        // Special case for users routes - added this condition
        else if (item.href === '/users' && (currentPath === '/users/list' || currentPath === '/users/add')) {
          item.active = true;
        }
        // Special case for staff routes
        else if (item.href === '/staff' && currentPath.startsWith('/staff')) {
          item.active = true;
        } else if (currentPath === item.href) {
          // Exact match for the parent item's path
          item.active = true;
        } else {
          // Only set parent active if we specifically want that behavior
          // For now, we're keeping parents NOT active when subitems are selected
          item.active = false;
        }

        // Set active state for subitems
        item.subItems.forEach((subItem) => {
          subItem.active = currentPath.includes(subItem.href);
        });

        const hasActiveProjectSubItem = (item.icon === 'projects' || item.href === '/projects') && item.subItems.some((subItem) => subItem.active);

        if ((isProjectOpenRoute || hasActiveProjectSubItem) && (item.icon === 'projects' || item.href === '/projects')) {
          item.active = false;
        }

        if (isClientDetailRoute && item.href === '/clients') {
          item.active = false;
        }
      } else {
        // For items without subitems
        item.active = currentPath.startsWith(item.href) || currentPath === item.href;
      }
    });
  }

  activateNavItem(index: number, navItems: NavMenuItem[]): void {
    const item = navItems[index];
    if (item.disabled) return;

    setTimeout(() => {
      const element = document.getElementById(`menu-item-${index}`);
      const navElement = document.querySelector('nav');

      if (element && navElement) {
        const elementRect = element.getBoundingClientRect();
        const navRect = navElement.getBoundingClientRect();

        const relativeTop = elementRect.top - navRect.top;
        const desiredScrollPosition = navElement.scrollTop + relativeTop - navRect.height / 2;

        navElement.scrollTo({ top: desiredScrollPosition, behavior: 'smooth' });
      }
    }, 0);

    if (item && (!item.subItems || !item.subItems.length)) {
      this._router.navigate([item.href]);
    } else {
      // set false to all subitems of all items
      navItems.forEach((item) => {
        if (item.subItems) {
          item.subItems.forEach((subItem) => {
            subItem.active = false;
          });
        }
      });
    }
  }

  /**
   * Activates a specific sidebar subitem
   */
  activateNavSubItem(index: number, subItem: NavMenuItem, items: NavMenuItem[]): void {
    // Reset active state for all subitems in all items
    items.forEach((item) => {
      if (item.subItems && item.subItems.length > 0) {
        item.subItems.forEach((sub) => (sub.active = false));
      }
    });

    // Set active state for the selected subitem
    subItem.active = true;

    // Don't set the parent item as active when a subitem is selected
    // (This is the key change)
    // items[index].active = false;
  }

  setNavMode(mode: NavMode): void {
    this._navState.next(mode);
  }

  getCurrentActiveRoute(lastSegmentOnly = true): string {
    const url = this._router.url;
    const urlSegments = url.split('/');
    const lastSegment = urlSegments[urlSegments.length - 1];
    return lastSegmentOnly ? lastSegment : url;
  }
}
