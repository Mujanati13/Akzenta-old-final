import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { marker } from '@biesbjerg/ngx-translate-extract-marker';
import { LoginComponent } from '@app/auth/login/login.component';
import { AlreadyLoggedCheckGuard, AuthenticationGuard } from '@app/auth/guard/authentication.guard';
import { LogoutComponent } from '@app/auth/logout/logout.component';
import { RegisterComponent } from './register/register.component';
import { PermissionGuard } from './guard/permission.guard';
import { ProfileComponent } from './profile/profile.component';
import { ConfirmEmailComponent } from './confirm-email/confirm-email.component';
import { PasswordChangeComponent } from './password-change/password-change.component';

const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  {
    path: 'login',
    canActivate: [AlreadyLoggedCheckGuard],
    component: LoginComponent,
    data: { title: marker('Login') },
  },
  {
    path: 'confirm-email',
    component: ConfirmEmailComponent,
    data: { title: marker('E-Mail bestätigen') },
  },
  {
    path: 'register',
    canActivate: [AlreadyLoggedCheckGuard],
    component: RegisterComponent,
    data: { title: marker('register') },
  },
  {
    path: 'profile',
    canActivate: [AuthenticationGuard, PermissionGuard],
    component: ProfileComponent,
    data: { title: marker('Profile') },
  },
  {
    path: 'logout',
    component: LogoutComponent,
    data: { title: marker('Logout') },
  },
  {
    path: 'password-change',
    component: PasswordChangeComponent,
    data: { title: marker('Passwort ändern') },
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
  providers: [],
})
export class AuthRouting {}
