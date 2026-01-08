import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CustomViewBase } from '../../components/custom-views/base/custom-view-base.component';
import { NavigationHeaderComponent } from '../../components/custom-views/shared/navigation-header/navigation-header.component';
import { ControlCardComponent } from '../../components/custom-views/shared/control-card/control-card.component';
import { ControlSelectionConfig } from '../../models/custom-view.model';
import { ControlInfo, QSysBrowserService } from '../../services/qsys-browser.service';
import { QSysService } from '../../services/qsys.service';
import { CAMERA_CONTROLS_METADATA } from './camera-controls.metadata';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';

/**
 * Represents a camera with its associated controls
 */
interface CameraCard {
  cameraNumber: number;
  cameraName: string;
  componentName: string; // The actual camera component name
  previewText?: string; // Text from 'preview' control
  imageDataUrl?: SafeUrl; // Safe URL for base64 image from jpeg.data IconData
  controls: {
    // Directional controls
    up?: ControlInfo;
    down?: ControlInfo;
    left?: ControlInfo;
    right?: ControlInfo;
    upLeft?: ControlInfo;
    upRight?: ControlInfo;
    downLeft?: ControlInfo;
    downRight?: ControlInfo;
    // Other controls
    zoomIn?: ControlInfo;
    zoomOut?: ControlInfo;
    home?: ControlInfo;
    privacy?: ControlInfo;
    powerOn?: ControlInfo;
    powerOff?: ControlInfo;
    powerState?: ControlInfo;
  };
}

/**
 * Camera Controls custom view
 * Groups controls from Cameras component by camera number
 * Creates a card for each camera containing directional arrows and control buttons
 */
@Component({
  selector: 'app-camera-controls',
  imports: [CommonModule, NavigationHeaderComponent, ControlCardComponent],
  templateUrl: './camera-controls.component.html',
  styleUrl: './camera-controls.component.css'
})
export class CameraControlsComponent extends CustomViewBase {
  /** View title from metadata */
  readonly title = CAMERA_CONTROLS_METADATA.title;

  /** Control names we're interested in */
  private readonly controlNames = [
    'Up', 'Down', 'Left', 'Right', 'UpLeft', 'UpRight', 'DownLeft', 'DownRight',
    'ZoomIn', 'ZoomOut', 'Home', 'Privacy',
    'PowerOn', 'PowerOff', 'PowerState'
  ];

  /** Grouped cameras with their controls */
  cameraCards = signal<CameraCard[]>([]);

  constructor(
    qsysService: QSysService,
    browserService: QSysBrowserService,
    private sanitizer: DomSanitizer
  ) {
    super(qsysService, browserService);
  }

  /**
   * Define which controls to display
   * Only loads controls from the Cameras component
   */
  protected getControlSelectionConfig(): ControlSelectionConfig[] {
    return [
      {
        method: 'explicitList',
        components: [
          { component: 'Cameras' }
        ]
      }
    ];
  }

  /**
   * Override loadControls to fetch camera components and their data
   */
  protected override async loadControls(): Promise<void> {
    // First load the main Cameras component controls
    await super.loadControls();

    // Now process the camera components
    await this.loadCameraComponents();
  }

  /**
   * Load individual camera components and build camera cards
   */
  private async loadCameraComponents(): Promise<void> {
    const controlsList = this.controls();
    const cameraCards: CameraCard[] = [];
    const numberPattern = /\s+(\d+)$/;

    console.log('[Camera Controls] Loading camera components...');

    // Find all CameraComponents controls
    for (const control of controlsList) {
      if (!control.name || !control.name.startsWith('CameraComponents ')) continue;

      const match = control.name.match(numberPattern);
      if (match && control.string && control.string.trim() !== '') {
        const cameraNumber = parseInt(match[1], 10);
        const componentName = control.string.trim();

        console.log(`[Camera Controls] Processing camera ${cameraNumber}: ${componentName}`);

        try {
          // Fetch controls for this camera component
          const cameraControls = await this.qsysService.getComponentControls(componentName);

          // Create camera card
          const cameraCard: CameraCard = {
            cameraNumber: cameraNumber,
            cameraName: `Camera ${cameraNumber}`,
            componentName: componentName,
            controls: {}
          };

          // Extract preview and jpeg.data
          for (const cameraControl of cameraControls) {
            if (cameraControl.name === 'preview') {
              cameraCard.previewText = cameraControl.string || cameraControl.value?.toString();
              console.log(`[Camera Controls] Camera ${cameraNumber} preview:`, cameraCard.previewText);
            } else if (cameraControl.name === 'jpeg.data') {
              // Parse JSON and extract IconData
              try {
                if (cameraControl.string) {
                  const jsonData = JSON.parse(cameraControl.string);
                  if (jsonData.IconData) {
                    // Create safe data URL from base64
                    const dataUrl = `data:image/jpeg;base64,${jsonData.IconData}`;
                    cameraCard.imageDataUrl = this.sanitizer.bypassSecurityTrustUrl(dataUrl);
                    console.log(`[Camera Controls] Camera ${cameraNumber} has image data`);
                  }
                }
              } catch (e) {
                console.error(`[Camera Controls] Failed to parse jpeg.data for camera ${cameraNumber}:`, e);
              }
            }
          }

          cameraCards.push(cameraCard);
        } catch (err) {
          console.error(`[Camera Controls] Failed to fetch controls for ${componentName}:`, err);
        }
      }
    }

    // Now collect the main camera controls (Left, Right, etc.) from the Cameras component
    for (const control of controlsList) {
      if (!control.name || !this.shouldShowControl(control.name)) continue;

      const match = control.name.match(numberPattern);
      if (match) {
        const cameraNumber = parseInt(match[1], 10);
        const baseControlName = control.name.replace(/\s+\d+$/, '');

        // Find the camera card for this number
        const cameraCard = cameraCards.find(c => c.cameraNumber === cameraNumber);
        if (cameraCard) {
          // Map control to appropriate property
          switch (baseControlName) {
            case 'Up':
              cameraCard.controls.up = control;
              break;
            case 'Down':
              cameraCard.controls.down = control;
              break;
            case 'Left':
              cameraCard.controls.left = control;
              break;
            case 'Right':
              cameraCard.controls.right = control;
              break;
            case 'UpLeft':
              cameraCard.controls.upLeft = control;
              break;
            case 'UpRight':
              cameraCard.controls.upRight = control;
              break;
            case 'DownLeft':
              cameraCard.controls.downLeft = control;
              break;
            case 'DownRight':
              cameraCard.controls.downRight = control;
              break;
            case 'ZoomIn':
              cameraCard.controls.zoomIn = control;
              break;
            case 'ZoomOut':
              cameraCard.controls.zoomOut = control;
              break;
            case 'Home':
              cameraCard.controls.home = control;
              break;
            case 'Privacy':
              cameraCard.controls.privacy = control;
              break;
            case 'PowerOn':
              cameraCard.controls.powerOn = control;
              break;
            case 'PowerOff':
              cameraCard.controls.powerOff = control;
              break;
            case 'PowerState':
              cameraCard.controls.powerState = control;
              break;
          }
        }
      }
    }

    // Sort by camera number and update signal
    cameraCards.sort((a, b) => a.cameraNumber - b.cameraNumber);
    this.cameraCards.set(cameraCards);

    console.log('[Camera Controls] Loaded', cameraCards.length, 'cameras');
  }

  /**
   * Check if a control should be displayed based on control name
   */
  private shouldShowControl(controlName: string): boolean {
    // Extract base control name without the number suffix
    const baseControlName = controlName.replace(/\s+\d+$/, '');

    // Check if it's one of our target control names
    return this.controlNames.includes(baseControlName);
  }


  /**
   * Handle directional control button press
   */
  async onDirectionalControl(control?: ControlInfo): Promise<void> {
    if (control) {
      // For trigger-type controls, toggle between 0 and 1
      const newValue = control.value === 1 ? 0 : 1;
      await this.handleValueChange(control, newValue);
    }
  }

  /**
   * Handle button control (Home, Privacy, Power, Zoom)
   */
  async onButtonControl(control?: ControlInfo): Promise<void> {
    if (control) {
      // For trigger-type controls, toggle between 0 and 1
      const newValue = control.value === 1 ? 0 : 1;
      await this.handleValueChange(control, newValue);
    }
  }

  /**
   * Handle control value change
   */
  async onValueChange(control: ControlInfo, value: any): Promise<void> {
    await this.handleValueChange(control, value);
  }

  /**
   * Handle control position change (for knobs, sliders)
   */
  async onPositionChange(control: ControlInfo, position: number): Promise<void> {
    await this.handlePositionChange(control, position);
  }
}
