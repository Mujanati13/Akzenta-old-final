import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ClientsComponent } from '@pages/clients/list/clients.component';
import { ClientDetailComponent } from './client-detail/client-detail.component';
import { ClientAddComponent } from './client-add/client-add.component';
import { ProjectCreateComponent } from '@pages/projects/project-create/project-create.component';
import { ReportDetailComponent } from './report-detail/report-detail.component';
import { ReportEditComponent } from './report-edit/report-edit.component';
import { ClientEditComponent } from './client-edit/client-edit.component';
// Import the report component (you'll need to create or import this)
// import { ReportDetailComponent } from '@pages/reports/report-detail/report-detail.component';

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
    component: ClientEditComponent,
  },
  {
    path: ':clientId/projects/create',
    component: ProjectCreateComponent,
  },
  {
    path: ':clientId/projects/:projectId/reports/:reportID',
    component: ReportDetailComponent, // Replace with your report component when available
  },
  {
    path: ':clientId/projects/:projectId/edit-report/:reportID',
    component: ReportEditComponent, // Replace with your report component when available
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
