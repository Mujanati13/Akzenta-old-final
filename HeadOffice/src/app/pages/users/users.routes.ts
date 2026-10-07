import { Routes } from '@angular/router';
import { ListComponent } from './list/list.component';
import { UserAddComponent } from './user-add/user-add.component';
import { UserEditComponent } from './user-edit/user-edit.component';
import { ContactPersonAddComponent } from './contact-person-add/contact-person-add.component';

export const USERS_ROUTES: Routes = [
  {
    path: '',
    redirectTo: 'list',
    pathMatch: 'full',
  },
  {
    path: 'list',
    component: ListComponent,
  },
  {
    path: 'add',
    component: UserAddComponent,
  },
  {
    path: 'edit/:id',
    component: UserEditComponent,
  },
  {
    path: 'contact/add/:client',
    component: ContactPersonAddComponent,
  },
  {
    path: 'contact/add',
    component: ContactPersonAddComponent,
  },
];
