import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '@app/core/services/api.service';

export interface UserNotification {
  id: number;
  message: string;
  seen: boolean;
  link?: string;
  conversation?: {
    id: number;
  };
  createdAt?: string;
}

@Injectable({ providedIn: 'root' })
export class NotificationsService {
  private readonly endpoint = 'notifications';

  constructor(private api: ApiService) {}

  getMyNotifications(): Observable<UserNotification[]> {
    return this.api.get<UserNotification[]>(this.endpoint);
  }

  getMyUnseen(): Observable<UserNotification[]> {
    return this.api.get<UserNotification[]>(`${this.endpoint}/unseen`);
  }

  markSeen(id: number): Observable<any> {
    return this.api.patch<any>(`${this.endpoint}/${id}/mark-seen`, {});
  }

  markAllSeen(): Observable<void> {
    return this.api.patch<void>(`${this.endpoint}/mark-all-seen`, {});
  }

  markConversationAsSeen(conversationId: number): Observable<any> {
    return this.api.patch<any>(`${this.endpoint}/conversation/${conversationId}/mark-seen`, {});
  }

  toggleSeen(id: number): Observable<UserNotification> {
    return this.api.patch<UserNotification>(`${this.endpoint}/${id}/toggle-seen`, {});
  }

  toggleConversationSeen(conversationId: number): Observable<any> {
    return this.api.patch<any>(`${this.endpoint}/conversation/${conversationId}/toggle-seen`, {});
  }
}
