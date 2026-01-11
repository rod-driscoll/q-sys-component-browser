import { Component, inject, effect, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { QrwcAdapterService } from '../../room-controls/services/qrwc-adapter.service';

interface CameraCard {
  componentName: string;
  displayName: string;
  previewUrl: string | null;
  privacyOn: boolean;
}

@Component({
  selector: 'app-qsys-cameras-card',
  imports: [CommonModule],
  templateUrl: './qsys-cameras-card.html',
  styleUrl: './qsys-cameras-card.css',
})
export class QsysCamerasCard {
  readonly qrwc = inject(QrwcAdapterService);
  readonly cameraCards = signal<CameraCard[]>([]);

  constructor() {
    // Discover ONVIF cameras and create camera cards
    effect(() => {
      const components = this.qrwc.components();
      console.log('[QsysCamerasCard] Checking for ONVIF camera components...', {
        hasComponents: !!components,
        componentNames: components ? Object.keys(components) : []
      });

      if (!components) {
        this.cameraCards.set([]);
        return;
      }

      const cards: CameraCard[] = [];

      // Find all components of type 'onvif_camera_operative'
      for (const componentName in components) {
        const component = components[componentName];

        // Check if this is an ONVIF camera by looking for specific controls
        // ONVIF cameras should have pan/tilt/zoom controls
        if (component.controls['pan.left'] || component.controls['tilt.up'] || component.controls['zoom.in']) {
          console.log(`[QsysCamerasCard] Found ONVIF camera: ${componentName}`);

          const card: CameraCard = {
            componentName: componentName,
            displayName: componentName,
            previewUrl: null,
            privacyOn: false
          };

          // Set initial privacy state
          const privacyControl = component.controls['toggle.privacy'];
          if (privacyControl) {
            card.privacyOn = privacyControl.state.Bool ?? false;
          }

          // Set initial preview URL
          const jpegControl = component.controls['jpeg.data'];
          if (jpegControl && jpegControl.state.String) {
            card.previewUrl = this.parseJpegData(jpegControl.state.String);
          }

          cards.push(card);
        }
      }

      if (cards.length > 0) {
        console.log(`[QsysCamerasCard] Found ${cards.length} ONVIF cameras:`, cards);
        this.cameraCards.set(cards);

        // Set up listeners for each camera
        this.setupCameraListeners();
      } else {
        console.log('[QsysCamerasCard] No ONVIF cameras found');
        this.cameraCards.set([]);
      }
    });
  }

  /**
   * Set up event listeners for all camera controls
   */
  private setupCameraListeners(): void {
    const components = this.qrwc.components();
    if (!components) return;

    for (const card of this.cameraCards()) {
      const component = components[card.componentName];
      if (!component) continue;

      // Subscribe to privacy control updates
      const privacyControl = component.controls['toggle.privacy'];
      if (privacyControl) {
        privacyControl.on('update', (state) => {
          this.updateCameraCard(card.componentName, { privacyOn: state.Bool ?? false });
        });
      }

      // Subscribe to jpeg.data control updates
      const jpegControl = component.controls['jpeg.data'];
      if (jpegControl) {
        jpegControl.on('update', (state) => {
          const previewUrl = this.parseJpegData(state.String);
          this.updateCameraCard(card.componentName, { previewUrl });
        });
      }
    }
  }

  /**
   * Update a specific camera card's properties
   */
  private updateCameraCard(componentName: string, updates: Partial<CameraCard>): void {
    this.cameraCards.update(cards => {
      return cards.map(card =>
        card.componentName === componentName
          ? { ...card, ...updates }
          : card
      );
    });
  }

  /**
   * Parse jpeg.data control JSON and extract base64 image
   */
  private parseJpegData(jsonString: string | undefined): string | null {
    if (!jsonString) return null;

    try {
      const data = JSON.parse(jsonString);
      if (data.IconData && typeof data.IconData === 'string') {
        return `data:image/jpeg;base64,${data.IconData}`;
      }
    } catch (error) {
      console.error('[QsysCamerasCard] Failed to parse jpeg.data JSON:', error);
    }
    return null;
  }

  /**
   * Toggle privacy for a specific camera
   */
  togglePrivacy(cameraName: string): void {
    const component = this.qrwc.components()?.[cameraName];
    if (!component) return;

    const control = component.controls['toggle.privacy'];
    if (!control) return;

    const currentCard = this.cameraCards().find(c => c.componentName === cameraName);
    if (!currentCard) return;

    // Toggle privacy state
    control.update(!currentCard.privacyOn);
  }

  /**
   * Activate a control on a specific camera (press and hold start)
   */
  activateControl(cameraName: string, controlName: string): void {
    const component = this.qrwc.components()?.[cameraName];
    if (!component) return;

    const control = component.controls[controlName];
    if (!control) return;

    control.update(true);
  }

  /**
   * Deactivate a control on a specific camera (press and hold end)
   */
  deactivateControl(cameraName: string, controlName: string): void {
    const component = this.qrwc.components()?.[cameraName];
    if (!component) return;

    const control = component.controls[controlName];
    if (!control) return;

    control.update(false);
  }
}
