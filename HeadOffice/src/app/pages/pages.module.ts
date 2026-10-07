import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { PagesRoutingModule } from './pages-routing.module';
import { UsersModule } from './users/users.module';

@NgModule({
  declarations: [],
  imports: [CommonModule, PagesRoutingModule, UsersModule],
})
export class PagesModule {}
