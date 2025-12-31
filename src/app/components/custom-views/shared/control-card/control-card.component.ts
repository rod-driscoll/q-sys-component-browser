import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlInfo } from '../../../../services/qsys-browser.service';
import { KnobControl } from '../../../qsys-browser/controls/knob-control/knob-control';
import { BooleanControl } from '../../../qsys-browser/controls/boolean-control/boolean-control';
import { NumericControl } from '../../../qsys-browser/controls/numeric-control/numeric-control';
import { ComboControl } from '../../../qsys-browser/controls/combo-control/combo-control';
import { TextControl } from '../../../qsys-browser/controls/text-control/text-control';
import { TriggerControl } from '../../../qsys-browser/controls/trigger-control/trigger-control';
import { StateTriggerControl } from '../../../qsys-browser/controls/state-trigger-control/state-trigger-control';
import { TimeControl } from '../../../qsys-browser/controls/time-control/time-control';

/**
 * Reusable card component for rendering any control type
 * Wraps the appropriate control component based on the control type
 */
@Component({
  selector: 'app-control-card',
  imports: [
    CommonModule,
    KnobControl,
    BooleanControl,
    NumericControl,
    ComboControl,
    TextControl,
    TriggerControl,
    StateTriggerControl,
    TimeControl
  ],
  templateUrl: './control-card.component.html',
  styleUrl: './control-card.component.css'
})
export class ControlCardComponent {
  /** The control to display */
  @Input() control!: ControlInfo;

  /** Whether to show the component name badge */
  @Input() showComponentName: boolean = true;

  /** Emitted when control value changes */
  @Output() valueChange = new EventEmitter<any>();

  /** Emitted when control position changes (for knobs, sliders) */
  @Output() positionChange = new EventEmitter<number>();

  /** Emitted when user starts dragging a control */
  @Output() dragStart = new EventEmitter<void>();

  /** Emitted when user stops dragging a control */
  @Output() dragEnd = new EventEmitter<void>();

  /**
   * Get display name for the control
   * Shows control name and component name if different
   */
  get displayName(): string {
    return this.control.name;
  }

  /**
   * Get control type badge text
   */
  get typeBadge(): string {
    return this.control.type;
  }

  /**
   * Determine if this control type is supported
   */
  get isSupported(): boolean {
    const supportedTypes = [
      'Knob', 'Boolean', 'Float', 'Integer',
      'Combo box', 'Text', 'Trigger', 'State Trigger', 'Time'
    ];
    return supportedTypes.includes(this.control.type);
  }
}
