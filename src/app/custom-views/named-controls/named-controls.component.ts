import { Component, OnInit, OnDestroy, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { KnobControl } from '../../components/qsys-browser/controls/knob-control/knob-control';
import { BooleanControl } from '../../components/qsys-browser/controls/boolean-control/boolean-control';
// import { ButtonControl } from '../../components/qsys-browser/controls/button-control/button-control';
import { TextControl } from '../../components/qsys-browser/controls/text-control/text-control';
import { ComboControl } from '../../components/qsys-browser/controls/combo-control/combo-control';
import { NAMED_CONTROLS_METADATA } from './named-controls.metadata';
import { NamedControlsService, NamedControl } from '../../services/named-controls.service';
import { ControlInfo } from '../../services/qsys-browser.service';

/**
 * Named Controls custom view
 * Displays all named controls from ExternalControls.xml as interactive controls
 */
@Component({
  selector: 'app-named-controls',
  standalone: true,
  imports: [
    CommonModule,
    KnobControl,
    BooleanControl,
    // ButtonControl,
    TextControl,
    ComboControl
  ],
  templateUrl: './named-controls.component.html',
  styleUrl: './named-controls.component.css'
})
export class NamedControlsComponent implements OnInit, OnDestroy {
  /** View title from metadata */
  readonly title = NAMED_CONTROLS_METADATA.title;

  constructor(private namedControlsService: NamedControlsService) {}

  // Use service signals via getters
  get namedControls() { return this.namedControlsService.namedControls; }
  get isLoading() { return this.namedControlsService.isLoading; }
  get errorMessage() { return this.namedControlsService.error; }
  get isConnected() { return this.namedControlsService.isConnected; }

  ngOnInit(): void {
    // App-level initialization has already completed at this point
    // Discovery service is ready, Lua scripts are loaded
    // Just load named controls
    console.log('[NAMED-CONTROLS] Loading controls (app init complete)');
    this.loadControls();
  }

  ngOnDestroy(): void {
    // No cleanup needed - using QRWC which is managed by QSysService
  }

  /**
   * Load named controls from ExternalControls.xml
   * All dependencies (discovery, Lua scripts) are ready at app level
   */
  private loadControls(): void {
    try {
      this.namedControlsService.loadNamedControls();
    } catch (error) {
      console.error('[NAMED-CONTROLS] Failed to load controls:', error);
      this.namedControlsService.error.set(
        error instanceof Error ? error.message : 'Failed to load named controls'
      );
    }
  }

  /**
   * Get icon for control type
   */
  getControlIcon(type: string): string {
    switch (type) {
      case 'Float':
      case 'Integer':
        return '🎚️';
      case 'Boolean':
        return '🔘';
      case 'String':
        return '📝';
      case 'Trigger':
        return '⚡';
      default:
        return '🎛️';
    }
  }

  /**
   * Get display value for control
   */
  getDisplayValue(control: NamedControl): string {
    if (control.value === undefined && control.stringValue === undefined) {
      return '-';
    }

    if (control.stringValue !== undefined) {
      return control.stringValue;
    }

    if (typeof control.value === 'boolean') {
      return control.value ? 'On' : 'Off';
    }

    if (typeof control.value === 'number') {
      if (control.type === 'Float') {
        return control.value.toFixed(2);
      }
      return control.value.toString();
    }

    return String(control.value);
  }

  /**
   * Handle control value change
   */
  async onControlValueChange(control: NamedControl, newValue: number | string | boolean): Promise<void> {
    console.log('Named control value changed:', control.id, newValue);
    try {
      await this.namedControlsService.setControlValue(control.id, newValue);
    } catch (error) {
      console.error('Failed to set control value:', error);
    }
  }

  /**
   * Handle trigger control click
   */
  async onTriggerClick(control: NamedControl): Promise<void> {
    console.log('Triggering named control:', control.id);
    try {
      await this.namedControlsService.triggerControl(control.id);
    } catch (error) {
      console.error('Failed to trigger control:', error);
    }
  }

  /**
   * Refresh named controls list
   */
  async refresh(): Promise<void> {
    await this.namedControlsService.refresh();
  }

  /**
   * Convert NamedControl to ControlInfo for use with control components
   */
  toControlInfo(control: NamedControl): ControlInfo {
    return {
      id: control.id,
      name: control.controlId,
      string: control.stringValue || '',
      value: typeof control.value === 'number' ? control.value : 0,
      position: control.position || 0,
      type: this.mapControlType(control.type),
      direction: control.mode === 'R' ? 'output' : 'input',
      componentId: control.componentId,
      componentName: control.componentLabel
    } as ControlInfo;
  }

  /**
   * Map named control type to ControlInfo type
   */
  private mapControlType(type: string): string {
    switch (type) {
      case 'Float':
      case 'Integer':
        return 'knob';
      case 'Boolean':
        return 'led_button';
      case 'String':
        return 'text';
      case 'Trigger':
        return 'trigger';
      default:
        return 'unknown';
    }
  }
}
