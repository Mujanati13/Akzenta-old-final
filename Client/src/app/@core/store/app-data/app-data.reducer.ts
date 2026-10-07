import { createReducer, on } from '@ngrx/store';
import * as AppDataActions from './app-data.actions';
import { initialAppDataState, AppDataState } from './app-data.model';

// Add this line to re-export the AppDataState interface
export type { AppDataState } from './app-data.model';

export const appDataReducer = createReducer(
  initialAppDataState,

  on(AppDataActions.loadInitialData, (state) => ({
    ...state,
    loading: true,
    error: null,
  })),

  on(AppDataActions.loadInitialDataSuccess, (state, { data }) => ({
    ...state,
    loading: false,
    user: data.user,
    currentClientCompany: data.clientCompanies && data.clientCompanies.length > 0 ? data.clientCompanies[0] : null,
    assignedProjects: data.assignedProjects || [], // Store assigned projects
    // You can add other data properties here
    initialDataLoaded: true,
  })),

  on(AppDataActions.loadInitialDataFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error,
  })),

  on(AppDataActions.updateUser, (state, { user }) => ({
    ...state,
    user,
  })),

  on(AppDataActions.updateCurrentClientCompany, (state, { clientCompany }) => ({
    ...state,
    currentClientCompany: clientCompany,
  })),

  on(AppDataActions.updateAssignedProjects, (state, { projects }) => ({
    ...state,
    assignedProjects: projects,
  })),

  on(AppDataActions.updateSettings, (state, { settings }) => ({
    ...state,
    settings,
  })),
);
