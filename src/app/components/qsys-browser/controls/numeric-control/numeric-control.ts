import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ControlInfo } from '../../../../services/qsys-browser.service';

@Component({
  selector: 'app-numeric-control',
  imports: [CommonModule, FormsModule],
  templateUrl: './numeric-control.html',
  styleUrl: './numeric-control.css',
})
export class NumericControl {
  @Input() control!: ControlInfo;
  @Input() mode: 'inline' | 'editor' = 'inline';
  @Output() valueChange = new EventEmitter<number>();

  onValueChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = parseFloat(input.value);
    this.valueChange.emit(value);
  }

  getStep(): number {
    return this.control.type === 'Integer' ? 1 : 0.1;
  }
}
