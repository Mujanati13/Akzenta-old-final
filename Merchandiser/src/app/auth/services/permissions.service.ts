import { Injectable } from '@angular/core';
import { CredentialsService, PERMISSIONS, ROLE } from '@app/auth';
import { appSetting } from '@core/constants';
import { Store } from '@ngrx/store';
import * as AppDataSelectors from '@app/@core/store/app-data/app-data.selectors';
import { Observable, of, BehaviorSubject } from 'rxjs';
import { take, tap, delay } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class PermissionService {
  private authReadySubject = new BehaviorSubject<boolean>(false);

  // Development mode flag - set to false in production
  private devMode = true;

  constructor(
    private readonly _credentialsService: CredentialsService,
    private readonly store: Store,
  ) {
    // Initialize auth state
    this.initAuthState();
  }

  /**
   * Initialize the auth state, ensuring roles are loaded
   */
  private initAuthState(): void {
    // First check if credentials are already available
    if (this._credentialsService.credentials?.roles?.length) {
      this.authReadySubject.next(true);
      return;
    }

    // Otherwise wait for store to have roles
    this.store
      .select(AppDataSelectors.selectUserRole)
      .pipe(take(1))
      .subscribe((role) => {
        if (role) {
          // Role is available from store
          this.authReadySubject.next(true);
        } else {
          // For development, simulate a short delay and then mark as ready with default role
          // In production, this should be replaced with actual auth initialization
          console.log('No role found, using development fallback');
          setTimeout(() => {
            this.authReadySubject.next(true);
          }, 100);
        }
      });
  }

  /**
   * Observable that completes when auth is ready
   */
  isAuthReady(): Observable<boolean> {
    return this.authReadySubject.asObservable().pipe(
      tap((ready) => {
        if (!ready) {
          console.log('Waiting for auth state to initialize...');
        }
      }),
    );
  }

  // Get role from multiple sources to ensure it's available
  get userRole(): ROLE {
    // First try from credentials service
    const credentials = this._credentialsService.credentials;
    if (credentials?.roles?.length) {
      return credentials.roles[0] as ROLE;
    }

    // If not available, check store synchronously
    let storeRole: ROLE | undefined;
    this.store
      .select(AppDataSelectors.selectUserRole)
      .pipe(take(1))
      .subscribe((role) => {
        if (role) {
          storeRole = this.mapRoleNameToEnum(role);
        }
      });

    if (storeRole) {
      return storeRole;
    }

    // For development purposes only
    if (this.devMode) {
      console.warn('⚠️ Using development fallback role: GUEST. Set appropriate roles in production.');
      return ROLE.GUEST; // Use GUEST instead of ADMIN as fallback for safer defaults
    }

    return ROLE.GUEST;
  }

  /**
   * Check if a user has any of the required roles
   */
  hasRole(requiredRoles: ROLE[]): boolean {
    // First check credentials service
    const credentials = this._credentialsService.credentials;
    if (credentials?.roles) {
      if (requiredRoles.some((role) => credentials.roles.includes(role))) {
        console.log(`Role match found in credentials: ${credentials.roles[0]}`);
        return true;
      }
    }

    // Get the current user role synchronously
    const currentRole = this.userRole;
    console.log(`Checking role ${currentRole} against required roles: ${requiredRoles.join(', ')}`);

    // Check if the current role is in the required roles
    const hasRequiredRole = requiredRoles.includes(currentRole);

    // Return actual check result
    console.log(`Actual role check result: ${hasRequiredRole}`);
    return hasRequiredRole;
  }

  /**
   * Map role names to enum values, case-insensitive
   */
  private mapRoleNameToEnum(roleName: string): ROLE {
    const roleMapping = {
      admin: ROLE.ADMIN,
      user: ROLE.USER,
      member: ROLE.MEMBER,
      guest: ROLE.GUEST,
    };

    return roleMapping[roleName.toLowerCase()] || ROLE.GUEST;
  }

  /**
   * Check if a user has specific permissions
   */
  hasPermission(permission: PERMISSIONS): boolean {
    // Only bypass in dev mode when needed
    if (this.devMode && permission.includes('report')) {
      console.log('Bypassing permission check for report in dev mode');
      return true;
    }

    // Production permission check
    const credentials = this._credentialsService.credentials;
    if (!credentials) {
      return false;
    }

    const { roles } = credentials;

    for (const role of roles) {
      const rolePermissions = appSetting.role[role as ROLE];
      if (rolePermissions && this._checkPermission(rolePermissions, permission)) {
        return true;
      }
    }

    return false;
  }

  private _checkPermission(rolePermissions: any, permission: PERMISSIONS): boolean {
    const keys = permission.split('.');
    let currentLevel = rolePermissions;

    for (const key of keys) {
      if (!currentLevel[key]) {
        return false;
      }
      currentLevel = currentLevel[key];
    }

    return currentLevel === true;
  }
}
