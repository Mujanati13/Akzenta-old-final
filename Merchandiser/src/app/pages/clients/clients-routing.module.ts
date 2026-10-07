import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ClientsComponent } from '@pages/clients/list/clients.component';
import { ClientDetailComponent } from './client-detail/client-detail.component';
import { ClientAddComponent } from './client-add/client-add.component';
import { ReportDetailComponent } from './report-detail/report-detail.component';
import { ReportEditComponent } from './report-edit/report-edit.component';

const routes: Routes = [
  {
    path: '',
    redirectTo: 'list',
    pathMatch: 'full',
  },
  {
    path: 'list',
    component: ClientsComponent,
  },
  {
    path: 'add',
    component: ClientAddComponent,
  },
  {
    path: ':clientId/edit',
    component: ClientAddComponent, // Using ClientAddComponent for edit
  },
  {
    path: ':clientId/projects/:projectId/reports/:reportID',
    component: ReportDetailComponent,
  },
  {
    path: ':clientId/projects/:projectId/edit-report/:reportID',
    component: ReportEditComponent,
  },
  {
    path: ':clientId/projects/:projectId',
    component: ClientDetailComponent,
  },
  {
    path: ':clientId',
    component: ClientDetailComponent,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ClientsRoutingModule {}
