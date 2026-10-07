/// <reference types="@angular/localize" />

import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { environment } from '@env/environment';
import { enableProdMode } from '@angular/core';
import { hmrBootstrap } from './hmr';

const bootstrap = () => bootstrapApplication(AppComponent, appConfig);
if (environment.production) {
  enableProdMode();
  bootstrap().catch((err) => console.error(err));
} else {
  hmrBootstrap(import.meta, () => bootstrap().then((appRef) => ({ instance: appRef }) as any));
}
