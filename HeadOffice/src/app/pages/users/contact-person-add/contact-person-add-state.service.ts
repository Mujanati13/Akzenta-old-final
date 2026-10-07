import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

interface ContactPersonFormState {
  gender: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  timestamp: number;
}

@Injectable({
  providedIn: 'root',
})
export class ContactPersonAddStateService {
  private readonly STORAGE_KEY = 'contact_person_add_state';
  private readonly CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

  private stateSubject = new BehaviorSubject<ContactPersonFormState | null>(null);
  public state$: Observable<ContactPersonFormState | null> = this.stateSubject.asObservable();

  constructor() {
    this.clearLegacyStorage();
  }

  /**
   * Save form state
   */
  saveFormState(formState: Partial<ContactPersonFormState>): void {
    const currentState = this.stateSubject.value || this.getDefaultState();
    const newState: ContactPersonFormState = {
      ...currentState,
      ...formState,
      timestamp: Date.now(),
    };

    this.stateSubject.next(newState);
  }

  /**
   * Get current state
   */
  getState(): ContactPersonFormState | null {
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
    this.clearLegacyStorage();
    this.stateSubject.next(null);
  }

  /**
   * Check if a specific state object is still valid
   */
  private isCacheValidForState(state: ContactPersonFormState): boolean {
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
  private getDefaultState(): ContactPersonFormState {
    return {
      gender: '',
      firstName: '',
      lastName: '',
      phone: '',
      email: '',
      timestamp: Date.now(),
    };
  }
}
