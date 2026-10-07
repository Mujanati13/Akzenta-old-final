import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { Shell } from '@app/shell/services/shell.service';
import { DashboardComponent } from '@pages/dashboard/dashboard.component';
import { FavoritesComponent } from '@pages/favorites/favorites.component';
import { NotificationsComponent } from '@pages/notifications/notifications.component';
import { PermissionGuard } from '@app/auth/guard/permission.guard';
import { ROLE } from '@app/auth/enums/roles.enum';
import { UnauthorizedComponent } from './unauthorized/unauthorized.component';
import { AnfragenComponent } from './anfragen/anfragen.component';
import { AllEntriesComponent } from './all-entries/all-entries.component';

const routes: Routes = [
  Shell.childRoutes([
    {
      path: 'dashboard',
      component: DashboardComponent,
    },
    {
      path: 'clients',
      loadChildren: () => import('./clients/clients.module').then((m) => m.ClientsModule),
    },
    {
      path: 'all-entries',
      component: AllEntriesComponent,
    },
    {
      path: 'anfragen',
      component: AnfragenComponent,
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
      path: 'unauthorized',
      component: UnauthorizedComponent,
    },

    { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
    // Fallback when no prior route is matched
    { path: '**', redirectTo: 'dashboard', pathMatch: 'full' },
  ]),
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class PagesRoutingModule {}
