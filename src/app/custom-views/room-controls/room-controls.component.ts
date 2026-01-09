import { Component, signal, effect, inject, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CustomViewBase } from '../../components/custom-views/base/custom-view-base.component';
import { ControlSelectionConfig } from '../../models/custom-view.model';
import { SplashPage } from './components/splash-page/splash-page';
import { BasePage } from './components/base-page/base-page';
import { QrwcAdapterService } from './services/qrwc-adapter.service';
import { QSysService } from '../../services/qsys.service';
import { QSysBrowserService } from '../../services/qsys-browser.service';
import { IControlState } from '@q-sys/qrwc';

@Component({
  selector: 'app-room-controls',
  imports: [
    CommonModule,
    SplashPage,
    BasePage
  ],
  templateUrl: './room-controls.component.html',
  styleUrl: './room-controls.component.css',
  providers: [QrwcAdapterService],
  encapsulation: ViewEncapsulation.None
})
export class RoomControlsComponent extends CustomViewBase {
  protected readonly showSplash = signal(true);
  protected readonly adapter = inject(QrwcAdapterService);

  constructor() {
    super(inject(QSysService), inject(QSysBrowserService));

    // Monitor system power state and show splash when powered off
    effect(() => {
      const component = this.adapter.components()?.['Room Controls'];
      if (!component) return;

      const systemOffControl = component.controls['SystemOff'];
      if (!systemOffControl) return;

      // If system is powered off, show splash page
      if (systemOffControl.state.Bool) {
        this.showSplash.set(true);
      }

      systemOffControl.on('update', (state: IControlState) => {
        if (state.Bool) {
          this.showSplash.set(true);
        }
      });
    });
  }

  protected getControlSelectionConfig(): ControlSelectionConfig[] {
    // We don't use the standard control selection - the adapter service handles component discovery
    return [];
  }

  /**
   * Override loadControls to bypass standard control loading
   * Room controls uses the QrwcAdapterService for direct component access
   */
  protected override async loadControls(): Promise<void> {
    console.log('✓ Room controls initialized - using QrwcAdapterService for component access');
    // No standard control loading needed - components accessed via adapter service
  }

  protected navigateToBase(): void {
    this.showSplash.set(false);
  }

  protected navigateToSplash(): void {
    this.showSplash.set(true);
  }
}
