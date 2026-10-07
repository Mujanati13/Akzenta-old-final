import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface CardItem {
  id: number;
  isFavorite: boolean;
  isMyClient: boolean;
  name: string;
  city: string;
  cities: any[];
  image: string;
  logo?: {
    id: string;
    path: string;
  } | null;
  createdAt: Date;
  updatedAt: Date;
  reportCounts?: any;
}

interface ClientsState {
  allCards: CardItem[];
  activeFilter: 'all' | 'my-clients';
  searchTerm: string;
  showOnlyFavorites: boolean;
  currentPage: number;
  hasNextPage: boolean;
  scrollPosition?: number;
  timestamp: number; // Track when data was cached
}

@Injectable({
  providedIn: 'root',
})
export class ClientsStateService {
  private readonly STORAGE_KEY = 'clients_list_state';
  private readonly CACHE_DURATION = 30 * 60 * 1000; // 30 minutes cache

  private stateSubject = new BehaviorSubject<ClientsState | null>(null);
  public state$: Observable<ClientsState | null> = this.stateSubject.asObservable();

  constructor() {
    this.loadStateFromStorage();
  }

  /**
   * Save current state to localStorage and BehaviorSubject
   */
  saveState(state: Partial<ClientsState>): void {
    const currentState = this.stateSubject.value || this.getDefaultState();
    const newState: ClientsState = {
      ...currentState,
      ...state,
      timestamp: Date.now(),
    };

    try {
      this.stateSubject.next(newState);
      localStorage.setItem(
        this.STORAGE_KEY,
        JSON.stringify({
          ...newState,
          allCards: [],
          hasNextPage: false,
        } satisfies ClientsState),
      );
    } catch (error) {
      console.error('Error saving clients state to localStorage:', error);
    }
  }

  /**
   * Get current state
   */
  getState(): ClientsState | null {
    return this.stateSubject.value;
  }

  /**
   * Check if cached data is still valid
   */
  isCacheValid(): boolean {
    const state = this.stateSubject.value;
    if (!state || !state.timestamp) {
      return false;
    }

    const age = Date.now() - state.timestamp;
    return age < this.CACHE_DURATION;
  }

  /**
   * Clear state from storage
   */
  clearState(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
      this.stateSubject.next(null);
    } catch (error) {
      console.error('Error clearing clients state:', error);
    }
  }

  /**
   * Load state from localStorage
   */
  private loadStateFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const state = JSON.parse(stored) as ClientsState;

        // Check if cache is still valid
        if (this.isCacheValidForState(state)) {
          this.stateSubject.next(state);
        } else {
          // Cache expired, clear it
          this.clearState();
        }
      }
    } catch (error) {
      console.error('Error loading clients state from localStorage:', error);
      this.clearState();
    }
  }

  /**
   * Check if a specific state object is still valid
   */
  private isCacheValidForState(state: ClientsState): boolean {
    if (!state || !state.timestamp) {
      return false;
    }

    const age = Date.now() - state.timestamp;
    return age < this.CACHE_DURATION;
  }

  /**
   * Get default state
   */
  private getDefaultState(): ClientsState {
    return {
      allCards: [],
      activeFilter: 'my-clients',
      searchTerm: '',
      showOnlyFavorites: false,
      currentPage: 1,
      hasNextPage: false,
      scrollPosition: 0,
      timestamp: Date.now(),
    };
  }
}
