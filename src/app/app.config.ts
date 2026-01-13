import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZoneChangeDetection, APP_INITIALIZER, isDevMode } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideServiceWorker } from '@angular/service-worker';

import { routes } from './app.routes';
import { CustomViewRegistryService } from './services/custom-view-registry.service';
import { CUSTOM_VIEW_METADATA } from './custom-views';
import { PwaUpdateService } from './services/pwa-update.service';
import { count } from 'rxjs';

/**
 * Initialize custom view registry on app startup
 */
function initializeCustomViewRegistry(registry: CustomViewRegistryService): () => void {
  return () => {
    console.log('AppConfig: Initializing Custom View Registry with metadata...');
    registry.registerViews(CUSTOM_VIEW_METADATA);
  };
}

/**
 * Initialize PWA update service
 */
function initializePwaUpdates(updateService: PwaUpdateService): () => void {
  return () => {
    updateService.initialize();
  };
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000'
    }),
    // Initialize custom view registry
    {
      provide: APP_INITIALIZER,
      useFactory: initializeCustomViewRegistry,
      deps: [CustomViewRegistryService],
      multi: true
    },
    // Initialize PWA update service
    {
      provide: APP_INITIALIZER,
      useFactory: initializePwaUpdates,
      deps: [PwaUpdateService],
      multi: true
    }
  ]
};
