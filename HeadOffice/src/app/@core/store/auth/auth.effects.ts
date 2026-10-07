import { Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { of } from 'rxjs';
import { map, mergeMap, catchError, tap, switchMap } from 'rxjs/operators';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import * as AuthActions from './auth.actions';
import * as AppDataActions from '../app-data/app-data.actions';
import { AuthenticationService } from '@app/auth/services/authentication.service';
import { ROLE } from '@app/auth/enums/roles.enum';

@Injectable()
export class AuthEffects {
  constructor(
    private actions$: Actions,
    private authService: AuthenticationService,
    private router: Router,
    private store: Store,
  ) {}

  login$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.login),
      mergeMap(({ email, password, rememberMe }) =>
        this.authService
          .login({
            username: email,
            password: password,
            remember: rememberMe,
          })
          .pipe(
            map((credentials) => {
              const user = {
                id: credentials.id,
                email: credentials.email || credentials.username,
                firstName: credentials.firstName || '',
                lastName: credentials.lastName || '',
                role: credentials.roles[0] || ROLE.GUEST,
              };

              this.store.dispatch(AppDataActions.loadInitialData());

              return AuthActions.loginSuccess({ user });
            }),
            catchError((error) =>
              of(
                AuthActions.loginFailure({
                  error: error.message || 'Login failed',
                }),
              ),
            ),
          ),
      ),
    ),
  );

  loginSuccess$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(AuthActions.loginSuccess),
        tap(({ user }) => {
          // Navigate to dashboard or saved return URL
          const returnUrl = sessionStorage.getItem('returnUrl') || '/dashboard';
          sessionStorage.removeItem('returnUrl');
          this.router.navigateByUrl(returnUrl);
        }),
      ),
    { dispatch: false },
  );

  logout$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.logout),
      mergeMap(() =>
        this.authService.logout().pipe(
          map(() => AuthActions.logoutSuccess()),
          catchError(() => of(AuthActions.logoutSuccess())),
        ),
      ),
    ),
  );

  logoutSuccess$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(AuthActions.logoutSuccess),
        tap(() => {
          // Navigate to login page
          this.router.navigate(['/login']);
        }),
      ),
    { dispatch: false },
  );

  refreshToken$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.refreshToken),
      switchMap(() => {
        return this.authService.refreshToken().pipe(
          map(() => AuthActions.refreshTokenSuccess()),
          catchError((error) =>
            of(
              AuthActions.refreshTokenFailure({
                error: error.message || 'Token refresh failed',
              }),
            ),
          ),
        );
      }),
    ),
  );
}
