import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { UserNotification } from '@app/core/services/notifications.service';

export interface NotificationsData {
  notifications: UserNotification[];
  timestamp: number;
}

@Injectable({
  providedIn: 'root',
})
export class NotificationsStateService {
  private readonly NOTIFICATIONS_DATA_STORAGE_KEY = 'merchandiser_notifications_data_v1';
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes (notifications should be fresh)

  private readonly notificationsDataSubject = new BehaviorSubject<NotificationsData | null>(null);

  readonly notificationsData$ = this.notificationsDataSubject.asObservable();

  setNotificationsData(notifications: UserNotification[]): void {
    if (notifications) {
      const notificationsData: NotificationsData = {
        notifications: notifications.map((notification) => ({ ...notification })),
        timestamp: Date.now(),
      };
      this.notificationsDataSubject.next(notificationsData);
      this.persistNotificationsData(notificationsData);
    }
  }

  getNotificationsDataSnapshot(): NotificationsData | null {
    return this.notificationsDataSubject.value;
  }

  clearCache(): void {
    this.notificationsDataSubject.next(null);
    if (this.hasBrowserStorageSupport()) {
      window.localStorage.removeItem(this.NOTIFICATIONS_DATA_STORAGE_KEY);
    }
  }

  isCacheValid(): boolean {
    const data = this.notificationsDataSubject.value;
    if (!data || !data.timestamp) {
      return false;
    }

    const age = Date.now() - data.timestamp;
    return age < this.CACHE_DURATION;
  }

  private loadNotificationsDataFromStorage(): NotificationsData | null {
    return null;
  }

  private persistNotificationsData(data: NotificationsData): void {
    void data;
  }

  private hasBrowserStorageSupport(): boolean {
    return typeof window !== 'undefined' && !!window.localStorage;
  }
}
