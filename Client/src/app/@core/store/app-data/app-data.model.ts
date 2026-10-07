import { InitialDataUser, ClientCompany } from '@app/core/services/initializer.service';

export interface AppDataState {
  user: InitialDataUser | null;
  currentClientCompany: ClientCompany | null;
  assignedProjects: any[]; // Add assigned projects for the client app
  // Add other app data properties here
  settings: any | null;
  loading: boolean;
  error: string | null;
  initialDataLoaded: boolean;
}

export const initialAppDataState: AppDataState = {
  user: null,
  currentClientCompany: null,
  assignedProjects: [], // Initialize empty array
  settings: null,
  loading: false,
  error: null,
  initialDataLoaded: false,
};
