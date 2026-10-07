import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
  },
  // Auth routes (login, register, etc.)
  {
    path: '',
    loadChildren: () => import('@app/auth/auth.module').then((m) => m.AuthModule),
  },
  // Fallback route
  { path: '**', redirectTo: 'login', pathMatch: 'full' },
];
