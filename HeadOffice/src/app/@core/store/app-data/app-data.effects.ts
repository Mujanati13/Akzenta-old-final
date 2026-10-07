import { Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { of } from 'rxjs';
import { map, mergeMap, catchError } from 'rxjs/operators';
import { InitializerService } from '@app/core/services/initializer.service';
import * as AppDataActions from './app-data.actions';

@Injectable()
export class AppDataEffects {
  constructor(
    private actions$: Actions,
    private initializerService: InitializerService,
  ) {}

  loadInitialData$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AppDataActions.loadInitialData),
      mergeMap(() =>
        this.initializerService.loadInitialAppData().pipe(
          map((data) => {
            if (!data) {
              return AppDataActions.loadInitialDataFailure({
                error: 'Failed to load initial data',
              });
            }
            return AppDataActions.loadInitialDataSuccess({ data });
          }),
          catchError((error) =>
            of(
              AppDataActions.loadInitialDataFailure({
                error: error.message || 'Failed to load initial data',
              }),
            ),
          ),
        ),
      ),
    ),
  );
}
