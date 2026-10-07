import { Component, ViewEncapsulation, OnInit, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { AuthenticationService } from '../services/authentication.service';
import { AuthStateService, AuthState } from '../services/auth-state.service';
import { filter, take, switchMap, catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { ApiService } from '../../core/services/api.service'; // Add this import if you have an ApiService

@UntilDestroy()
@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
  encapsulation: ViewEncapsulation.None,
  standalone: false,
})
export class LoginComponent implements OnInit {
  email = '';
  password = '';
  remember = true;
  isLoading = false;
  showPassword = false;
  loginError = '';
  returnUrl: string;
  isUnconfirmedAccount = false; // New property to track unconfirmed accounts
  isResendingConfirmation = false; // New property for resend loading state

  // Mobile specific
  activeField: string | null = null;
  // @ViewChildren('mobileInput') mobileInputs!: QueryList<ElementRef>;

  constructor(
    private readonly _router: Router,
    private readonly _route: ActivatedRoute,
    private readonly _authService: AuthenticationService,
    private readonly _authStateService: AuthStateService,
    private readonly apiService: ApiService,
  ) {
    this.returnUrl = this._route.snapshot.queryParams['returnUrl'] || '/dashboard';
  }

  ngOnInit(): void {
    const emailParam = this._route.snapshot.queryParams['email'];
    if (typeof emailParam === 'string' && emailParam.trim()) {
      this.email = emailParam.trim().toLowerCase();
    }
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
        // Optionally try to submit if it was the last field, but standard behavior usually just closes keyboard or stays
        // If we want "Next" on password to submit:
        // if (this.activeField === 'password') this.login();
      }
    }
  }

  login() {
    // Clear previous error message
    this.loginError = '';
    this.isUnconfirmedAccount = false;
    this.isLoading = true;

    const normalizedEmail = this.email.trim().toLowerCase();
    this.email = normalizedEmail;

    this._authService
      .login({
        username: normalizedEmail,
        password: this.password,
        remember: this.remember,
      })
      .pipe(
        untilDestroyed(this),
        switchMap(() =>
          this._authStateService.authState$.pipe(
            filter((state) => state === AuthState.AUTHENTICATED),
            take(1),
          ),
        ),
        catchError((error) => {
          this.isLoading = false;
          this.handleLoginError(error);
          return of(null);
        }),
      )
      .subscribe({
        next: (result) => {
          if (result !== null) {
            this.isLoading = false;
            console.log('Login successful, redirecting to', this.returnUrl);
            this._router.navigateByUrl(this.returnUrl);
          }
        },
        error: (err) => {
          this.isLoading = false;
          this.handleLoginError(err);
        },
      });
  }

  private handleLoginError(error: any) {
    // Reset unconfirmed account flag
    this.isUnconfirmedAccount = false;

    const status = error?.status ?? error?.data?.statusCode;
    const errorData = error?.error ?? error?.data ?? error;
    const errors = errorData?.errors ?? {};

    if (status === 422) {
      if (errors.status === 'unconfirmedProfile') {
        this.isUnconfirmedAccount = true;
        this.loginError = 'Ihr Konto wurde noch nicht bestätigt. Bitte überprüfen Sie Ihre E-Mails und klicken Sie auf den Bestätigungslink.';
        return;
      }

      if (errors.userType === 'unauthorizedUserType') {
        this.loginError = 'Dieses Konto ist nicht für das Merchandiser-Portal freigeschaltet. Bitte verwenden Sie das richtige Portal.';
        return;
      }

      if (errors.email) {
        this.loginError = this.mapEmailLoginError(errors.email);
        return;
      }

      if (errors.password === 'incorrectPassword') {
        this.loginError = 'Ungültiges Passwort.';
        return;
      }

      this.loginError = 'Ungültige Anmeldedaten. Bitte überprüfen Sie Ihre Eingaben.';
    } else if (status === 401) {
      this.loginError = 'Ungültige Anmeldedaten. Bitte versuchen Sie es erneut.';
    } else if (status === 429) {
      this.loginError = 'Zu viele Anmeldeversuche. Bitte warten Sie einen Moment und versuchen Sie es erneut.';
    } else if (status === 0 || status >= 500) {
      this.loginError = 'Verbindungsfehler. Bitte überprüfen Sie Ihre Internetverbindung und versuchen Sie es erneut.';
    } else {
      this.loginError = 'Anmeldung fehlgeschlagen. Bitte versuchen Sie es später erneut.';
    }
  }

  private mapEmailLoginError(emailError: string | string[]): string {
    const code = Array.isArray(emailError) ? emailError[0] : emailError;

    if (code === 'notFound' || code === 'emailNotExists') {
      return 'Kein Konto mit dieser E-Mail-Adresse gefunden. Bitte überprüfen Sie Ihre Eingabe oder registrieren Sie sich.';
    }

    if (typeof code === 'string' && code.startsWith('needLoginViaProvider:')) {
      return 'Bitte melden Sie sich über Ihren ursprünglichen Anbieter an (z. B. Google oder Apple).';
    }

    if (code === 'emailAlreadyConfirmed') {
      return 'Ihr Konto ist bereits bestätigt. Bitte versuchen Sie erneut, sich anzumelden.';
    }

    if (typeof code === 'string' && code.toLowerCase().includes('email')) {
      return 'Die eingegebene E-Mail-Adresse ist ungültig. Bitte überprüfen Sie das Format.';
    }

    return 'Ungültige E-Mail-Adresse.';
  }

  // New method to resend confirmation email
  resendConfirmationEmail() {
    const normalizedEmail = this.email.trim().toLowerCase();
    this.email = normalizedEmail;

    if (!normalizedEmail) {
      this.loginError = 'Bitte geben Sie Ihre E-Mail-Adresse ein.';
      return;
    }

    this.isResendingConfirmation = true;

    this.apiService
      .post('/auth/email/resend-confirmation', { email: normalizedEmail })
      .pipe(
        untilDestroyed(this),
        catchError((error) => {
          console.error('Resend confirmation failed:', error);
          this.isResendingConfirmation = false;
          this.loginError = 'Fehler beim Versenden der Bestätigungsmail. Bitte versuchen Sie es später erneut.';
          return of(null);
        }),
      )
      .subscribe({
        next: (response) => {
          if (response !== null) {
            this.isResendingConfirmation = false;
            this.loginError = 'Bestätigungsmail wurde erneut gesendet. Bitte überprüfen Sie Ihre E-Mails.';
          }
        },
      });
  }

  toggleShowPassword() {
    this.showPassword = !this.showPassword;
  }
}
