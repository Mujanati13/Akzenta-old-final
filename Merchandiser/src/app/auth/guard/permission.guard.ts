import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateChildFn, CanActivateFn, Router, RouterStateSnapshot } from '@angular/router';
import { PERMISSIONS, PermissionService, ROLE } from '@auth';
import { Observable, of } from 'rxjs';
import { map, catchError, tap, delay, take } from 'rxjs/operators';

// Is the app running in development mode?
const DEV_MODE = true; // Set to false in production

/**
 * The `PermissionGuard` function checks for required roles and permissions before
 * allowing access to a route.
 */
export const PermissionGuard: CanActivateFn & CanActivateChildFn = (route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Observable<boolean> => {
  const permissionService = inject(PermissionService);
  const router = inject(Router);

  console.log(`🛡️ Permission guard checking access to: ${state.url}`);

  // If this is a report page AND we're in development, bypass permission checks
  if (DEV_MODE && (state.url.includes('/reports/') || state.url.includes('/edit-report/'))) {
    console.log('📝 Report page detected, bypassing permission check during development');
    return of(true);
  }

  // For other pages, check permissions properly
  return permissionService.isAuthReady().pipe(
    // Wait for app initializer to complete and load the actual user role
    take(1),
    tap(() => console.log('Auth state is ready')),
    // Add a delay to ensure initializers have completed
    delay(10),
    map(() => {
      const currentRole = permissionService.userRole;
      console.log(`👤 User role: ${currentRole}`);

      // Check if roles are specified in the route and validate them
      const requiredRoles = route.data['roles'] as ROLE[] | undefined;
      if (requiredRoles?.length) {
        console.log(`🔒 Required roles: ${requiredRoles.join(', ')}`);
        const hasRole = permissionService.hasRole(requiredRoles);
        console.log(`Role check result: ${hasRole ? 'Passed ✅' : 'Failed ❌'}`);

        if (!hasRole) {
          console.log(`❌ Access denied: insufficient role`);
          handleUnauthorized(router);
          return false;
        }
      }

      // Check permissions
      const requiredPermissions = route.data['permissions'] as PERMISSIONS[] | undefined;
      if (requiredPermissions?.length) {
        console.log(`🔑 Required permissions: ${requiredPermissions.join(', ')}`);
        if (!checkPermissions(requiredPermissions, permissionService)) {
          console.log(`❌ Access denied: insufficient permissions`);
          handleUnauthorized(router);
          return false;
        }
      }

      console.log(`✅ Access granted to: ${state.url}`);
      return true;
    }),
    catchError((error) => {
      console.error('Error in permission guard:', error);
      handleUnauthorized(router);
      return of(false);
    }),
  );
};

// Utility function to handle unauthorized access
function handleUnauthorized(router: Router): boolean {
  router.navigate(['/unauthorized']);
  return false;
}

// Utility function to check permissions
function checkPermissions(permissions: PERMISSIONS[], permissionService: PermissionService): boolean {
  // Just an additional layer to check for special permissions, if you dont have any ignore it
  const specialPermissionHandlers = {};

  for (const permission of permissions) {
    const specialPermissionCheck = specialPermissionHandlers[permission];
    if (specialPermissionCheck) {
      if (specialPermissionCheck()) return true;
    } else if (permissionService.hasPermission(permission)) {
      return true;
    }
  }

  return false;
}
