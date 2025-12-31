import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlInfo } from '../../../services/qsys-browser.service';

/**
 * Combined Power control for Display Controls
 * Shows On/Off buttons that trigger PowerOn and PowerOff controls
 */
@Component({
  selector: 'app-power-control',
  imports: [CommonModule],
  templateUrl: './power-control.component.html',
  styleUrl: './power-control.component.css'
})
export class PowerControlComponent {
  /** PowerOn control */
  @Input() powerOnControl!: ControlInfo;

  /** PowerOff control */
  @Input() powerOffControl!: ControlInfo;

  /** Whether to hide the control type badge */
  @Input() hideTypeBadge: boolean = false;

  /** Whether to hide the control name */
  @Input() hideControlName: boolean = false;

  /** Emitted when On button is pressed */
  @Output() powerOn = new EventEmitter<void>();

  /** Emitted when Off button is pressed */
  @Output() powerOff = new EventEmitter<void>();

  /**
   * Handle On button click
   * Sends the opposite of the current PowerOn control value
   */
  onPowerOnClick(): void {
    this.powerOn.emit();
  }

  /**
   * Handle Off button click
   * Sends the opposite of the current PowerOff control value
   */
  onPowerOffClick(): void {
    this.powerOff.emit();
  }
}
