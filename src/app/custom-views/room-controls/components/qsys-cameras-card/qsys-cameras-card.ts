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

interface OnvifCameraOption {
  componentName: string;
  displayName: string;
}

@Component({
  selector: 'app-qsys-cameras-card',
  imports: [CommonModule, FormsModule],
  templateUrl: './qsys-cameras-card.html',
  styleUrl: './qsys-cameras-card.css',
})
export class QsysCamerasCard {
  readonly qrwc = inject(QrwcAdapterService);
  readonly videoPrivacyText = signal('Video Privacy');
  readonly zoomInText = signal('Zoom In');
  readonly zoomOutText = signal('Zoom Out');
  readonly isPrivacyOn = signal(false);
  readonly cameraOptions = signal<OnvifCameraOption[]>([]);
  readonly selectedCameraName = signal<string | null>(null);
  readonly hasOnvifCameras = signal(false);
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
    // Discover ONVIF cameras by checking component type
    effect(() => {
      const components = this.qrwc.components();
      console.log('[QsysCamerasCard] Checking for ONVIF camera components...', {
        hasComponents: !!components,
        componentNames: components ? Object.keys(components) : []
      });

      if (!components) {
        this.hasOnvifCameras.set(false);
        return;
      }

      const onvifCameras: OnvifCameraOption[] = [];

      // Find all components of type 'onvif_camera_operative'
      for (const componentName in components) {
        const component = components[componentName];
        const componentType = (component as any).type;

        console.log(`[QsysCamerasCard] Checking component: ${componentName}, type: ${componentType}`);

        if (componentType === 'onvif_camera_operative') {
          console.log(`[QsysCamerasCard] Found ONVIF camera: ${componentName}`);
          onvifCameras.push({
            componentName: componentName,
            displayName: componentName
          });
        }
      }

      if (onvifCameras.length > 0) {
        console.log(`[QsysCamerasCard] Found ${onvifCameras.length} ONVIF cameras:`, onvifCameras);
        this.hasOnvifCameras.set(true);
        this.cameraOptions.set(onvifCameras);

        // Select first camera by default if none selected
        if (!this.selectedCameraName() && onvifCameras.length > 0) {
          this.selectedCameraName.set(onvifCameras[0].componentName);
          console.log(`[QsysCamerasCard] Default selected camera: ${onvifCameras[0].componentName}`);
        }
      } else {
        console.log('[QsysCamerasCard] No ONVIF cameras found');
        this.hasOnvifCameras.set(false);
      }
    });

    // Bind to selected ONVIF camera for privacy state and camera preview
    effect(() => {
      const selectedCamera = this.selectedCameraName();
      if (!selectedCamera) return;

      const cameraComponent = this.qrwc.components()?.[selectedCamera];
      if (cameraComponent) {
        console.log(`[QsysCamerasCard] Binding to camera: ${selectedCamera}`);

        // Handle privacy control if it exists
        const privacyControl = cameraComponent.controls['toggle.privacy'];
        if (privacyControl) {
          // Set initial value
          this.isPrivacyOn.set(privacyControl.state.Bool ?? false);
          // Subscribe to updates
          privacyControl.on('update', (state) => {
            this.isPrivacyOn.set(state.Bool ?? false);
          });
          console.log(`[QsysCamerasCard] Subscribed to privacy control for ${selectedCamera}`);
        }

        // Handle camera preview (jpeg.data control) if it exists
        const jpegControl = cameraComponent.controls['jpeg.data'];
        if (jpegControl) {
          // Parse initial JSON and extract base64 image
          this.updateCameraPreview(jpegControl.state.String);

          // Subscribe to updates
          jpegControl.on('update', (state) => {
            this.updateCameraPreview(state.String);
          });

          console.log(`[QsysCamerasCard] Subscribed to jpeg.data control for ${selectedCamera}`);
        } else {
          console.warn(`[QsysCamerasCard] jpeg.data control not found on ${selectedCamera}`);
          this.cameraPreviewUrl.set(null);
        }
      }
    });

    // Bind to Q-SYS UCI Text Helper for text labels
    effect(() => {
      const textHelper = this.qrwc.components()?.['UCI Text Helper'];
      if (!textHelper) return;

      const videoPrivacyControl = textHelper.controls['VideoPrivacyPrompt'];
      if (videoPrivacyControl) {
        this.videoPrivacyText.set(videoPrivacyControl.state.String ?? 'Video Privacy');
        videoPrivacyControl.on('update', (state) => {
          this.videoPrivacyText.set(state.String ?? 'Video Privacy');
        });
      }

      const zoomInControl = textHelper.controls['ZoomInPrompt'];
      if (zoomInControl) {
        this.zoomInText.set(zoomInControl.state.String ?? 'Zoom In');
        zoomInControl.on('update', (state) => {
          this.zoomInText.set(state.String ?? 'Zoom In');
        });
      }

      const zoomOutControl = textHelper.controls['ZoomOutPrompt'];
      if (zoomOutControl) {
        this.zoomOutText.set(zoomOutControl.state.String ?? 'Zoom Out');
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
        console.log('[QsysCamerasCard] Camera preview updated');
      } else {
        console.warn('[QsysCamerasCard] jpeg.data JSON missing IconData property');
        this.cameraPreviewUrl.set(null);
      }
    } catch (error) {
      console.error('[QsysCamerasCard] Failed to parse jpeg.data JSON:', error);
      this.cameraPreviewUrl.set(null);
    }
  }

  onCameraSelect(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const selectedName = target.value;

    console.log(`[QsysCamerasCard] Camera selection changed to: ${selectedName}`);
    this.selectedCameraName.set(selectedName);
  }

  togglePrivacy(): void {
    const cameraName = this.selectedCameraName();
    if (!cameraName) return;

    const component = this.qrwc.components()?.[cameraName];
    if (!component) return;

    const control = component.controls['toggle.privacy'];
    if (!control) return;

    // Toggle privacy state
    control.update(!this.isPrivacyOn());
  }

  activateControl(controlName: string): void {
    const cameraName = this.selectedCameraName();
    if (!cameraName) return;

    const component = this.qrwc.components()?.[cameraName];
    if (!component) return;

    const control = component.controls[controlName];
    if (!control) return;

    control.update(true);
  }

  deactivateControl(controlName: string): void {
    const cameraName = this.selectedCameraName();
    if (!cameraName) return;

    const component = this.qrwc.components()?.[cameraName];
    if (!component) return;

    const control = component.controls[controlName];
    if (!control) return;

    control.update(false);
  }
}
