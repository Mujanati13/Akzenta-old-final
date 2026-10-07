import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '@app/core/services/api.service';

export interface CreateClientDto {
  email: string;
  firstName: string;
  lastName: string;
  gender: 'male' | 'female' | 'other';
  phone: string;
  isSales?: boolean; // Optional - marks if this client user has sales role
  clientCompanies: { id: number }[];
}

export interface CreateAkzenteDto {
  email: string;
  firstName: string;
  lastName: string;
  gender: 'male' | 'female' | 'other';
  phone: string;
  clientCompanies: { id: number }[];
}

export interface Client {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  gender: string;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable({
  providedIn: 'root',
})
export class ClientService {
  private readonly endpoint = 'auth/register-client';

  constructor(private apiService: ApiService) {}

  /**
   * Create a new client (only accessible to Akzente users)
   */
  createClient(data: CreateClientDto): Observable<void> {
    return this.apiService.post<void>(this.endpoint, data);
  }

  /**
   * Create a new akzente (only accessible to Akzente users)
   */

  createAkzente(createAkzenteData: CreateAkzenteDto): Observable<void> {
    return this.apiService.post<void>('auth/register-akzente', createAkzenteData);
  }

  /**
   * Get all clients with pagination
   */
  getClients(page: number = 1, limit: number = 0): Observable<any> {
    return this.apiService.get<any>('client', { page, limit });
  }

  /**
   * Get client by ID
   */
  getClientById(id: number): Observable<Client> {
    return this.apiService.get<Client>(`client/${id}`);
  }
}
