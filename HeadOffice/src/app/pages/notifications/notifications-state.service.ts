import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { UserNotification } from '../../core/services/notifications.service';

export interface NotificationsStateData {
  notifications: UserNotification[];
  scrollPosition?: number;
  timestamp: number;
}

@Injectable({
  providedIn: 'root',
})
export class NotificationsStateService {
  private readonly STORAGE_KEY = 'notifications_state_v1';
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache (shorter for notifications)

  private readonly stateSubject = new BehaviorSubject<NotificationsStateData | null>(null);
  readonly state$ = this.stateSubject.asObservable();

  constructor() {
    this.loadFromStorage();
  }

  saveState(state: Partial<NotificationsStateData>): void {
    const currentState = this.stateSubject.value || {
      notifications: [],
      timestamp: Date.now(),
    };

    const newState: NotificationsStateData = {
      ...currentState,
      ...state,
      timestamp: Date.now(),
    };
    this.stateSubject.next(newState);
    this.persistToStorage(newState);
  }

  getStateSnapshot(): NotificationsStateData | null {
    const data = this.stateSubject.value;
    if (!data || !this.isCacheValid(data)) {
      return null;
    }
    return data;
  }

  clearCache(): void {
    this.stateSubject.next(null);
    if (this.hasBrowserStorageSupport()) {
      window.localStorage.removeItem(this.STORAGE_KEY);
    }
  }

  private isCacheValid(data: NotificationsStateData): boolean {
    const age = Date.now() - data.timestamp;
    return age < this.CACHE_DURATION;
  }

  private loadFromStorage(): void {
    if (!this.hasBrowserStorageSupport()) {
      return;
    }

    const raw = window.localStorage.getItem(this.STORAGE_KEY);
    if (!raw) {
      return;
    }

    try {
      const data = JSON.parse(raw) as NotificationsStateData;
      if (this.isCacheValid(data)) {
        this.stateSubject.next(data);
      } else {
        this.clearCache();
      }
    } catch (error) {
      console.warn('Failed to parse notifications state from storage:', error);
      this.clearCache();
    }
  }

  private persistToStorage(data: NotificationsStateData): void {
    if (!this.hasBrowserStorageSupport()) {
      return;
    }

    try {
      window.localStorage.setItem(
        this.STORAGE_KEY,
        JSON.stringify({
          ...data,
          notifications: [],
        } satisfies NotificationsStateData),
      );
    } catch (error) {
      console.warn('Failed to persist notifications state:', error);
    }
  }

  private hasBrowserStorageSupport(): boolean {
    return typeof window !== 'undefined' && !!window.localStorage;
  }
}
