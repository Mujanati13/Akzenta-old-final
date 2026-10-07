import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProjectsRoutingModule } from './projects-routing.module';
import { ProjectsComponent } from './projects.component';
import { ImportsModule } from '@app/shared/imports';
import { AppIconComponent } from '@app/shared/app-icon.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { TableModule } from 'primeng/table';
import { PopoverModule } from 'primeng/popover';
import { MultiSelectModule } from 'primeng/multiselect';
import { DialogModule } from 'primeng/dialog';
import { SidebarModule } from 'primeng/sidebar';
import { FavoriteToggleComponent } from '@app/shared/components/favorite-toggle/favorite-toggle.component';
import { DateRangePickerComponent } from '@app/shared/components/date-range-picker/date-range-picker.component';
import { DatePickerComponent } from '@app/shared/components/date-picker/date-picker.component';
import { ReportDetailComponent } from './report-detail/report-detail.component';
import { ImageUploadComponent } from '@app/shared/components/image-upload/image-upload.component';
import { MultiImageUploadComponent } from '@app/shared/components/multi-image-upload/multi-image-upload.component';
import { HttpClientModule } from '@angular/common/http';
import { ColumnFilterPopoverComponent } from '@app/shared/components/column-filter-popover/column-filter-popover.component';
import { ColumnFilterDialogComponent } from '@app/shared/components/column-filter-dialog/column-filter-dialog/column-filter-dialog.component';
import { MobileFilterSheetComponent } from '@app/shared/components/mobile-filter-sheet/mobile-filter-sheet.component';
import { MobileFilterBottomSheetComponent } from '@app/shared/components/mobile-filter-bottom-sheet/mobile-filter-bottom-sheet.component';

@NgModule({
  declarations: [ProjectsComponent, ReportDetailComponent],
  imports: [
    CommonModule,
    HttpClientModule,
    ProjectsRoutingModule,
    ImportsModule,
    FormsModule,
    DateRangePickerComponent,
    DatePickerComponent,
    RouterModule,
    ReactiveFormsModule,
    AppIconComponent,
    ImageUploadComponent,
    MultiImageUploadComponent,
    TableModule,
    PopoverModule,
    MultiSelectModule,
    DialogModule,
    SidebarModule,
    FavoriteToggleComponent, // Import standalone component
    ColumnFilterPopoverComponent,
    ColumnFilterDialogComponent,
    MobileFilterSheetComponent,
    MobileFilterBottomSheetComponent,
  ],
})
export class ProjectsModule {}
