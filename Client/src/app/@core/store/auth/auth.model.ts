// Auth state model
export interface AuthState {
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
  user: UserState | null;
}

export interface UserState {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
}

export const initialAuthState: AuthState = {
  isAuthenticated: false,
  loading: false,
  error: null,
  user: null,
};
