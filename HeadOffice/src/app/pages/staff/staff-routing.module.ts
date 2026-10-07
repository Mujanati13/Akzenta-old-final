import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { StaffComponent } from './list/staff.component';
import { StaffDetailComponent } from './staff-detail/staff-detail.component';
import { StaffEditComponent } from './staff-edit/staff-edit.component';

const routes: Routes = [
  {
    path: '',
    component: StaffComponent,
  },
  {
    path: ':id',
    component: StaffDetailComponent,
  },
  {
    path: ':id/edit',
    component: StaffEditComponent,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class StaffRoutingModule {}
