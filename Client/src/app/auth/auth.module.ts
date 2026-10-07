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

@NgModule({
  imports: [CommonModule, ReactiveFormsModule, TranslateModule, AuthRouting, FormsModule, LanguageSelectorComponent, AppIconComponent, ImportsModule, PreloaderComponent],
  declarations: [LoginComponent, LogoutComponent],
})
export class AuthModule {}
