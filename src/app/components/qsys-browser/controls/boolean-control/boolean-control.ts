import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlInfo } from '../../../../services/qsys-browser.service';

@Component({
  selector: 'app-boolean-control',
  imports: [CommonModule],
  templateUrl: './boolean-control.html',
  styleUrl: './boolean-control.css',
})
export class BooleanControl {
  @Input() control!: ControlInfo;
  @Input() mode: 'inline' | 'editor' = 'inline';
  @Output() valueChange = new EventEmitter<number>();

  setValue(value: number): void {
    if (this.control.direction === 'Read Only') return;
    this.valueChange.emit(value);
  }
}
