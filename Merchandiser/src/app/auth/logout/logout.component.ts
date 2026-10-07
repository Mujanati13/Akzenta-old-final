import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthenticationService, CredentialsService } from '@auth';
import { AuthStateService, AuthState } from '@app/auth/services/auth-state.service';

@Component({
  selector: 'app-logout',
  templateUrl: './logout.component.html',
  styleUrls: ['./logout.component.scss'],
  standalone: false,
})
export class LogoutComponent implements OnInit {
  isLoggingOut = true;

  constructor(
    private readonly _authService: AuthenticationService,
    private readonly _router: Router,
    private readonly _credentialsService: CredentialsService,
    private readonly _authStateService: AuthStateService,
  ) {}

  ngOnInit() {
    if (!this._credentialsService.isAuthenticated()) {
      // Already logged out, just redirect
      this._authStateService.setAuthState(AuthState.NOT_AUTHENTICATED);
      this._router.navigate(['/login']);
    } else {
      // Call the logout API
      this._authService.logout().subscribe({
        next: () => {
          // Set auth state explicitly
          this._authStateService.setAuthState(AuthState.NOT_AUTHENTICATED);
          this._credentialsService.setCredentials();
          this._router.navigate(['/login']);
        },
        error: (err) => {
          console.error('Error logging out', err);
          // Even if API call fails, log out locally
          this._authStateService.setAuthState(AuthState.NOT_AUTHENTICATED);
          this._credentialsService.setCredentials();
          this._router.navigate(['/login']);
        },
        complete: () => {
          this.isLoggingOut = false;
        },
      });
    }
  }
}
