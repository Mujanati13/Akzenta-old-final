import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface CardItem {
  id: number;
  isFavorite: boolean;
  name: string;
  city: string;
  image: string;
  logo?: {
    id: string;
    path: string;
  } | null;
  createdAt: Date;
  updatedAt: Date;
  reportCounts?: {
    newReports: number;
    ongoingReports: number;
    completedReports: number;
  };
}

export interface ClientsData {
  cards: CardItem[];
  timestamp: number;
}

@Injectable({
  providedIn: 'root',
})
export class ClientsStateService {
  private readonly CLIENTS_DATA_STORAGE_KEY = 'merchandiser_clients_data_v1';
  private readonly CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

  private readonly clientsDataSubject = new BehaviorSubject<ClientsData | null>(null);

  readonly clientsData$ = this.clientsDataSubject.asObservable();

  setClientsData(cards: CardItem[]): void {
    if (cards) {
      const clientsData: ClientsData = {
        cards: cards.map((card) => ({ ...card })),
        timestamp: Date.now(),
      };
      this.clientsDataSubject.next(clientsData);
      this.persistClientsData(clientsData);
    }
  }

  getClientsDataSnapshot(): ClientsData | null {
    return this.clientsDataSubject.value;
  }

  clearCache(): void {
    this.clientsDataSubject.next(null);
    if (this.hasBrowserStorageSupport()) {
      window.localStorage.removeItem(this.CLIENTS_DATA_STORAGE_KEY);
    }
  }

  isCacheValid(): boolean {
    const data = this.clientsDataSubject.value;
    if (!data || !data.timestamp) {
      return false;
    }

    const age = Date.now() - data.timestamp;
    return age < this.CACHE_DURATION;
  }

  private loadClientsDataFromStorage(): ClientsData | null {
    return null;
  }

  private persistClientsData(data: ClientsData): void {
    void data;
  }

  private hasBrowserStorageSupport(): boolean {
    return typeof window !== 'undefined' && !!window.localStorage;
  }
}
