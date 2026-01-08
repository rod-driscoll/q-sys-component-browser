import { Component, inject, effect, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { QrwcAdapterService } from '../../services/qrwc-adapter.service';

interface CameraControl {
  name: string;
  icon: string;
  controlName: string;
  position?: string;
}

@Component({
  selector: 'app-cameras-card',
  imports: [CommonModule],
  templateUrl: './cameras-card.html',
  styleUrl: './cameras-card.css',
})
export class CamerasCard {
  readonly qrwc = inject(QrwcAdapterService);
  readonly videoPrivacyText = signal('Video Privacy');
  readonly zoomInText = signal('Zoom In');
  readonly zoomOutText = signal('Zoom Out');

  readonly panTiltControls: CameraControl[] = [
    { name: 'Pan Left & Tilt Up', icon: 'north_west', controlName: 'PanLeftTiltUp', position: 'top-left' },
    { name: 'Tilt Up', icon: 'north', controlName: 'TiltUp', position: 'top-center' },
    { name: 'Pan Right & Tilt Up', icon: 'north_east', controlName: 'PanRightTiltUp', position: 'top-right' },
    { name: 'Pan Left', icon: 'west', controlName: 'PanLeft', position: 'middle-left' },
    { name: 'Pan Right', icon: 'east', controlName: 'PanRight', position: 'middle-right' },
    { name: 'Pan Left & Tilt Down', icon: 'south_west', controlName: 'PanLeftTiltDown', position: 'bottom-left' },
    { name: 'Tilt Down', icon: 'south', controlName: 'TiltDown', position: 'bottom-center' },
    { name: 'Pan Right & Tilt Down', icon: 'south_east', controlName: 'PanRightTiltDown', position: 'bottom-right' },
  ];

  readonly zoomControls = [
    { name: 'Video Privacy', icon: 'videocam', controlName: 'VideoPrivacy' },
    { name: 'Zoom In', icon: 'add_circle_outline', controlName: 'ZoomIn' },
    { name: 'Zoom Out', icon: 'remove_circle_outline', controlName: 'ZoomOut' },
  ];

  constructor() {
    // Bind to Q-SYS UCI Text Helper for Video Privacy text
    effect(() => {
      const textHelper = this.qrwc.components()?.['UCI Text Helper'];
      if (!textHelper) return;

      const videoPrivacyControl = textHelper.controls['VideoPrivacyPrompt'];
      if (videoPrivacyControl) {
        // Set initial value
        this.videoPrivacyText.set(videoPrivacyControl.state.String ?? 'Video Privacy');
        // Subscribe to updates
        videoPrivacyControl.on('update', (state) => {
          this.videoPrivacyText.set(state.String ?? 'Video Privacy');
        });
      }

      const zoomInControl = textHelper.controls['ZoomInPrompt'];
      if (zoomInControl) {
        // Set initial value
        this.zoomInText.set(zoomInControl.state.String ?? 'Zoom In');
        // Subscribe to updates
        zoomInControl.on('update', (state) => {
          this.zoomInText.set(state.String ?? 'Zoom In');
        });
      }

      const zoomOutControl = textHelper.controls['ZoomOutPrompt'];
      if (zoomOutControl) {
        // Set initial value
        this.zoomOutText.set(zoomOutControl.state.String ?? 'Zoom Out');
        // Subscribe to updates
        zoomOutControl.on('update', (state) => {
          this.zoomOutText.set(state.String ?? 'Zoom Out');
        });
      }

    });
  }

  activateControl(controlName: string): void {
    const component = this.qrwc.components()?.['USB Video Bridge Core'];
    if (!component) return;

    const control = component.controls[controlName];
    if (!control) return;

    control.update(true);
  }

  deactivateControl(controlName: string): void {
    const component = this.qrwc.components()?.['USB Video Bridge Core'];
    if (!component) return;

    const control = component.controls[controlName];
    if (!control) return;

    control.update(false);
  }
}
