import { inject } from '@angular/core';
import { AppInitializationService } from '../services/app-initialization.service';

/**
 * Helper function to wait for app initialization to complete.
 * Use this in custom view components before accessing Q-SYS services.
 *
 * @example
 * ```typescript
 * export class MyCustomViewComponent implements OnInit {
 *   ngOnInit(): void {
 *     waitForAppInit().then(() => {
 *       // Safe to use Q-SYS services here
 *       this.loadData();
 *     });
 *   }
 * }
 * ```
 *
 * @param appInit - Optional AppInitializationService instance.
 *                  If not provided, will be injected automatically.
 * @param timeoutMs - Maximum time to wait (default: 30000ms)
 * @returns Promise that resolves when initialization is complete
 */
export function waitForAppInit(
  appInit?: AppInitializationService,
  timeoutMs: number = 30000
): Promise<void> {
  const service = appInit ?? inject(AppInitializationService);

  return new Promise((resolve, reject) => {
    // Already complete
    if (service.initializationComplete()) {
      resolve();
      return;
    }

    const startTime = Date.now();
    const checkInterval = setInterval(() => {
      if (service.initializationComplete()) {
        clearInterval(checkInterval);
        resolve();
        return;
      }

      // Check for timeout
      if (Date.now() - startTime > timeoutMs) {
        clearInterval(checkInterval);
        reject(new Error(`App initialization timed out after ${timeoutMs}ms`));
      }
    }, 100);
  });
}

/**
 * Creates a waitForAppInit function bound to a specific service instance.
 * Useful when you can't use inject() (e.g., outside injection context).
 *
 * @example
 * ```typescript
 * export class MyComponent {
 *   private waitForInit = createWaitForAppInit(this.appInit);
 *
 *   constructor(private appInit: AppInitializationService) {}
 *
 *   ngOnInit(): void {
 *     this.waitForInit().then(() => this.loadData());
 *   }
 * }
 * ```
 */
export function createWaitForAppInit(
  appInit: AppInitializationService,
  timeoutMs: number = 30000
): () => Promise<void> {
  return () => waitForAppInit(appInit, timeoutMs);
}
