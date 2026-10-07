import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { Shell } from '@app/shell/services/shell.service';
import { DashboardComponent } from '@pages/dashboard/dashboard.component';
import { FavoritesComponent } from '@pages/favorites/favorites.component';
import { NotificationsComponent } from '@pages/notifications/notifications.component';
import { UnauthorizedComponent } from './unauthorized/unauthorized.component';
import { ContactComponent } from './contact/contact.component';
import { FilialeSuchenComponent } from './filiale-suchen/filiale-suchen.component';

const routes: Routes = [
  Shell.childRoutes([
    {
      path: 'dashboard',
      component: DashboardComponent,
    },
    // Projects routes for client app - direct project access
    {
      path: 'projects',
      loadChildren: () => import('./projects/projects.module').then((m) => m.ProjectsModule),
    },
    // Keep the clients module for handling all client-related routes (for backward compatibility)
    {
      path: 'filiale-suchen',
      component: FilialeSuchenComponent,
    },
    {
      path: 'favorites',
      component: FavoritesComponent,
    },
    {
      path: 'contact',
      component: ContactComponent,
    },
    {
      path: 'notifications',
      component: NotificationsComponent,
    },
    {
      path: 'unauthorized',
      component: UnauthorizedComponent,
    },

    // Fallback when no prior route is matched
    { path: '**', redirectTo: '', pathMatch: 'full' },
  ]),
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class PagesRoutingModule {}
