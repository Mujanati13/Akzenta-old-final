import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { ApiService } from '@app/core/services/api.service';

/** Merchandiser user type (see Backend user-types.enum). */
const MERCHANDISER_USER_TYPE = 3;

type ResetLinkStatus = 'loading' | 'valid' | 'invalid';

@UntilDestroy()
@Component({
  selector: 'app-password-change',
  templateUrl: './password-change.component.html',
  styleUrls: ['./password-change.component.scss'],
  standalone: false,
})
export class PasswordChangeComponent implements OnInit {
  hash: string | null = null;
  expires: string | null = null;
  hashLinkStatus: ResetLinkStatus | null = null;
  invalidLinkMessage = '';

  forgotForm!: FormGroup;
  resetForm!: FormGroup;

  isSubmitting = false;
  successMessage = '';
  errorMessage = '';

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly fb: FormBuilder,
    private readonly api: ApiService,
  ) {}

  ngOnInit(): void {
    this.hash = this.route.snapshot.queryParamMap.get('hash');
    this.expires = this.route.snapshot.queryParamMap.get('expires');

    this.forgotForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
    });

    this.resetForm = this.fb.group({
      password: ['', [Validators.required, Validators.minLength(8)]],
      passwordConfirm: ['', [Validators.required]],
    });

    if (this.hash) {
      if (!this.isResetLinkForMerchandiser(this.hash)) {
        this.hashLinkStatus = 'invalid';
        this.invalidLinkMessage = this.getWrongPortalLinkMessage(this.hash);
        return;
      }
      this.validateResetLink();
    }
  }

  get isResetMode(): boolean {
    return this.hashLinkStatus === 'valid';
  }

  get isResetLinkInvalid(): boolean {
    return this.hashLinkStatus === 'invalid';
  }

  get isValidatingResetLink(): boolean {
    return this.hashLinkStatus === 'loading';
  }

  private isResetLinkForMerchandiser(hash: string): boolean {
    const tokenUserType = this.getJwtUserType(hash);
    return tokenUserType === null || tokenUserType === MERCHANDISER_USER_TYPE;
  }

  private getJwtUserType(hash: string): number | null {
    try {
      const payload = hash.split('.')[1];
      if (!payload) {
        return null;
      }
      const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as {
        userType?: number;
      };
      return typeof decoded.userType === 'number' ? decoded.userType : null;
    } catch {
      return null;
    }
  }

  private getWrongPortalLinkMessage(hash: string): string {
    const tokenUserType = this.getJwtUserType(hash);
    if (tokenUserType === 1) {
      return 'Dieser Link ist für Akzente-/Head-Office-Konten. Bitte öffnen Sie den Link aus der E-Mail auf der Head-Office- bzw. Report-Seite, nicht im Merchandiser-Portal.';
    }
    if (tokenUserType === 2) {
      return 'Dieser Link ist für Kundenkonten. Bitte verwenden Sie den Passwort-Reset-Link im Kundenportal (Report).';
    }
    return this.getInvalidHashMessage();
  }

  private validateResetLink(): void {
    if (!this.hash) {
      return;
    }

    if (this.isResetLinkExpiredLocally()) {
      this.hashLinkStatus = 'invalid';
      this.invalidLinkMessage = this.getInvalidHashMessage();
      return;
    }

    this.hashLinkStatus = 'loading';

    this.api
      .post<void>('/auth/reset/password/validate', { hash: this.hash, userType: MERCHANDISER_USER_TYPE }, {}, true)
      .pipe(untilDestroyed(this))
      .subscribe({
        next: () => {
          this.hashLinkStatus = 'valid';
        },
        error: (err: any) => {
          this.hashLinkStatus = 'invalid';
          this.invalidLinkMessage = this.getHashErrorMessage(err);
        },
      });
  }

  private isResetLinkExpiredLocally(): boolean {
    if (this.expires) {
      const expiresMs = Number(this.expires);
      if (Number.isFinite(expiresMs) && Date.now() > expiresMs) {
        return true;
      }
    }

    const tokenExp = this.getJwtExpSeconds(this.hash!);
    return tokenExp !== null && tokenExp * 1000 <= Date.now();
  }

  private getJwtExpSeconds(hash: string): number | null {
    try {
      const payload = hash.split('.')[1];
      if (!payload) {
        return null;
      }
      const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as {
        exp?: number;
      };
      return typeof decoded.exp === 'number' ? decoded.exp : null;
    } catch {
      return null;
    }
  }

  private getInvalidHashMessage(): string {
    return 'Der Link ist ungültig oder abgelaufen. Bitte fordern Sie einen neuen Passwort-Reset-Link an.';
  }

  private getHashErrorMessage(err: any): string {
    const errors = this.getApiErrors(err);
    if (errors?.['hash'] === 'invalidUserType') {
      return 'Dieser Link ist nicht für Merchandiser-Konten gültig. Bitte verwenden Sie den richtigen Passwort-Reset-Link für Ihr Konto.';
    }
    return this.getInvalidHashMessage();
  }

  private getApiErrors(err: any): Record<string, unknown> | undefined {
    return err?.data?.errors || err?.error?.errors || err?.errors;
  }

  sendResetEmail(): void {
    if (this.forgotForm.invalid) {
      this.forgotForm.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;
    this.successMessage = '';
    this.errorMessage = '';

    const email = this.forgotForm.value.email;

    this.api
      .post<void>('/auth/forgot/password', { email, userType: 3 }, {}, true)
      .pipe(untilDestroyed(this))
      .subscribe({
        next: () => {
          this.isSubmitting = false;
          this.successMessage = 'Wenn ein Konto mit dieser E-Mail existiert, haben wir Ihnen einen Link zum Zurücksetzen des Passworts gesendet.';
        },
        error: (err: any) => {
          this.isSubmitting = false;
          const errors = this.getApiErrors(err);
          // Check if the error is about email not existing or not being a merchandiser
          if (errors?.['email'] === 'emailNotExists') {
            this.errorMessage = 'Diese E-Mail-Adresse ist keinem Merchandiser-Konto zugeordnet. Bitte überprüfen Sie Ihre E-Mail-Adresse oder kontaktieren Sie den Support.';
          } else {
            this.errorMessage = err?.data?.message || 'Fehler beim Anfordern des Passwort-Reset. Bitte versuchen Sie es später erneut.';
          }
        },
      });
  }

  resetPassword(): void {
    if (this.resetForm.invalid || !this.hash) {
      this.resetForm.markAllAsTouched();
      return;
    }

    const { password, passwordConfirm } = this.resetForm.value;
    if (password !== passwordConfirm) {
      this.errorMessage = 'Die Passwörter stimmen nicht überein.';
      return;
    }

    this.isSubmitting = true;
    this.successMessage = '';
    this.errorMessage = '';

    this.api
      .post<void>('/auth/reset/password', { hash: this.hash, password, userType: MERCHANDISER_USER_TYPE }, {}, true)
      .pipe(untilDestroyed(this))
      .subscribe({
        next: () => {
          this.isSubmitting = false;
          this.successMessage = 'Ihr Passwort wurde erfolgreich geändert. Sie können sich jetzt anmelden.';
          setTimeout(() => this.router.navigate(['/login']), 2000);
        },
        error: (err: any) => {
          this.isSubmitting = false;
          const errors = this.getApiErrors(err);
          // Check if the error is about invalid user type
          if (errors?.['hash'] === 'invalidUserType') {
            this.errorMessage = 'Dieser Link ist nicht für Merchandiser-Konten gültig. Bitte verwenden Sie den richtigen Passwort-Reset-Link für Ihr Konto.';
          } else if (errors?.['hash'] === 'invalidHash') {
            this.errorMessage = 'Der Link ist ungültig oder abgelaufen. Bitte fordern Sie einen neuen Passwort-Reset-Link an.';
          } else if (errors?.['password'] === 'sameAsOldPassword') {
            this.errorMessage = 'Das neue Passwort darf nicht mit Ihrem bisherigen Passwort identisch sein. Bitte wählen Sie ein anderes Passwort.';
          } else {
            this.errorMessage = err?.data?.message || 'Fehler beim Ändern des Passworts. Der Link ist möglicherweise abgelaufen oder ungültig.';
          }
        },
      });
  }
}
