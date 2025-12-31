import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CustomViewBase } from '../../components/custom-views/base/custom-view-base.component';
import { NavigationHeaderComponent } from '../../components/custom-views/shared/navigation-header/navigation-header.component';
import { ControlCardComponent } from '../../components/custom-views/shared/control-card/control-card.component';
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
}

/**
 * Display Controls custom view
 * Groups controls from IPTVManager component by display number
 * Creates a card for each display containing all its controls
 * Supports Basic and Advanced modes for filtering displayed controls
 */
@Component({
  selector: 'app-display-controls',
  imports: [CommonModule, NavigationHeaderComponent, ControlCardComponent],
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

    // Regex to extract trailing number from control name
    const numberPattern = /\s+(\d+)$/;

    for (const control of controlsList) {
      // Skip controls without names
      if (!control.name) continue;

      // Filter controls based on mode
      if (!this.shouldShowControl(control.name)) continue;

      const match = control.name.match(numberPattern);
      if (match) {
        const displayNumber = parseInt(match[1], 10);

        if (!displayMap.has(displayNumber)) {
          displayMap.set(displayNumber, []);
        }

        displayMap.get(displayNumber)!.push(control);
      }
    }

    // Convert map to array of DisplayCard objects, sorted by display number
    const displays: DisplayCard[] = Array.from(displayMap.entries())
      .map(([displayNumber, controls]) => {
        // Find the DeviceName control for this display
        const deviceNameControl = controls.find(c => c.name === `DeviceName ${displayNumber}`);
        const deviceName = deviceNameControl?.string || deviceNameControl?.value || `Display ${displayNumber}`;

        return {
          displayNumber,
          displayName: `${displayNumber}. ${deviceName}`,
          controls: controls.sort((a, b) => a.name.localeCompare(b.name))
        };
      })
      .sort((a, b) => a.displayNumber - b.displayNumber);

    return displays;
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
