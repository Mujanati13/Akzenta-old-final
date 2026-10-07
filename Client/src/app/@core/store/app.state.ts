import { ActionReducerMap, MetaReducer } from '@ngrx/store';
import { authReducer, AuthState } from './auth/auth.reducer';
import { appDataReducer, AppDataState } from './app-data/app-data.reducer';

// Define the shape of the entire application state
export interface AppState {
  auth: AuthState;
  appData: AppDataState;
  // Add more slices as needed
}

// Combine all reducers
export const reducers: ActionReducerMap<AppState> = {
  auth: authReducer,
  appData: appDataReducer,
  // Add more reducers as needed
};

// Optional: Add meta-reducers for things like logging, etc.
export const metaReducers: MetaReducer<AppState>[] = [];
