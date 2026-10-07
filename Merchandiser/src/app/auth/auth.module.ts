import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { AuthRouting } from '@app/auth/auth.routing';
import { LoginComponent } from '@app/auth/login/login.component';
import { LogoutComponent } from './logout/logout.component';
import { LanguageSelectorComponent } from '@app/i18n';
import { AppIconComponent } from '../shared/app-icon.component';
import { ImportsModule } from '@app/shared/imports';
import { PreloaderComponent } from '@app/shared/components/preloader/preloader.component';
import { RegisterComponent } from './register/register.component';
import { ProfileComponent } from './profile/profile.component';
import { ConfirmEmailComponent } from './confirm-email/confirm-email.component';
import { PasswordChangeComponent } from './password-change/password-change.component';
import { DatePickerComponent } from '@app/shared/components/date-picker/date-picker.component';
import { MultiImageUploadComponent } from '@app/shared/components/multi-image-upload/multi-image-upload.component';
@NgModule({
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslateModule,
    AuthRouting,
    FormsModule,
    LanguageSelectorComponent,
    AppIconComponent,
    ImportsModule,
    PreloaderComponent,
    DatePickerComponent,
    MultiImageUploadComponent,
  ],
  declarations: [LoginComponent, LogoutComponent, RegisterComponent, ProfileComponent, ConfirmEmailComponent, PasswordChangeComponent],
})
export class AuthModule {}
