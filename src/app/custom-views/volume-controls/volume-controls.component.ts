import { Component, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CustomViewBase } from '../../components/custom-views/base/custom-view-base.component';
import { NavigationHeaderComponent } from '../../components/custom-views/shared/navigation-header/navigation-header.component';
import { KnobControl } from '../../components/qsys-browser/controls/knob-control/knob-control';
import { BooleanControl } from '../../components/qsys-browser/controls/boolean-control/boolean-control';
import { ComboControl } from '../../components/qsys-browser/controls/combo-control/combo-control';
import { ControlSelectionConfig } from '../../models/custom-view.model';
import { ControlInfo } from '../../services/qsys-browser.service';
import { VOLUME_CONTROLS_METADATA } from './volume-controls.metadata';

/**
 * Represents a zone with its associated volume controls
 */
interface ZoneCard {
  zoneNumber: number;
  zoneName: string;
  inputSelectControl?: ControlInfo;
  muteControl?: ControlInfo;
  gainControl?: ControlInfo;
}

/**
 * Volume Controls custom view
 * Groups BGM controls by zone, showing InputSelect, Mute, and Gain for each zone
 */
@Component({
  selector: 'app-volume-controls',
  imports: [CommonModule, NavigationHeaderComponent, KnobControl, BooleanControl, ComboControl],
  templateUrl: './volume-controls.component.html',
  styleUrl: './volume-controls.component.css'
})
export class VolumeControlsComponent extends CustomViewBase {
  /** View title from metadata */
  readonly title = VOLUME_CONTROLS_METADATA.title;

  /** Grouped zones with their controls */
  zoneCards = computed(() => this.groupControlsByZone());

  /**
   * Define which controls to display
   * Loads controls from BGM XFADE and BGM level controls components
   */
  protected getControlSelectionConfig(): ControlSelectionConfig[] {
    return [
      {
        method: 'explicitList',
        components: [
          { component: 'BGM XFADE' },
          { component: 'BGM level controls' }
        ]
      }
    ];
  }

  /**
   * Group controls by zone
   * Extracts zone information from OutputNames controls in BGM XFADE
   * Maps InputSelect, Mute, and Gain controls to each zone
   */
  private groupControlsByZone(): ZoneCard[] {
    const controlsList = this.controls();
    const zoneNamesMap = new Map<number, string>();
    const inputSelectMap = new Map<number, ControlInfo>();
    const muteMap = new Map<number, ControlInfo>();
    const gainMap = new Map<number, ControlInfo>();

    // Regex to extract trailing number from control name
    const numberPattern = /\s+(\d+)$/;

    // First pass: collect zone names from OutputNames controls
    for (const control of controlsList) {
      if (!control.name || control.componentName !== 'BGM XFADE') continue;

      if (control.name.startsWith('OutputNames ')) {
        const match = control.name.match(numberPattern);
        if (match) {
          const zoneNumber = parseInt(match[1], 10);
          const zoneName = control.string || control.value || `Zone ${zoneNumber}`;
          zoneNamesMap.set(zoneNumber, zoneName);
        }
      }
    }

    // Second pass: collect controls for each zone
    for (const control of controlsList) {
      if (!control.name) continue;

      const match = control.name.match(numberPattern);
      if (!match) continue;

      const zoneNumber = parseInt(match[1], 10);

      // Only process zones that have OutputNames entries
      if (!zoneNamesMap.has(zoneNumber)) continue;

      // BGM XFADE InputSelect controls
      if (control.componentName === 'BGM XFADE' && control.name.startsWith('InputSelect ')) {
        inputSelectMap.set(zoneNumber, control);
      }

      // BGM level controls Mute controls
      if (control.componentName === 'BGM level controls' && control.name.startsWith('Mute ')) {
        muteMap.set(zoneNumber, control);
      }

      // BGM level controls Gain controls
      if (control.componentName === 'BGM level controls' && control.name.startsWith('Gain ')) {
        gainMap.set(zoneNumber, control);
      }
    }

    // Create zone cards
    const zones: ZoneCard[] = Array.from(zoneNamesMap.entries())
      .map(([zoneNumber, zoneName]) => ({
        zoneNumber,
        zoneName: `${zoneNumber}. ${zoneName}`,
        inputSelectControl: inputSelectMap.get(zoneNumber),
        muteControl: muteMap.get(zoneNumber),
        gainControl: gainMap.get(zoneNumber)
      }))
      .filter((zone) => {
        // Filter out zones where the name starts with 'Z' or 'Zone' followed by the number
        const nameWithoutPrefix = zone.zoneName.substring(zone.zoneName.indexOf('.') + 2); // Remove "number. " prefix
        const zPattern = new RegExp(`^Z${zone.zoneNumber}\\b`, 'i');
        const zonePattern = new RegExp(`^Zone\\s*${zone.zoneNumber}\\b`, 'i');

        if (zPattern.test(nameWithoutPrefix) || zonePattern.test(nameWithoutPrefix)) {
          return false; // Hide this zone
        }
        return true;
      })
      .sort((a, b) => a.zoneNumber - b.zoneNumber);

    return zones;
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
