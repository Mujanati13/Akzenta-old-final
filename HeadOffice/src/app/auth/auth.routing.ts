import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { marker } from '@biesbjerg/ngx-translate-extract-marker';
import { LoginComponent } from '@app/auth/login/login.component';
import { ForgotPasswordComponent } from '@app/auth/forgot-password/forgot-password.component';
import { AlreadyLoggedCheckGuard } from '@app/auth/guard/authentication.guard';
import { LogoutComponent } from '@app/auth/logout/logout.component';

const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  {
    path: 'forgot-password',
    canActivate: [AlreadyLoggedCheckGuard],
    component: ForgotPasswordComponent,
    data: { title: 'Passwort vergessen' },
  },
  {
    path: 'password-change',
    canActivate: [AlreadyLoggedCheckGuard],
    component: ForgotPasswordComponent,
    data: { title: 'Passwort zurücksetzen' },
  },
  {
    path: 'login',
    canActivate: [AlreadyLoggedCheckGuard],
    component: LoginComponent,
    data: { title: marker('Login') },
  },
  {
    path: 'logout',
    component: LogoutComponent,
    data: { title: marker('Logout') },
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
  providers: [],
})
export class AuthRouting {}
