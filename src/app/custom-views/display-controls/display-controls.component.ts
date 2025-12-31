import { Component, computed } from '@angular/core';
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
   * Group controls by display number
   * Extracts display number from control names (e.g., "ChannelSelect 18" -> display 18)
   */
  private groupControlsByDisplay(): DisplayCard[] {
    const controlsList = this.controls();
    const displayMap = new Map<number, ControlInfo[]>();

    // Regex to extract trailing number from control name
    const numberPattern = /\s+(\d+)$/;

    for (const control of controlsList) {
      // Skip controls without names
      if (!control.name) continue;

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
      .map(([displayNumber, controls]) => ({
        displayNumber,
        displayName: `Display ${displayNumber}`,
        controls: controls.sort((a, b) => a.name.localeCompare(b.name))
      }))
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
