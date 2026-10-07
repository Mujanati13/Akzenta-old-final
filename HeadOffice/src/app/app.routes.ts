import { Routes } from '@angular/router';
import { Shell } from '@app/shell/services/shell.service';

export const routes: Routes = [
  // Auth routes (login, etc)
  {
    path: '',
    loadChildren: () => import('@app/auth/auth.module').then((m) => m.AuthModule),
  },

  // Fallback route
  { path: '**', redirectTo: '', pathMatch: 'full' },
];
