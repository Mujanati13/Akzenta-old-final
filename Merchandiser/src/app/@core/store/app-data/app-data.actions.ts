import { createAction, props } from '@ngrx/store';
import { InitialData, InitialDataUser } from '@app/core/services/initializer.service';

// Load initial app data
export const loadInitialData = createAction('[App Data] Load Initial Data');

export const loadInitialDataSuccess = createAction('[App Data] Load Initial Data Success', props<{ data: InitialData }>());

export const loadInitialDataFailure = createAction('[App Data] Load Initial Data Failure', props<{ error: string }>());

// Update specific parts of app data
export const updateUser = createAction('[App Data] Update User', props<{ user: InitialDataUser }>());

// You can add more actions for other app data as needed
export const updateSettings = createAction('[App Data] Update Settings', props<{ settings: any }>());
