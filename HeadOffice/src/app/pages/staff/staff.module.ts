import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { StaffRoutingModule } from './staff-routing.module';
import { StaffGridComponent } from './components/staff-grid/staff-grid.component';
import { StaffTableComponent } from './components/staff-table/staff-table.component';
import { StaffMapComponent } from './components/staff-map/staff-map.component';

import { AppIconComponent } from '@app/shared/app-icon.component';
import { DateRangePickerComponent } from '@app/shared/components/date-range-picker/date-range-picker.component';
import { FavoriteToggleComponent } from '@app/shared/components/favorite-toggle/favorite-toggle.component';
import { ImportsModule } from '@app/shared/imports';
import { StaffComponent } from './list/staff.component';
import { StaffDetailComponent } from './staff-detail/staff-detail.component';
import { MobileFilterBottomSheetComponent } from '@app/shared/components/mobile-filter-bottom-sheet/mobile-filter-bottom-sheet.component';

@NgModule({
  declarations: [
    // Only include non-standalone components here
    StaffComponent,
  ],
  imports: [
    CommonModule,
    FormsModule,
    StaffRoutingModule,
    ImportsModule,
    // Standalone components are imported
    AppIconComponent,
    DateRangePickerComponent,
    FavoriteToggleComponent,
    StaffGridComponent,
    StaffTableComponent,
    StaffMapComponent,
    StaffDetailComponent,
    MobileFilterBottomSheetComponent,
  ],
})
export class StaffModule {}
