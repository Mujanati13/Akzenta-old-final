import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Location } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { ImportsModule } from '@app/shared/imports';
import { AppIconComponent } from '../../shared/app-icon.component';
import { FormsModule } from '@angular/forms';
import { SupportMailService } from '@app/core/services/support-mail.service';
import { HotToastService } from '@ngneat/hot-toast';
import { CredentialsService } from '@app/auth';
import { catchError, of } from 'rxjs';

@Component({
  selector: 'app-contact',
  imports: [TranslateModule, ImportsModule, AppIconComponent, FormsModule],
  templateUrl: './contact.component.html',
  styleUrl: './contact.component.scss',
})
export class ContactComponent implements OnInit {
  currentDate: string = '';
  subject: string = '';
  message: string = '';
  sending: boolean = false;
  userId: number | null = null;

  // Check if can go back (has navigation history)
  canGoBack: boolean = false;

  constructor(
    private supportMailService: SupportMailService,
    private toast: HotToastService,
    private credentialsService: CredentialsService,
    private router: Router,
    private location: Location,
  ) {
    // Check if we have navigation history
    const navigation = this.router.getCurrentNavigation();
    this.canGoBack = !!navigation?.previousNavigation;
  }

  ngOnInit(): void {
    // Set current date and time
    this.currentDate =
      new Date().toLocaleString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }) + ' Uhr';

    // Get user ID from credentials
    const credentials = this.credentialsService.credentials;
    this.userId = credentials?.id || null;
  }

  navigateBack(): void {
    if (this.canGoBack) {
      this.location.back();
    }
  }

  sendMessage(): void {
    // Validate input
    if (!this.subject || !this.subject.trim()) {
      this.toast.error('Bitte geben Sie einen Betreff ein.');
      return;
    }

    if (!this.message || !this.message.trim()) {
      this.toast.error('Bitte geben Sie eine Nachricht ein.');
      return;
    }

    if (!this.userId) {
      this.toast.error('Benutzer nicht gefunden. Bitte melden Sie sich erneut an.');
      return;
    }

    this.sending = true;

    // Send message to support with userId
    this.supportMailService
      .sendToSupport({
        userId: this.userId,
        subject: this.subject,
        content: this.message,
      })
      .pipe(
        catchError((error) => {
          console.error('❌ Error sending message to support:', error);
          this.toast.error('Fehler beim Senden der Nachricht.');
          this.sending = false;
          return of(null);
        }),
      )
      .subscribe({
        next: (result) => {
          if (result) {
            this.toast.success('Nachricht erfolgreich an den Support gesendet!');

            // Clear form
            this.subject = '';
            this.message = '';
          }
          this.sending = false;
        },
      });
  }
}
