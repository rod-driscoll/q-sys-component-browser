import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CustomViewBase } from '../../components/custom-views/base/custom-view-base.component';
import { NavigationHeaderComponent } from '../../components/custom-views/shared/navigation-header/navigation-header.component';
import { ControlCardComponent } from '../../components/custom-views/shared/control-card/control-card.component';
import { ControlSelectionConfig } from '../../models/custom-view.model';
import { ControlInfo } from '../../services/qsys-browser.service';
import { DISPLAY_CONTROLS_METADATA } from './display-controls.metadata';

/**
 * Display Controls custom view
 * Displays all display/monitor/screen-related controls
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

  /**
   * Define which controls to display
   * Matches components with Display, Monitor, or Screen in the name
   */
  protected getControlSelectionConfig(): ControlSelectionConfig[] {
    return [
      {
        method: 'componentPattern',
        componentPattern: '.*(Display|Monitor|Screen|TV|Projector).*'
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
