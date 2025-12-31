import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CustomViewBase } from '../../components/custom-views/base/custom-view-base.component';
import { NavigationHeaderComponent } from '../../components/custom-views/shared/navigation-header/navigation-header.component';
import { ControlCardComponent } from '../../components/custom-views/shared/control-card/control-card.component';
import { ControlSelectionConfig } from '../../models/custom-view.model';
import { ControlInfo } from '../../services/qsys-browser.service';
import { VOLUME_CONTROLS_METADATA } from './volume-controls.metadata';

/**
 * Volume Controls custom view
 * Displays all volume-related controls (gains, faders, mutes) in a single page
 */
@Component({
  selector: 'app-volume-controls',
  imports: [CommonModule, NavigationHeaderComponent, ControlCardComponent],
  templateUrl: './volume-controls.component.html',
  styleUrl: './volume-controls.component.css'
})
export class VolumeControlsComponent extends CustomViewBase {
  /** View title from metadata */
  readonly title = VOLUME_CONTROLS_METADATA.title;

  /**
   * Define which controls to display
   * Matches components with Volume, Audio, or Gain in the name
   * Filters for controls with Fader, Mute, Level, or Volume in the name
   */
  protected getControlSelectionConfig(): ControlSelectionConfig[] {
    return [
      {
        method: 'componentPattern',
        componentPattern: '.*(Volume|Audio|Gain|Zone).*',
        controlPattern: '(Fader|Mute|Level|Volume|Gain)'
      }
    ];
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
