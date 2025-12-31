import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CustomViewBase } from '../../components/custom-views/base/custom-view-base.component';
import { NavigationHeaderComponent } from '../../components/custom-views/shared/navigation-header/navigation-header.component';
import { ControlCardComponent } from '../../components/custom-views/shared/control-card/control-card.component';
import { PowerControlComponent } from './power-control/power-control.component';
import { ControlSelectionConfig } from '../../models/custom-view.model';
import { ControlInfo } from '../../services/qsys-browser.service';
import { DISPLAY_CONTROLS_METADATA } from './display-controls.metadata';

/**
 * Represents a display with its associated controls
 */
interface DisplayCard {
  displayNumber: number;
  displayName: string;
  controls: ControlInfo[];
  powerOnControl?: ControlInfo;
  powerOffControl?: ControlInfo;
}

/**
 * Display Controls custom view
 * Groups controls from IPTVManager component by display number
 * Creates a card for each display containing all its controls
 * Supports Basic and Advanced modes for filtering displayed controls
 */
@Component({
  selector: 'app-display-controls',
  imports: [CommonModule, NavigationHeaderComponent, ControlCardComponent, PowerControlComponent],
  templateUrl: './display-controls.component.html',
  styleUrl: './display-controls.component.css'
})
export class DisplayControlsComponent extends CustomViewBase {
  /** View title from metadata */
  readonly title = DISPLAY_CONTROLS_METADATA.title;

  /** Advanced mode toggle - false = Basic, true = Advanced */
  advancedMode = signal<boolean>(false);

  /** Basic mode control names */
  private readonly basicModeControls = ['ChannelSelect', 'PowerOn', 'PowerOff'];

  /** Power control names (treated specially - combined into one control) */
  private readonly powerControlNames = ['PowerOn', 'PowerOff'];

  /** Advanced mode additional control names */
  private readonly advancedModeControls = ['IPAddress', 'DisplayStatus', 'Decoder IPAddress', 'DecoderStatus'];

  /** Grouped displays with their controls */
  displayCards = computed(() => this.groupControlsByDisplay());

  /**
   * Define which controls to display
   * Only loads controls from the IPTVManager component
   */
  protected getControlSelectionConfig(): ControlSelectionConfig[] {
    return [
      {
        method: 'explicitList',
        components: [
          { component: 'IPTVManager' }
        ]
      }
    ];
  }

  /**
   * Toggle between Basic and Advanced modes
   */
  toggleMode(): void {
    this.advancedMode.set(!this.advancedMode());
  }

  /**
   * Check if a control should be displayed based on current mode
   */
  private shouldShowControl(controlName: string): boolean {
    // Extract base control name without the number suffix
    const baseControlName = controlName.replace(/\s+\d+$/, '');

    // Always show basic mode controls
    if (this.basicModeControls.includes(baseControlName)) {
      return true;
    }

    // In advanced mode, also show additional controls
    if (this.advancedMode()) {
      return this.advancedModeControls.includes(baseControlName);
    }

    return false;
  }

  /**
   * Group controls by display number
   * Extracts display number from control names (e.g., "ChannelSelect 18" -> display 18)
   * Filters controls based on current mode (Basic/Advanced)
   */
  private groupControlsByDisplay(): DisplayCard[] {
    const controlsList = this.controls();
    const displayMap = new Map<number, ControlInfo[]>();
    const deviceNameMap = new Map<number, string>();

    // Regex to extract trailing number from control name
    const numberPattern = /\s+(\d+)$/;

    // First pass: collect all DeviceName controls for display names
    for (const control of controlsList) {
      if (!control.name) continue;

      if (control.name.startsWith('DeviceName ')) {
        const match = control.name.match(numberPattern);
        if (match) {
          const displayNumber = parseInt(match[1], 10);
          const deviceName = control.string || control.value || `Display ${displayNumber}`;
          deviceNameMap.set(displayNumber, deviceName);
        }
      }
    }

    // Maps to track power controls separately
    const powerOnMap = new Map<number, ControlInfo>();
    const powerOffMap = new Map<number, ControlInfo>();

    // Second pass: collect controls to display based on mode filtering
    for (const control of controlsList) {
      // Skip controls without names
      if (!control.name) continue;

      // Filter controls based on mode
      if (!this.shouldShowControl(control.name)) continue;

      const match = control.name.match(numberPattern);
      if (match) {
        const displayNumber = parseInt(match[1], 10);
        const baseControlName = control.name.replace(/\s+\d+$/, '');

        // Handle power controls specially
        if (baseControlName === 'PowerOn') {
          powerOnMap.set(displayNumber, control);
          continue;
        }
        if (baseControlName === 'PowerOff') {
          powerOffMap.set(displayNumber, control);
          continue;
        }

        if (!displayMap.has(displayNumber)) {
          displayMap.set(displayNumber, []);
        }

        displayMap.get(displayNumber)!.push(control);
      }
    }

    // Convert map to array of DisplayCard objects, sorted by display number
    const displays: DisplayCard[] = Array.from(displayMap.entries())
      .map(([displayNumber, controls]) => {
        const deviceName = deviceNameMap.get(displayNumber) || `Display ${displayNumber}`;

        return {
          displayNumber,
          displayName: `${displayNumber}. ${deviceName}`,
          controls: controls.sort((a, b) => a.name.localeCompare(b.name)),
          powerOnControl: powerOnMap.get(displayNumber),
          powerOffControl: powerOffMap.get(displayNumber)
        };
      })
      .sort((a, b) => a.displayNumber - b.displayNumber);

    return displays;
  }

  /**
   * Handle power on button click
   */
  async onPowerOn(display: DisplayCard): Promise<void> {
    if (display.powerOnControl) {
      // Send opposite of current value (trigger the control)
      const newValue = display.powerOnControl.value === 1 ? 0 : 1;
      await this.handleValueChange(display.powerOnControl, newValue);
    }
  }

  /**
   * Handle power off button click
   */
  async onPowerOff(display: DisplayCard): Promise<void> {
    if (display.powerOffControl) {
      // Send opposite of current value (trigger the control)
      const newValue = display.powerOffControl.value === 1 ? 0 : 1;
      await this.handleValueChange(display.powerOffControl, newValue);
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
