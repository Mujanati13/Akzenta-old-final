import { Component, OnInit, ViewEncapsulation, OnDestroy, AfterViewInit, Renderer2 } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { ImportsModule } from '@app/shared/imports';
import { AppIconComponent } from '../../shared/app-icon.component';
import { ClientsRoutingModule } from '../clients/clients-routing.module';
import { NotificationsService, UserNotification } from '../../core/services/notifications.service';
import { NotificationsStateService } from './notifications-state.service';
import { NavigationService } from '../../@core/services/navigation.service';
import { catchError, of } from 'rxjs';

@Component({
  selector: 'app-notifications',
  imports: [TranslateModule, ImportsModule, AppIconComponent, ClientsRoutingModule],
  templateUrl: './notifications.component.html',
  styleUrl: './notifications.component.scss',
  encapsulation: ViewEncapsulation.None,
})
export class NotificationsComponent implements OnInit, OnDestroy, AfterViewInit {
  notifications: UserNotification[] = [];
  tag: string | null = null;
  loading = false;
  error = false;

  private scrollListener: (() => void) | null = null;
  private scrollPosition = 0;

  constructor(
    private notificationsService: NotificationsService,
    private navigationService: NavigationService,
    private router: Router,
    private notificationsStateService: NotificationsStateService,
    private renderer: Renderer2,
  ) {}

  ngOnInit() {
    const cachedData = this.notificationsStateService.getStateSnapshot();
    if (cachedData) {
      this.scrollPosition = cachedData.scrollPosition || 0;
    }

    if (cachedData && cachedData.notifications.length > 0) {
      this.notifications = cachedData.notifications;
      this.updateUnseenCount();
      this.loadNotifications({ showLoader: false });
    } else {
      this.loadNotifications({ showLoader: true });
    }
  }

  ngAfterViewInit() {
    this.restoreScrollPosition();

    this.scrollListener = this.renderer.listen('window', 'scroll', () => {
      this.scrollPosition = window.scrollY || document.documentElement.scrollTop;
    });
  }

  ngOnDestroy() {
    if (this.scrollListener) {
      this.scrollListener();
    }
    this.saveCurrentState();
  }

  private saveCurrentState() {
    this.notificationsStateService.saveState({
      notifications: this.notifications,
      scrollPosition: this.scrollPosition,
    });
  }

  private restoreScrollPosition(): void {
    if (this.scrollPosition > 0) {
      setTimeout(() => {
        window.scrollTo(0, this.scrollPosition);
      }, 100);
    }
  }

  loadNotifications(options: { showLoader: boolean } = { showLoader: true }): void {
    if (options.showLoader) {
      this.loading = true;
    }
    this.error = false;

    this.notificationsService
      .getMyNotifications()
      .pipe(
        catchError((error) => {
          console.error('Error loading notifications:', error);
          this.error = true;
          return of([]);
        }),
      )
      .subscribe({
        next: (notifications) => {
          // Sort notifications: unseen first, then by creation date (newest first)
          this.notifications = notifications.sort((a, b) => {
            // First, sort by seen status (unseen first)
            if (a.seen !== b.seen) {
              return a.seen ? 1 : -1;
            }
            // Then sort by creation date (newest first)
            if (a.createdAt && b.createdAt) {
              return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            }
            return 0;
          });
          this.updateUnseenCount();
          this.loading = false;
          this.saveCurrentState();
          this.restoreScrollPosition();
        },
        error: () => {
          this.loading = false;
        },
      });
  }

  updateUnseenCount(): void {
    const unseenCount = this.notifications.filter((n) => !n.seen).length;
    this.tag = unseenCount > 0 ? unseenCount.toString() : null;
    // Update the sidebar notification count directly without backend call
    this.navigationService.updateNotificationCount(unseenCount);
  }

  onSeenToggle(notification: UserNotification): void {
    // Toggle the seen state (both seen <-> unseen)
    const newSeenState = !notification.seen;

    if (notification.conversation?.id) {
      // Toggle all notifications from the same conversation
      this.notificationsService
        .toggleConversationSeen(notification.conversation.id)
        .pipe(
          catchError((error) => {
            console.error('Error toggling conversation notifications:', error);
            return of(null);
          }),
        )
        .subscribe({
          next: () => {
            // Update local state immediately - toggle all notifications from same conversation
            this.notifications = this.notifications.map((n) => (n.conversation?.id === notification.conversation?.id ? { ...n, seen: newSeenState } : n));
            this.updateUnseenCount();
            this.saveCurrentState();
          },
        });
    } else {
      // Toggle single notification
      this.notificationsService
        .toggleSeen(notification.id)
        .pipe(
          catchError((error) => {
            console.error('Error toggling notification:', error);
            return of(null);
          }),
        )
        .subscribe({
          next: () => {
            // Update local state immediately
            notification.seen = newSeenState;
            this.updateUnseenCount();
            this.saveCurrentState();
          },
        });
    }
  }

  onNotificationClick(notification: UserNotification): void {
    // Mark notification as seen when clicked (only if currently unseen)
    if (!notification.seen) {
      if (notification.conversation?.id) {
        // Mark all notifications from the same conversation as seen
        this.notificationsService
          .markConversationAsSeen(notification.conversation.id)
          .pipe(
            catchError((error) => {
              console.error('Error marking conversation as seen:', error);
              return of(null);
            }),
          )
          .subscribe({
            next: () => {
              // Update local state immediately
              this.notifications = this.notifications.map((n) => (n.conversation?.id === notification.conversation?.id ? { ...n, seen: true } : n));
              this.updateUnseenCount();
              this.saveCurrentState();
            },
          });
      } else {
        // Mark single notification as seen
        this.notificationsService
          .markSeen(notification.id)
          .pipe(
            catchError((error) => {
              console.error('Error marking notification as seen:', error);
              return of(null);
            }),
          )
          .subscribe({
            next: () => {
              // Update local state immediately
              notification.seen = true;
              this.updateUnseenCount();
              this.saveCurrentState();
            },
          });
      }
    }

    // Navigate with referrer parameter
    if (notification.link) {
      // Parse the link to add referrer query parameter
      const linkParts = notification.link.split('?');
      const pathString = linkParts[0];
      const existingParams = linkParts.length > 1 ? linkParts[1] : '';

      // Convert path string to array (remove leading slash and split)
      const pathArray = pathString.startsWith('/')
        ? pathString
            .substring(1)
            .split('/')
            .filter((segment) => segment.length > 0)
        : pathString.split('/').filter((segment) => segment.length > 0);

      // Parse existing query params
      const params: Record<string, any> = {};
      if (existingParams) {
        const urlParams = new URLSearchParams(existingParams);
        urlParams.forEach((value, key) => {
          params[key] = value;
        });
      }
      params['referrer'] = 'notifications';

      // If navigating to report detail, open the dialog
      if (pathString.includes('report-detail') || pathString.includes('/reports/')) {
        params['openDialog'] = 'true';
      }

      // Navigate with updated query params
      this.router.navigate(pathArray, { queryParams: params });
    }
  }

  getRouterLink(notification: UserNotification): any[] {
    if (!notification.link) return [];

    let pathString = notification.link.split('?')[0];

    // Handle full URLs by extracting pathname
    if (pathString.startsWith('http')) {
      try {
        const url = new URL(pathString);
        pathString = url.pathname;
      } catch (e) {
        // If URL parsing fails, fall back to original string
      }
    }

    // Split into segments and filter out empty ones
    const segments = pathString.split('/').filter((segment) => segment.length > 0);

    // Return absolute path array (starting with '/') to ensure navigation from root
    return ['/', ...segments];
  }

  getQueryParams(notification: UserNotification): any {
    if (!notification.link) return { referrer: 'notifications', notificationId: notification.id };
    const linkParts = notification.link.split('?');
    const existingParams = linkParts.length > 1 ? linkParts[1] : '';
    const params: Record<string, any> = {};
    if (existingParams) {
      const urlParams = new URLSearchParams(existingParams);
      urlParams.forEach((value, key) => {
        params[key] = value;
      });
    }
    params['referrer'] = 'notifications';
    params['notificationId'] = notification.id;

    const pathString = linkParts[0];
    if (pathString.includes('report-detail') || pathString.includes('/reports/')) {
      params['openDialog'] = 'true';
    }
    return params;
  }

  markAsSeen(notification: UserNotification): void {
    if (!notification.seen) {
      if (notification.conversation?.id) {
        this.notificationsService
          .markConversationAsSeen(notification.conversation.id)
          .pipe(
            catchError((error) => {
              console.error('Error marking conversation as seen:', error);
              return of(null);
            }),
          )
          .subscribe({
            next: () => {
              this.notifications = this.notifications.map((n) => (n.conversation?.id === notification.conversation?.id ? { ...n, seen: true } : n));
              this.updateUnseenCount();
              this.saveCurrentState();
            },
          });
      } else {
        this.notificationsService
          .markSeen(notification.id)
          .pipe(
            catchError((error) => {
              console.error('Error marking notification as seen:', error);
              return of(null);
            }),
          )
          .subscribe({
            next: () => {
              notification.seen = true;
              this.updateUnseenCount();
              this.saveCurrentState();
            },
          });
      }
    }
  }
}
