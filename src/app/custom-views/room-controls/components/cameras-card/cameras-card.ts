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
  readonly cameraPreviewUrl = signal<string | null>(null);

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

        // Subscribe to the select.1 control to track which camera is currently selected in Q-SYS
        const selectControl = cameraRouter.controls['select.1'];
        if (selectControl) {
          // Set initial selected camera from Q-SYS
          const initialSelection = selectControl.state.Value ?? selectControl.state.Position;
          if (initialSelection !== undefined) {
            this.selectedCameraIndex.set(Math.round(initialSelection));
            console.log(`[CamerasCard] Initial camera selection from Q-SYS: ${initialSelection}`);
          } else if (cameras.length > 0) {
            // Fallback to first camera if no value from Q-SYS
            this.selectedCameraIndex.set(cameras[0].index);
            console.log(`[CamerasCard] No selection from Q-SYS, defaulting to first camera: ${cameras[0].index}`);
          }

          // Listen for selection changes from Q-SYS
          selectControl.on('update', (state) => {
            const newSelection = state.Value ?? state.Position;
            if (newSelection !== undefined) {
              this.selectedCameraIndex.set(Math.round(newSelection));
              console.log(`[CamerasCard] Camera selection changed in Q-SYS to: ${newSelection}`);
            }
          });
        } else {
          console.warn('[CamerasCard] select.1 control not found on CameraRouter');
          // Fallback to first camera
          if (cameras.length > 0) {
            this.selectedCameraIndex.set(cameras[0].index);
            console.log(`[CamerasCard] Defaulting to first camera: ${cameras[0].index}`);
          }
        }
      } else {
        console.log('[CamerasCard] CameraRouter component NOT found - camera selection will not be available');
        this.hasCameraRouter.set(false);
      }
    });

    // Bind to Q-SYS USB Video Bridge Core for privacy state and camera preview
    effect(() => {
      const videoComponent = this.qrwc.components()?.['USB Video Bridge Core'];
      if (videoComponent) {
        // Handle privacy control
        const privacyControl = videoComponent.controls['toggle.privacy'];
        if (privacyControl) {
          // Set initial value
          this.isPrivacyOn.set(privacyControl.state.Bool ?? false);
          // Subscribe to updates
          privacyControl.on('update', (state) => {
            this.isPrivacyOn.set(state.Bool ?? false);
          });
        }

        // Handle camera preview (jpeg.data control)
        const jpegControl = videoComponent.controls['jpeg.data'];
        if (jpegControl) {
          // Parse initial JSON and extract base64 image
          this.updateCameraPreview(jpegControl.state.String);

          // Subscribe to updates
          jpegControl.on('update', (state) => {
            this.updateCameraPreview(state.String);
          });

          console.log('[CamerasCard] Subscribed to jpeg.data control for camera preview');
        } else {
          console.warn('[CamerasCard] jpeg.data control not found on USB Video Bridge Core');
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

  /**
   * Parse jpeg.data control JSON and update camera preview
   * The JSON contains an 'IconData' property with base64-encoded JPEG
   */
  private updateCameraPreview(jsonString: string | undefined): void {
    if (!jsonString) {
      this.cameraPreviewUrl.set(null);
      return;
    }

    try {
      const data = JSON.parse(jsonString);
      if (data.IconData && typeof data.IconData === 'string') {
        // IconData is base64-encoded JPEG, create data URL
        const dataUrl = `data:image/jpeg;base64,${data.IconData}`;
        this.cameraPreviewUrl.set(dataUrl);
        console.log('[CamerasCard] Camera preview updated');
      } else {
        console.warn('[CamerasCard] jpeg.data JSON missing IconData property');
        this.cameraPreviewUrl.set(null);
      }
    } catch (error) {
      console.error('[CamerasCard] Failed to parse jpeg.data JSON:', error);
      this.cameraPreviewUrl.set(null);
    }
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
