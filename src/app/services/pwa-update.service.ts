import { Injectable, ApplicationRef } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { interval, concat } from 'rxjs';
import { first, filter } from 'rxjs/operators';

/**
 * Service to manage PWA updates
 * Checks for updates hourly and prompts users when new versions are available
 */
@Injectable({
  providedIn: 'root'
})
export class PwaUpdateService {
  constructor(
    private swUpdate: SwUpdate,
    private appRef: ApplicationRef
  ) {}

  /**
   * Initialize update checks
   * Checks for updates every hour after the app stabilizes
   */
  initialize(): void {
    if (!this.swUpdate.isEnabled) {
      console.log('Service Worker not enabled');
      return;
    }

    // Wait for app to stabilize before checking for updates
    const appIsStable$ = this.appRef.isStable.pipe(
      first(isStable => isStable === true)
    );

    // Check for updates every hour
    const everyHour$ = interval(60 * 60 * 1000);

    const everyHourOnceAppIsStable$ = concat(appIsStable$, everyHour$);

    everyHourOnceAppIsStable$.subscribe(async () => {
      try {
        const updateFound = await this.swUpdate.checkForUpdate();
        if (updateFound) {
          console.log('Update available');
        } else {
          console.log('Already on latest version');
        }
      } catch (err) {
        console.error('Failed to check for updates:', err);
      }
    });

    // Handle version updates
    this.swUpdate.versionUpdates
      .pipe(filter((evt): evt is VersionReadyEvent => evt.type === 'VERSION_READY'))
      .subscribe(evt => {
        this.promptUserToUpdate(evt);
      });

    // Handle unrecoverable state
    this.swUpdate.unrecoverable.subscribe(event => {
      console.error('Service Worker in unrecoverable state:', event.reason);
      this.notifyUserToReload();
    });
  }

  /**
   * Prompt user to update to new version
   */
  private promptUserToUpdate(evt: VersionReadyEvent): void {
    const currentVersion = evt.currentVersion.hash;
    const latestVersion = evt.latestVersion.hash;

    console.log(`New version available: ${latestVersion} (current: ${currentVersion})`);

    if (confirm('New version available. Load new version?')) {
      window.location.reload();
    }
  }

  /**
   * Notify user to reload due to unrecoverable error
   */
  private notifyUserToReload(): void {
    if (confirm('App error detected. Reload required.')) {
      window.location.reload();
    }
  }

  /**
   * Manually activate update
   */
  async activateUpdate(): Promise<void> {
    if (!this.swUpdate.isEnabled) {
      return;
    }

    try {
      await this.swUpdate.activateUpdate();
      window.location.reload();
    } catch (err) {
      console.error('Failed to activate update:', err);
    }
  }
}
