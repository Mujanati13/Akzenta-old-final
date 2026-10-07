import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '@app/core/services/api.service';
import { catchError } from 'rxjs/operators';
import { of } from 'rxjs';

@Component({
  selector: 'app-confirm-email',
  templateUrl: './confirm-email.component.html',
  styleUrls: ['./confirm-email.component.scss'],
  encapsulation: ViewEncapsulation.None,
  standalone: false,
})
export class ConfirmEmailComponent implements OnInit {
  status: 'loading' | 'success' | 'error' = 'loading';
  errorMessage = '';
  countdown = 10;
  private countdownInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly apiService: ApiService,
  ) {}

  ngOnInit(): void {
    const hash = this.route.snapshot.queryParamMap.get('hash');

    if (!hash) {
      this.status = 'error';
      this.errorMessage = 'Ungültiger Bestätigungslink. Bitte überprüfen Sie Ihre E-Mail.';
      return;
    }

    this.confirmEmail(hash);
  }

  private confirmEmail(hash: string): void {
    this.apiService
      .post('/auth/email/confirm', { hash })
      .pipe(
        catchError((error) => {
          console.error('Email confirmation failed:', error);
          this.status = 'error';

          if (error.status === 422) {
            this.errorMessage = 'Der Bestätigungslink ist ungültig oder wurde bereits verwendet.';
          } else if (error.status === 410 || error.status === 401) {
            this.errorMessage = 'Der Bestätigungslink ist abgelaufen. Bitte fordern Sie einen neuen an.';
          } else if (error.status === 409) {
            this.errorMessage = 'Ihr Konto ist bereits aktiviert. Dieser Link ist nicht mehr gültig.';
          } else {
            this.errorMessage = 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.';
          }

          return of(null);
        }),
      )
      .subscribe({
        next: (result) => {
          if (result !== null || this.status !== 'error') {
            this.status = 'success';
            this.startCountdown();
          }
        },
      });
  }

  private startCountdown(): void {
    this.countdownInterval = setInterval(() => {
      this.countdown--;
      if (this.countdown <= 0) {
        this.goToLogin();
      }
    }, 1000);
  }

  goToLogin(): void {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }
    this.router.navigate(['/login']);
  }

  ngOnDestroy(): void {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }
  }
}
