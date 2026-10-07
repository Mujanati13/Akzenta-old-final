import { Component, OnInit, OnDestroy, ViewEncapsulation } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { Location } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { ImportsModule } from '@app/shared/imports';
import { AppIconComponent } from '../../shared/app-icon.component';
import { NotificationsService, UserNotification } from '../../core/services/notifications.service';
import { NavigationService } from '../../@core/services/navigation.service';
import { NotificationsStateService } from './notifications-state.service';
import { catchError, of } from 'rxjs';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-notifications',
  imports: [TranslateModule, ImportsModule, AppIconComponent, RouterModule],
  templateUrl: './notifications.component.html',
  styleUrl: './notifications.component.scss',
  encapsulation: ViewEncapsulation.None,
})
export class NotificationsComponent implements OnInit, OnDestroy {
  notifications: UserNotification[] = [];
  tag: string | null = null;
  loading = false;
  error = false;

  // Check if can go back (has navigation history)
  canGoBack: boolean = false;

  private destroy$ = new Subject<void>();

  constructor(
    private notificationsService: NotificationsService,
    private notificationsStateService: NotificationsStateService,
    private navigationService: NavigationService,
    private router: Router,
    private location: Location,
  ) {
    // Check if we have navigation history
    const navigation = this.router.getCurrentNavigation();
    this.canGoBack = !!navigation?.previousNavigation;
  }

  ngOnInit() {
    // Try to restore from cache first
    const cachedData = this.notificationsStateService.getNotificationsDataSnapshot();
    if (cachedData && this.notificationsStateService.isCacheValid()) {
      this.notifications = cachedData.notifications || [];
      this.updateUnseenCount();

      // Load fresh data in background (without showing loader)
      this.loadNotifications({ showLoader: false });
    } else {
      // No valid cache, load from server with loader
      this.loadNotifications({ showLoader: true });
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  navigateBack(): void {
    if (this.canGoBack) {
      this.location.back();
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
        takeUntil(this.destroy$),
        catchError((error) => {
          console.error('Error loading notifications:', error);
          this.error = true;
          return of([]);
        }),
      )
      .subscribe({
        next: (notifications) => {
          // Sort notifications: unseen first, then by creation date (newest first)
          const sortedNotifications = notifications.sort((a, b) => {
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

          // Update component state
          this.notifications = sortedNotifications;

          // Save to store
          this.notificationsStateService.setNotificationsData(sortedNotifications);

          this.updateUnseenCount();
          this.loading = false;
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
          },
        });
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
    const pathString = linkParts[0];
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

    // If navigating to report detail, open the dialog
    if (pathString.includes('report-detail') || pathString.includes('/reports/')) {
      params['openDialog'] = 'true';
    }

    return params;
  }

  markAsSeen(notification: UserNotification): void {
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
            },
          });
      }
    }
  }
}
