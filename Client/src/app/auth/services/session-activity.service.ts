import { DestroyRef, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '@env/environment';
import { CredentialsService } from './credentials.service';

@Injectable({
  providedIn: 'root',
})
export class SessionActivityService {
  private readonly touchIntervalMs = 60_000;
  private lastTouchAt = 0;

  constructor(
    private readonly http: HttpClient,
    private readonly credentialsService: CredentialsService,
  ) {}

  startTracking(destroyRef: DestroyRef): void {
    if (typeof document === 'undefined') {
      return;
    }

    const events: Array<keyof DocumentEventMap> = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    const onActivity = (): void => this.recordActivity();

    events.forEach((eventName) => {
      document.addEventListener(eventName, onActivity, { passive: true });
    });

    destroyRef.onDestroy(() => {
      events.forEach((eventName) => {
        document.removeEventListener(eventName, onActivity);
      });
    });
  }

  private recordActivity(): void {
    if (!this.credentialsService.isAuthenticated()) {
      return;
    }

    const now = Date.now();
    if (now - this.lastTouchAt < this.touchIntervalMs) {
      return;
    }

    this.lastTouchAt = now;

    this.http.post(`${environment.apiUrl}/auth/session/touch`, {}, { withCredentials: true }).subscribe({ error: () => undefined });
  }
}
