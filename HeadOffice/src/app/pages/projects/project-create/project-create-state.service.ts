import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

interface ProjectCreateFormState {
  clientId: number | null;
  projectName: string;
  startDate: Date | null;
  endDate: Date | null;
  dateRange2: { start: Date | null; end: Date | null };
  clientContactValue: string[];
  salesContactValue: string[];
  selectedClientUserIds: number[];
  selectedSalesUserIds: number[];
  questions: any[];
  photosConfigEnabled: boolean;
  photosVisibleInReport: boolean;
  photoStyle: string;
  beforeImageCount: number;
  afterImageCount: number;
  beforeImagesUnlimited: boolean;
  afterImagesUnlimited: boolean;
  photoImageNamePattern: string;
  extendedPhotosVisibleInReport: boolean;
  photoSections: any[];
  activeAccordionValue: string[];
  timestamp: number;
}

@Injectable({
  providedIn: 'root',
})
export class ProjectCreateStateService {
  private readonly STORAGE_KEY = 'project_create_state';
  private readonly CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

  private stateSubject = new BehaviorSubject<ProjectCreateFormState | null>(null);
  public state$: Observable<ProjectCreateFormState | null> = this.stateSubject.asObservable();

  constructor() {
    this.clearLegacyStorage();
  }

  /**
   * Save form state
   */
  saveFormState(formState: Partial<ProjectCreateFormState>): void {
    const currentState = this.stateSubject.value || this.getDefaultState();
    const newState: ProjectCreateFormState = {
      ...currentState,
      ...formState,
      timestamp: Date.now(),
    };

    this.stateSubject.next(newState);
  }

  /**
   * Get current state
   */
  getState(): ProjectCreateFormState | null {
    return this.stateSubject.value;
  }

  /**
   * Check if cached data is still valid
   */
  isCacheValid(): boolean {
    return this.isCacheValidForClient();
  }

  /**
   * Check if cached data is valid for a specific client
   */
  isCacheValidForClient(clientId?: number | null): boolean {
    const state = this.stateSubject.value;
    if (!state || !state.timestamp) {
      return false;
    }

    if (clientId !== undefined && state.clientId !== clientId) {
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
  private isCacheValidForState(state: ProjectCreateFormState): boolean {
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
  private getDefaultState(): ProjectCreateFormState {
    return {
      clientId: null,
      projectName: '',
      startDate: null,
      endDate: null,
      dateRange2: { start: null, end: null },
      clientContactValue: [],
      salesContactValue: [],
      selectedClientUserIds: [],
      selectedSalesUserIds: [],
      questions: [],
      photosConfigEnabled: false,
      photosVisibleInReport: true,
      photoStyle: '',
      beforeImageCount: 1,
      afterImageCount: 1,
      beforeImagesUnlimited: false,
      afterImagesUnlimited: false,
      photoImageNamePattern: '',
      extendedPhotosVisibleInReport: true,
      photoSections: [],
      activeAccordionValue: ['0', '1', '2', '3'],
      timestamp: Date.now(),
    };
  }
}
