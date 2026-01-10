import { Component, inject, effect, signal, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { QrwcAdapterService } from '../../services/qrwc-adapter.service';
import { LanguageSelector } from '../language-selector/language-selector';
import { VolumeControl } from '../volume-control/volume-control';
import { VideoSource } from '../video-source/video-source';
import { CamerasCard } from '../cameras-card/cameras-card';
import { QsysCamerasCard } from '../qsys-cameras-card/qsys-cameras-card';
import { PowerCard } from '../power-card/power-card';
import { HelpCard } from '../help-card/help-card';

type PageType = 'video-source' | 'cameras' | 'qsys-cameras' | 'help' | null;

@Component({
  selector: 'app-base-page',
  imports: [
    CommonModule,
    LanguageSelector,
    VolumeControl,
    VideoSource,
    CamerasCard,
    QsysCamerasCard,
    PowerCard,
    HelpCard
  ],
  templateUrl: './base-page.html',
  styleUrl: './base-page.css',
})
export class BasePage {
  readonly qrwc = inject(QrwcAdapterService);
  private readonly router = inject(Router);
  readonly roomName = signal('Room');
  readonly currentPage = signal<PageType>('video-source');
  readonly showPowerCard = signal(false);
  readonly pageNames = signal<string[]>(['Video Source', 'Cameras', 'Help']);
  readonly onNavigateToSplash = output<void>();

  constructor() {
    // Bind to Q-SYS UCI Text Helper for room name and page names
    effect(() => {
      const component = this.qrwc.components()?.['UCI Text Helper'];
      if (!component) return;

      const roomNameControl = component.controls['RoomName'];
      if (roomNameControl) {
        this.roomName.set(roomNameControl.state.String ?? 'Room');
        roomNameControl.on('update', (state) => {
          this.roomName.set(state.String ?? 'Room');
        });
      }

      const pageNamesControl = component.controls['PageNames'];
      if (pageNamesControl && pageNamesControl.state.Choices) {
        this.pageNames.set(pageNamesControl.state.Choices);
        pageNamesControl.on('update', (state) => {
          if (state.Choices) {
            this.pageNames.set(state.Choices);
          }
        });
      }
    });

    // If video source selection becomes unavailable and we're on that page, switch to another page
    effect(() => {
      if (!this.qrwc.hasVideoSourceSelection() && this.currentPage() === 'video-source') {
        // Try cameras first, then help
        if (this.qrwc.hasCameraControls()) {
          this.currentPage.set('cameras');
        } else {
          this.currentPage.set('help');
        }
      }
    });

    // If camera controls become unavailable and we're on that page, switch to another page
    effect(() => {
      if (!this.qrwc.hasCameraControls() && this.currentPage() === 'cameras') {
        // Try video source first, then help
        if (this.qrwc.hasVideoSourceSelection()) {
          this.currentPage.set('video-source');
        } else {
          this.currentPage.set('help');
        }
      }
    });

    // If ONVIF cameras become unavailable and we're on that page, switch to another page
    effect(() => {
      if (!this.qrwc.hasOnvifCameras() && this.currentPage() === 'qsys-cameras') {
        // Try video source first, then cameras, then help
        if (this.qrwc.hasVideoSourceSelection()) {
          this.currentPage.set('video-source');
        } else if (this.qrwc.hasCameraControls()) {
          this.currentPage.set('cameras');
        } else {
          this.currentPage.set('help');
        }
      }
    });
  }

  navigateToPage(page: PageType): void {
    this.currentPage.set(page);
  }

  togglePowerCard(): void {
    this.showPowerCard.update(val => !val);
  }

  closePowerCard(): void {
    this.showPowerCard.set(false);
  }

  getCurrentPageName(): string {
    const pages = this.pageNames();
    let index = 2; // Default to help

    if (this.currentPage() === 'video-source') {
      index = 0;
    } else if (this.currentPage() === 'cameras') {
      index = 1;
    } else if (this.currentPage() === 'qsys-cameras') {
      // Use index 1 for qsys-cameras (same as cameras) or create a custom name
      return pages[1] || 'Q-SYS Cameras';
    } else if (this.currentPage() === 'help') {
      index = 2;
    }

    return pages[index] || this.currentPage() || 'Video Source';
  }

  navigateToMenu(): void {
    this.router.navigate(['/']);
  }

  navigateToSplash(): void {
    this.onNavigateToSplash.emit();
  }
}
