import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZoneChangeDetection, APP_INITIALIZER } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';

import { routes } from './app.routes';
import { CustomViewRegistryService } from './services/custom-view-registry.service';
import { CUSTOM_VIEW_METADATA } from './custom-views';

/**
 * Initialize custom view registry on app startup
 */
function initializeCustomViewRegistry(registry: CustomViewRegistryService): () => void {
  return () => {
    registry.registerViews(CUSTOM_VIEW_METADATA);
  };
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(),
    // Initialize custom view registry
    {
      provide: APP_INITIALIZER,
      useFactory: initializeCustomViewRegistry,
      deps: [CustomViewRegistryService],
      multi: true
    }
  ]
};
