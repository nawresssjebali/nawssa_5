// src/main.server.ts
import { enableProdMode } from '@angular/core';
import { environment } from './environments/environment';
import { platformServer, renderModule } from '@angular/platform-server';
import { AppServerModule } from './app/app.server.module';

if (environment.production) {
  enableProdMode();
}

export { AppServerModule };
