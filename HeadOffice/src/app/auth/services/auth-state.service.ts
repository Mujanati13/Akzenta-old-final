import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export enum AuthState {
  CHECKING = 'checking',
  AUTHENTICATED = 'authenticated',
  NOT_AUTHENTICATED = 'not-authenticated',
}

@Injectable({
  providedIn: 'root',
})
export class AuthStateService {
  private _authState = new BehaviorSubject<AuthState>(AuthState.CHECKING);

  public get authState$(): Observable<AuthState> {
    return this._authState.asObservable();
  }

  public get currentAuthState(): AuthState {
    return this._authState.getValue();
  }

  setAuthState(state: AuthState): void {
    this._authState.next(state);
  }
}
