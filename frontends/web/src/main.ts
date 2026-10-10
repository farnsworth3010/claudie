import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config.ts';
import { App } from './app/app.ts';

bootstrapApplication(App, appConfig).catch((err: unknown) => console.error(err));
