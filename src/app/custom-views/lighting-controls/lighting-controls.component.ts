import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CustomViewBase } from '../../components/custom-views/base/custom-view-base.component';
import { NavigationHeaderComponent } from '../../components/custom-views/shared/navigation-header/navigation-header.component';
import { ControlSelectionConfig } from '../../models/custom-view.model';
import { ControlInfo } from '../../services/qsys-browser.service';
import { LIGHTING_CONTROLS_METADATA } from './lighting-controls.metadata';

/**
 * Represents a lighting preset with load and save controls
 */
interface LightingPreset {
  presetNumber: number;
  presetName: string;
  loadControl?: ControlInfo;
  saveControl?: ControlInfo;
}

/**
 * Lighting Controls custom view
 * Displays lighting presets with load and save buttons
 * Supports Basic and Advanced modes
 */
@Component({
  selector: 'app-lighting-controls',
  imports: [CommonModule, NavigationHeaderComponent],
  templateUrl: './lighting-controls.component.html',
  styleUrl: './lighting-controls.component.css'
})
export class LightingControlsComponent extends CustomViewBase {
  /** View title from metadata */
  readonly title = LIGHTING_CONTROLS_METADATA.title;

  /** Advanced mode toggle - false = Basic, true = Advanced */
  advancedMode = signal<boolean>(false);

  /** Grouped presets with their controls */
  presets = computed(() => this.groupPresets());

  /**
   * Define which controls to display
   * Loads controls from Lighting Presets component
   */
  protected getControlSelectionConfig(): ControlSelectionConfig[] {
    return [
      {
        method: 'explicitList',
        components: [
          { component: 'LightingPresets' }
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
   * Group controls into presets
   * Extracts preset number from control names (e.g., "load.1" -> preset 1)
   */
  private groupPresets(): LightingPreset[] {
    const controlsList = this.controls();
    const loadMap = new Map<number, ControlInfo>();
    const saveMap = new Map<number, ControlInfo>();
    const presetNameMap = new Map<number, string>();

    // Regex to extract number after dot (e.g., "load.1" -> 1)
    const numberPattern = /\.(\d+)$/;

    // Collect load and save controls
    for (const control of controlsList) {
      if (!control.name) continue;

      const match = control.name.match(numberPattern);
      if (!match) continue;

      const presetNumber = parseInt(match[1], 10);

      if (control.name.startsWith('load.')) {
        loadMap.set(presetNumber, control);
        // Use preset number as default name if no specific name is available
        if (!presetNameMap.has(presetNumber)) {
          presetNameMap.set(presetNumber, `Preset ${presetNumber}`);
        }
      } else if (control.name.startsWith('save.')) {
        saveMap.set(presetNumber, control);
      }
    }

    // Create preset objects
    const presets: LightingPreset[] = Array.from(loadMap.entries())
      .map(([presetNumber, loadControl]) => ({
        presetNumber,
        presetName: presetNameMap.get(presetNumber) || `Preset ${presetNumber}`,
        loadControl,
        saveControl: saveMap.get(presetNumber)
      }))
      .sort((a, b) => a.presetNumber - b.presetNumber);

    return presets;
  }

  /**
   * Handle load preset button click
   */
  async onLoadPreset(preset: LightingPreset): Promise<void> {
    if (preset.loadControl) {
      // Trigger the load control (send opposite value to trigger)
      const newValue = preset.loadControl.value === 1 ? 0 : 1;
      await this.handleValueChange(preset.loadControl, newValue);
    }
  }

  /**
   * Handle save preset button click
   */
  async onSavePreset(preset: LightingPreset): Promise<void> {
    if (preset.saveControl) {
      // Trigger the save control (send opposite value to trigger)
      const newValue = preset.saveControl.value === 1 ? 0 : 1;
      await this.handleValueChange(preset.saveControl, newValue);
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
