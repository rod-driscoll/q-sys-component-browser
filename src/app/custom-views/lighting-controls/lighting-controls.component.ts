import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CustomViewBase } from '../../components/custom-views/base/custom-view-base.component';
import { NavigationHeaderComponent } from '../../components/custom-views/shared/navigation-header/navigation-header.component';
import { ControlCardComponent } from '../../components/custom-views/shared/control-card/control-card.component';
import { ControlSelectionConfig } from '../../models/custom-view.model';
import { ControlInfo } from '../../services/qsys-browser.service';
import { LIGHTING_CONTROLS_METADATA } from './lighting-controls.metadata';

/**
 * Lighting Controls custom view
 * Displays all lighting-related controls
 */
@Component({
  selector: 'app-lighting-controls',
  imports: [CommonModule, NavigationHeaderComponent, ControlCardComponent],
  templateUrl: './lighting-controls.component.html',
  styleUrl: './lighting-controls.component.css'
})
export class LightingControlsComponent extends CustomViewBase {
  /** View title from metadata */
  readonly title = LIGHTING_CONTROLS_METADATA.title;

  /**
   * Define which controls to display
   * Matches components with Light, Lighting, or Lamp in the name
   */
  protected getControlSelectionConfig(): ControlSelectionConfig[] {
    return [
      {
        method: 'componentPattern',
        componentPattern: '.*(Light|Lighting|Lamp|LED|DMX).*'
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
