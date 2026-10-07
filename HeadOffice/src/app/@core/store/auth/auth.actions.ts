import { createAction, props } from '@ngrx/store';
import { UserState } from './auth.model';

// Login actions
export const login = createAction('[Auth] Login', props<{ email: string; password: string; rememberMe: boolean }>());

export const loginSuccess = createAction('[Auth] Login Success', props<{ user: UserState }>());

export const loginFailure = createAction('[Auth] Login Failure', props<{ error: string }>());

// Logout actions
export const logout = createAction('[Auth] Logout');
export const logoutSuccess = createAction('[Auth] Logout Success');
export const logoutFailure = createAction('[Auth] Logout Failure', props<{ error: string }>());

// Token refresh actions
export const refreshToken = createAction('[Auth] Refresh Token');
export const refreshTokenSuccess = createAction('[Auth] Refresh Token Success');
export const refreshTokenFailure = createAction('[Auth] Refresh Token Failure', props<{ error: string }>());

// User data actions
export const updateUser = createAction('[Auth] Update User', props<{ user: UserState }>());

// Load user data from token or initial data
export const loadUser = createAction('[Auth] Load User');
export const loadUserSuccess = createAction('[Auth] Load User Success', props<{ user: UserState }>());
export const loadUserFailure = createAction('[Auth] Load User Failure', props<{ error: string }>());
