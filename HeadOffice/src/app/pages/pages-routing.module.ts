import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { Shell } from '@app/shell/services/shell.service';
import { lazyLoadChildren } from '@core/helpers';
import { USERS_ROUTES } from './users/users.routes';
import { DashboardComponent } from '@pages/dashboard/dashboard.component';
import { FavoritesComponent } from '@pages/favorites/favorites.component';
import { NotificationsComponent } from '@pages/notifications/notifications.component';
import { FilialeSuchenComponent } from '@pages/filiale-suchen/filiale-suchen.component';
// import { PermissionGuard } from '@app/auth/guard/permission.guard';
// import { ROLE } from '@app/auth/enums/roles.enum';
import { UnauthorizedComponent } from './unauthorized/unauthorized.component';
import { environment } from '@env/environment';
import { devOnlyGuard } from './dev/dev-only.guard';
import { EmailTemplatesComponent } from './dev/email-templates/email-templates.component';

const routes: Routes = [
  Shell.childRoutes([
    {
      path: 'dashboard',
      component: DashboardComponent,
    },
    {
      path: 'clients',
      loadChildren: lazyLoadChildren(() => import('./clients/clients.module').then((m) => m.ClientsModule)),
      // canActivate: [PermissionGuard],
      // data: { roles: [ROLE.ADMIN, ROLE.USER] } // Example: Only admins and users can access
    },
    {
      path: 'users',
      children: USERS_ROUTES,
      // canActivate: [PermissionGuard],
      // data: { roles: [ROLE.ADMIN] }
    },
    {
      path: 'staff',
      loadChildren: lazyLoadChildren(() => import('./staff/staff.module').then((m) => m.StaffModule)),
      // canActivate: [PermissionGuard],
      // data: { roles: [ROLE.ADMIN, ROLE.USER] } // Example: Only admins and users can access
    },
    {
      path: 'projects',
      loadChildren: lazyLoadChildren(() => import('./projects/projects.module').then((m) => m.ProjectsModule)),
      // canActivate: [PermissionGuard],
      // data: { roles: [ROLE.ADMIN, ROLE.USER, ROLE.MEMBER] } // Example: These roles can access
    },
    {
      path: 'favorites',
      component: FavoritesComponent,
    },
    {
      path: 'notifications',
      component: NotificationsComponent,
    },
    {
      path: 'filiale-suchen',
      component: FilialeSuchenComponent,
    },
    {
      path: 'unauthorized',
      component: UnauthorizedComponent,
    },
    ...(environment.production
      ? []
      : [
          {
            path: 'dev/email-templates',
            component: EmailTemplatesComponent,
            canActivate: [devOnlyGuard],
            data: { title: 'E-Mail-Vorlagen (Dev)' },
          },
        ]),

    // Fallback when no prior route is matched
    { path: '**', redirectTo: '', pathMatch: 'full' },
  ]),
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class PagesRoutingModule {}
