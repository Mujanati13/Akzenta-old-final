import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { ShellService } from '@app/shell/services/shell.service';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Router, NavigationEnd } from '@angular/router';
import { CredentialsService } from '@app/auth';
import { filter } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { interval } from 'rxjs';
import { AuthStateService, AuthState } from '@app/auth/services/auth-state.service';
import { TokenStorageService } from '@app/auth/services/token-storage.service';
import { AuthenticationService } from '@app/auth/services/authentication.service';
import { SessionActivityService } from '@app/auth/services/session-activity.service';

@UntilDestroy()
@Component({
  selector: 'app-shell',
  templateUrl: './shell.component.html',
  standalone: false,
})
export class ShellComponent implements OnInit {
  isSidebarActive = false;
  isLoading = true; // Add loading state
  private destroyRef = inject(DestroyRef);

  constructor(
    private readonly _shellService: ShellService,
    private readonly _router: Router,
    private credentialsService: CredentialsService,
    private authStateService: AuthStateService,
    private tokenStorageService: TokenStorageService,
    private authenticationService: AuthenticationService,
    private sessionActivityService: SessionActivityService,
  ) {}

  ngOnInit() {
    this.sessionActivityService.startTracking(this.destroyRef);
    // Subscribe to auth state changes
    this.authStateService.authState$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((authState) => {
      console.log('Auth state changed:', authState);
      this.isLoading = authState === AuthState.CHECKING;

      if (authState === AuthState.NOT_AUTHENTICATED) {
        // Only redirect to login if we're not already on a public route
        if (!this._router.url.includes('/login') && !this._router.url.includes('/register') && !this._router.url.includes('/forgot-password')) {
          this._router.navigate(['/login'], {
            queryParams: { returnUrl: this._router.url },
            replaceUrl: true,
          });
        }
      }
    });

    // Check authentication on route changes
    this._router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        this.checkAuthentication();
      });

    // Periodically check authentication status (every 30 seconds)
    interval(30000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.checkAuthentication();
      });

    if (typeof document !== 'undefined') {
      const onVisibilityChange = (): void => {
        if (document.visibilityState === 'visible') {
          this.checkAuthentication();
        }
      };
      document.addEventListener('visibilitychange', onVisibilityChange);
      this.destroyRef.onDestroy(() => {
        document.removeEventListener('visibilitychange', onVisibilityChange);
      });
    }
  }

  private checkAuthentication(): void {
    if (this.authStateService.currentAuthState === AuthState.CHECKING) {
      return;
    }

    if (!this.credentialsService.isAuthenticated()) {
      this.authStateService.setAuthState(AuthState.NOT_AUTHENTICATED);
      return;
    }

    const expiresAt = this.tokenStorageService.getTokenExpires() || this.credentialsService.credentials?.expiresIn;

    if (!expiresAt || !this.tokenStorageService.isTokenExpired()) {
      this.authStateService.setAuthState(AuthState.AUTHENTICATED);
      return;
    }

    this.authenticationService.refreshToken().subscribe({
      next: () => this.authStateService.setAuthState(AuthState.AUTHENTICATED),
      error: () => this.authStateService.setAuthState(AuthState.NOT_AUTHENTICATED),
    });
  }

  toggleSidebar(): void {
    this.isSidebarActive = !this.isSidebarActive;
  }

  reloadCurrentRoute(path?: string): void {
    const currentUrl = path || this._router.url;
    this._router.navigateByUrl('/', { skipLocationChange: true }).then(() => {
      this._router.navigate([currentUrl]);
    });
  }
}
