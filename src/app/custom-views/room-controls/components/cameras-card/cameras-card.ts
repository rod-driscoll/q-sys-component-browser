import { Component, inject, effect, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { QrwcAdapterService } from '../../services/qrwc-adapter.service';

interface CameraControl {
  name: string;
  icon: string;
  controlName: string;
  position?: string;
}

interface CameraOption {
  index: number;
  name: string;
  selectControl: string;
}

@Component({
  selector: 'app-cameras-card',
  imports: [CommonModule, FormsModule],
  templateUrl: './cameras-card.html',
  styleUrl: './cameras-card.css',
})
export class CamerasCard {
  readonly qrwc = inject(QrwcAdapterService);
  readonly videoPrivacyText = signal('Video Privacy');
  readonly zoomInText = signal('Zoom In');
  readonly zoomOutText = signal('Zoom Out');
  readonly isPrivacyOn = signal(false);
  readonly cameraOptions = signal<CameraOption[]>([]);
  readonly selectedCameraIndex = signal<number>(1);
  readonly hasCameraRouter = signal(false);

  readonly panTiltControls: CameraControl[] = [
    { name: 'Pan Left & Tilt Up', icon: 'north_west', controlName: 'pan.left.tilt.up', position: 'top-left' },
    { name: 'Tilt Up', icon: 'north', controlName: 'tilt.up', position: 'top-center' },
    { name: 'Pan Right & Tilt Up', icon: 'north_east', controlName: 'pan.right.tilt.up', position: 'top-right' },
    { name: 'Pan Left', icon: 'west', controlName: 'pan.left', position: 'middle-left' },
    { name: 'Pan Right', icon: 'east', controlName: 'pan.right', position: 'middle-right' },
    { name: 'Pan Left & Tilt Down', icon: 'south_west', controlName: 'pan.left.tilt.down', position: 'bottom-left' },
    { name: 'Tilt Down', icon: 'south', controlName: 'tilt.down', position: 'bottom-center' },
    { name: 'Pan Right & Tilt Down', icon: 'south_east', controlName: 'pan.right.tilt.down', position: 'bottom-right' },
  ];

  readonly zoomControls = [
    { name: 'Video Privacy', icon: 'videocam', controlName: 'toggle.privacy' },
    { name: 'Zoom In', icon: 'add_circle_outline', controlName: 'zoom.in' },
    { name: 'Zoom Out', icon: 'remove_circle_outline', controlName: 'zoom.out' },
  ];

  constructor() {
    // Bind to Q-SYS CameraRouter for camera selection
    effect(() => {
      const components = this.qrwc.components();
      console.log('[CamerasCard] Checking for CameraRouter component...', {
        hasComponents: !!components,
        componentNames: components ? Object.keys(components) : [],
        hasCameraRouter: !!(components?.['CameraRouter'])
      });

      const cameraRouter = components?.['CameraRouter'];
      if (cameraRouter) {
        console.log('[CamerasCard] CameraRouter component found!', {
          controlCount: Object.keys(cameraRouter.controls).length,
          controls: Object.keys(cameraRouter.controls)
        });
        this.hasCameraRouter.set(true);

        // Find all camera input controls (input.X.source.name)
        const cameras: CameraOption[] = [];
        const controlNames = Object.keys(cameraRouter.controls);

        // Look for pattern: input.X.source.name
        controlNames.forEach(controlName => {
          const match = controlName.match(/^input\.(\d+)\.source\.name$/);
          if (match) {
            const index = parseInt(match[1], 10);
            const control = cameraRouter.controls[controlName];

            console.log(`[CamerasCard] Found camera input ${index}:`, {
              controlName,
              name: control.state.String || `Camera ${index}`
            });

            cameras.push({
              index: index,
              name: control.state.String || `Camera ${index}`,
              selectControl: `select.${index}`
            });

            // Subscribe to name updates
            control.on('update', (state) => {
              const updatedCameras = this.cameraOptions().map(cam =>
                cam.index === index
                  ? { ...cam, name: state.String || `Camera ${index}` }
                  : cam
              );
              this.cameraOptions.set(updatedCameras);
            });
          }
        });

        // Sort by index
        cameras.sort((a, b) => a.index - b.index);
        this.cameraOptions.set(cameras);

        console.log(`[CamerasCard] Configured ${cameras.length} camera options:`, cameras);

        // Set initial selected camera (default to first camera or camera 1)
        if (cameras.length > 0) {
          this.selectedCameraIndex.set(cameras[0].index);
          console.log(`[CamerasCard] Selected default camera: ${cameras[0].index} (${cameras[0].name})`);
        }
      } else {
        console.log('[CamerasCard] CameraRouter component NOT found - camera selection will not be available');
        this.hasCameraRouter.set(false);
      }
    });

    // Bind to Q-SYS USB Video Bridge Core for privacy state
    effect(() => {
      const videoComponent = this.qrwc.components()?.['USB Video Bridge Core'];
      if (videoComponent) {
        const privacyControl = videoComponent.controls['toggle.privacy'];
        if (privacyControl) {
          // Set initial value
          this.isPrivacyOn.set(privacyControl.state.Bool ?? false);
          // Subscribe to updates
          privacyControl.on('update', (state) => {
            this.isPrivacyOn.set(state.Bool ?? false);
          });
        }
      }
    });

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

  onCameraSelect(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const selectedIndex = parseInt(target.value, 10);

    const cameraRouter = this.qrwc.components()?.['CameraRouter'];
    if (!cameraRouter) return;

    // For video_router components, 'select.1' is output 1
    // We set its value to the camera input index (2, 3, etc.)
    const selectControl = cameraRouter.controls['select.1'];
    if (!selectControl) return;

    // Set the output to route to the selected camera input
    selectControl.update(selectedIndex);
    this.selectedCameraIndex.set(selectedIndex);
  }

  togglePrivacy(): void {
    const component = this.qrwc.components()?.['USB Video Bridge Core'];
    if (!component) return;

    const control = component.controls['toggle.privacy'];
    if (!control) return;

    // Toggle privacy state
    control.update(!this.isPrivacyOn());
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
