import { Component, ViewEncapsulation, ElementRef, ViewChild, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { AuthenticationService } from '../services/authentication.service';
import { AuthStateService, AuthState } from '../services/auth-state.service';
import { filter, take, switchMap } from 'rxjs/operators';

@UntilDestroy()
@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
  encapsulation: ViewEncapsulation.None,
  standalone: false,
})
export class LoginComponent {
  email = '';
  password = '';
  remember = true;
  isLoading = false;
  showPassword = false;
  loginError = '';
  returnUrl: string;

  // Mobile specific
  activeField: string | null = null;

  constructor(
    private readonly _router: Router,
    private readonly _route: ActivatedRoute,
    private readonly _authService: AuthenticationService,
    private readonly _authStateService: AuthStateService,
    private readonly cdr: ChangeDetectorRef,
  ) {
    this.returnUrl = this._route.snapshot.queryParams['returnUrl'] || '/dashboard';
  }

  get isMobileToolbarVisible(): boolean {
    return !!this.activeField && window.innerWidth < 768;
  }

  onInputFocus(field: string) {
    if (window.innerWidth < 768) {
      this.activeField = field;
    }
  }

  closeMobileToolbar() {
    this.activeField = null;
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }

  navigateMobileInput(direction: 'next' | 'prev') {
    const fields = ['email', 'password'];
    if (!this.activeField) return;

    const currentIndex = fields.indexOf(this.activeField);
    if (currentIndex === -1) return;

    let targetIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;

    if (targetIndex >= 0 && targetIndex < fields.length) {
      const targetField = fields[targetIndex];
      const element = document.getElementById(targetField);
      if (element) {
        (element as any).focus({ preventScroll: true });
        this.activeField = targetField;
      }
    } else {
      if (direction === 'next') {
        this.closeMobileToolbar();
      }
    }
  }

  login() {
    // Clear previous error message
    this.loginError = '';
    this.isLoading = true;

    this._authService
      .login({
        username: this.email,
        password: this.password,
        remember: this.remember,
      })
      .pipe(
        untilDestroyed(this),
        // After login completes successfully, wait for auth state to be AUTHENTICATED
        switchMap(() =>
          this._authStateService.authState$.pipe(
            filter((state) => state === AuthState.AUTHENTICATED),
            take(1),
          ),
        ),
      )
      .subscribe({
        next: () => {
          this.isLoading = false;
          this._router.navigateByUrl(this.returnUrl);
        },
        error: (err) => {
          this.isLoading = false;
          this.loginError = 'Invalid credentials. Please try again.';
          console.error('Login failed:', err);
        },
      });
  }

  toggleShowPassword() {
    this.showPassword = !this.showPassword;
  }
}
