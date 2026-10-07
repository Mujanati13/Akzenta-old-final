import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface CreateSupportMailDto {
  userId: number;
  subject: string;
  content: string;
}

@Injectable({
  providedIn: 'root',
})
export class SupportMailService {
  private readonly endpoint = 'support-mails';

  constructor(private apiService: ApiService) {}

  /**
   * Send a message to support
   */
  sendToSupport(data: CreateSupportMailDto): Observable<any> {
    return this.apiService.post<any>(this.endpoint, data);
  }

  /**
   * Get all support mails for a client
   */
  getByClientId(clientId: number): Observable<any> {
    return this.apiService.get<any>(`${this.endpoint}/client/${clientId}`);
  }
}
