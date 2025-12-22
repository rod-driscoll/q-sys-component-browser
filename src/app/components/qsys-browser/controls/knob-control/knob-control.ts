import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ControlInfo } from '../../../../services/qsys-browser.service';

@Component({
  selector: 'app-knob-control',
  imports: [CommonModule, FormsModule],
  templateUrl: './knob-control.html',
  styleUrl: './knob-control.css',
})
export class KnobControl {
  @Input() control!: ControlInfo;
  @Input() mode: 'inline' | 'editor' = 'inline';
  @Output() valueChange = new EventEmitter<number>();
  @Output() dragStart = new EventEmitter<void>();
  @Output() dragEnd = new EventEmitter<void>();

  onSliderInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const position = parseFloat(input.value);

    // Convert position (0-1) to absolute value in range
    const valueMin = this.control.valueMin ?? 0;
    const valueMax = this.control.valueMax ?? 1;
    const value = valueMin + (position * (valueMax - valueMin));

    this.valueChange.emit(value);
  }

  onAbsoluteValueChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const absoluteValue = parseFloat(input.value);

    const valueMin = this.control.valueMin ?? 0;
    const valueMax = this.control.valueMax ?? 1;

    // Clamp to valid range
    const clampedValue = Math.max(valueMin, Math.min(valueMax, absoluteValue));

    this.valueChange.emit(clampedValue);
  }

  onDragStart(): void {
    this.dragStart.emit();
  }

  onDragEnd(): void {
    this.dragEnd.emit();
  }

  getAbsoluteValue(): number {
    const valueMin = this.control.valueMin ?? 0;
    const valueMax = this.control.valueMax ?? 1;
    const position = this.control.position ?? 0;

    const absoluteValue = valueMin + (position * (valueMax - valueMin));
    return Math.round(absoluteValue * 100) / 100;
  }

  getValueStep(): number {
    const valueMin = this.control.valueMin ?? 0;
    const valueMax = this.control.valueMax ?? 1;
    const range = valueMax - valueMin;

    if (range > 1000) return 10;
    if (range > 100) return 1;
    if (range > 10) return 0.1;
    return 0.01;
  }

  getDisplayValue(): string {
    return this.getAbsoluteValue().toFixed(1);
  }
}
