import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { ListComponent } from './list/list.component';
import { UserAddComponent } from './user-add/user-add.component';
import { UserEditComponent } from './user-edit/user-edit.component';
import { ImportsModule } from '@app/shared/imports';
import { DateRangePickerComponent } from '../../shared/components/date-range-picker/date-range-picker.component';
import { AppIconComponent } from '../../shared/app-icon.component';
import { FavoriteToggleComponent } from '../../shared/components/favorite-toggle/favorite-toggle.component';
import { SettingsButtonComponent } from '@app/components/settings-button/settings-button.component';
import { ContactPersonAddComponent } from './contact-person-add/contact-person-add.component';
import { ColumnFilterPopoverComponent } from '@app/shared/components/column-filter-popover/column-filter-popover.component';
import { ColumnFilterDialogComponent } from '@app/shared/components/column-filter-dialog/column-filter-dialog.component';
import { MobileFilterBottomSheetComponent } from '@app/shared/components/mobile-filter-bottom-sheet/mobile-filter-bottom-sheet.component';

@NgModule({
  declarations: [ListComponent, UserAddComponent, UserEditComponent, ContactPersonAddComponent],
  imports: [
    CommonModule,
    RouterModule,
    ImportsModule,
    DateRangePickerComponent,
    AppIconComponent,
    FavoriteToggleComponent,
    SettingsButtonComponent,
    ReactiveFormsModule,
    ColumnFilterPopoverComponent,
    ColumnFilterDialogComponent,
    MobileFilterBottomSheetComponent,
  ],
})
export class UsersModule {}
