import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router, RouterStateSnapshot } from '@angular/router';
import { Logger } from '@app/@core/services';
import { UntilDestroy } from '@ngneat/until-destroy';
import { CredentialsService } from '@app/auth';
import { inject } from '@angular/core';
import { AuthStateService, AuthState } from '../services/auth-state.service';
import { Observable, map, of, take } from 'rxjs';

const log = new Logger('AuthenticationGuard');

export const AuthenticationGuard: CanActivateFn = (route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Observable<boolean> => {
  const router = inject(Router);
  const credentialsService = inject(CredentialsService);
  const authStateService = inject(AuthStateService);

  // Wait for auth state to stabilize
  return authStateService.authState$.pipe(
    take(1),
    map((authState) => {
      // If we're still checking, we'll temporarily allow access and let the shell component handle redirection
      if (authState === AuthState.CHECKING) {
        return true;
      }

      if (authState === AuthState.AUTHENTICATED && credentialsService.isAuthenticated()) {
        return true;
      }

      // Store the attempted URL for redirecting after login
      localStorage.setItem('returnUrl', state.url);
      router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
      return false;
    }),
  );
};

// This guard prevents authenticated users from accessing login page
export const AlreadyLoggedCheckGuard: CanActivateFn = (_route: ActivatedRouteSnapshot, _state: RouterStateSnapshot): Observable<boolean> => {
  const router = inject(Router);
  const authStateService = inject(AuthStateService);
  const credentialsService = inject(CredentialsService);
  const log = new Logger('AlreadyLoggedCheckGuard');

  log.debug('Checking if user is already logged in');

  // Check both authState AND credentials service
  return authStateService.authState$.pipe(
    take(1),
    map((authState) => {
      // First check credentials service directly - this is more reliable
      if (credentialsService.isAuthenticated()) {
        log.debug('User is authenticated via credentials, redirecting to dashboard');
        router.navigate(['/dashboard']);
        return false;
      }

      // Then check auth state as a backup
      if (authState === AuthState.AUTHENTICATED) {
        log.debug('User is authenticated via auth state, redirecting to dashboard');
        router.navigate(['/dashboard']);
        return false;
      }

      // If we're still checking auth state, we need to wait
      if (authState === AuthState.CHECKING) {
        log.debug('Auth state is still checking, redirecting to dashboard as precaution');
        router.navigate(['/dashboard']);
        // Dashboard will handle redirecting back to login if needed
        return false;
      }

      log.debug('User is not authenticated, allowing access to login page');
      return true;
    }),
  );
};
