import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProjectsRoutingModule } from './projects-routing.module'; // Uncomment this line
import { ProjectCreateComponent } from './project-create/project-create.component';
import { ImportsModule } from '@app/shared/imports';
import { AppIconComponent } from '@app/shared/app-icon.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    ProjectsRoutingModule, // Uncomment this line
    ImportsModule,
    FormsModule,
    RouterModule,
    ReactiveFormsModule,
    ProjectCreateComponent, // Import standalone component
    AppIconComponent,
  ],
})
export class ProjectsModule {}
