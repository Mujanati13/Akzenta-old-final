import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { USERS_ROUTES } from './users.routes';

@NgModule({
  imports: [RouterModule.forChild(USERS_ROUTES)],
  exports: [RouterModule],
})
export class UsersRoutingModule {}
