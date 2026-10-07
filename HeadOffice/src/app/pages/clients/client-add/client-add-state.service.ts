import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { User } from '@app/pages/users/services/users.service';

interface ClientAddFormState {
  name: string;
  contactValue: string[];
  selectedContactUserIds: number[];
  selectedManagers: string[];
  selectedManagerUserIds: number[];
  logoPreview: string | null;
  fileName: string;
  logoFileType: string;
}

interface ClientAddState {
  clientUsers: User[];
  akzenteUsers: User[];
  formState: ClientAddFormState | null;
  timestamp: number;
}

@Injectable({
  providedIn: 'root',
})
export class ClientAddStateService {
  private readonly STORAGE_KEY = 'client_add_state';
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  private stateSubject = new BehaviorSubject<ClientAddState | null>(null);
  public state$: Observable<ClientAddState | null> = this.stateSubject.asObservable();

  constructor() {
    this.clearLegacyStorage();
  }

  /**
   * Save users data to cache
   */
  saveUsersData(clientUsers: User[], akzenteUsers: User[]): void {
    const currentState = this.stateSubject.value || this.getDefaultState();
    const newState: ClientAddState = {
      ...currentState,
      clientUsers,
      akzenteUsers,
      timestamp: Date.now(),
    };

    this.stateSubject.next(newState);
  }

  /**
   * Save form state temporarily (for navigation)
   */
  saveFormState(formState: ClientAddFormState): void {
    const currentState = this.stateSubject.value || this.getDefaultState();
    const newState: ClientAddState = {
      ...currentState,
      formState,
      timestamp: Date.now(),
    };

    this.stateSubject.next(newState);
  }

  /**
   * Get current state
   */
  getState(): ClientAddState | null {
    return this.stateSubject.value;
  }

  /**
   * Check if cached users data is still valid
   */
  isCacheValid(): boolean {
    const state = this.stateSubject.value;
    if (!state || !state.timestamp) {
      return false;
    }

    const age = Date.now() - state.timestamp;
    return age < this.CACHE_DURATION && state.clientUsers.length > 0 && state.akzenteUsers.length > 0;
  }

  /**
   * Clear state from storage
   */
  clearState(): void {
    this.clearLegacyStorage();
    this.stateSubject.next(null);
  }

  /**
   * Clear only form state, keep users cached
   */
  clearFormState(): void {
    const currentState = this.stateSubject.value;
    if (currentState) {
      const newState: ClientAddState = {
        ...currentState,
        formState: null,
        timestamp: Date.now(),
      };
      this.stateSubject.next(newState);
    }
  }

  /**
   * Check if a specific state object is still valid
   */
  private isCacheValidForState(state: ClientAddState): boolean {
    if (!state || !state.timestamp) {
      return false;
    }

    const age = Date.now() - state.timestamp;
    return age < this.CACHE_DURATION;
  }

  private clearLegacyStorage(): void {
    localStorage.removeItem(this.STORAGE_KEY);
  }

  /**
   * Get default state
   */
  private getDefaultState(): ClientAddState {
    return {
      clientUsers: [],
      akzenteUsers: [],
      formState: null,
      timestamp: Date.now(),
    };
  }
}
