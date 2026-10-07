import { createSelector, createFeatureSelector } from '@ngrx/store';
import { AppDataState } from './app-data.model';

export const selectAppDataState = createFeatureSelector<AppDataState>('appData');

export const selectAppDataUser = createSelector(selectAppDataState, (state: AppDataState) => state.user);

export const selectAppDataSettings = createSelector(selectAppDataState, (state: AppDataState) => state.settings);

export const selectAppDataLoading = createSelector(selectAppDataState, (state: AppDataState) => state.loading);

export const selectAppDataError = createSelector(selectAppDataState, (state: AppDataState) => state.error);

export const selectInitialDataLoaded = createSelector(selectAppDataState, (state: AppDataState) => state.initialDataLoaded);

export const selectUserDisplayName = createSelector(selectAppDataUser, (user) => (user ? `${user.firstName} ${user.lastName}` : 'User'));

export const selectUserRole = createSelector(selectAppDataUser, (user) => user?.role?.name);

export const selectClientCompanies = createSelector(selectAppDataState, (state: AppDataState) => state.clientCompanies);
