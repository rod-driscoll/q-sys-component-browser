import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ControlInfo } from '../../../../services/qsys-browser.service';

@Component({
  selector: 'app-combo-control',
  imports: [CommonModule, FormsModule],
  templateUrl: './combo-control.html',
  styleUrl: './combo-control.css',
})
export class ComboControl {
  @Input() control!: ControlInfo;
  @Input() mode: 'inline' | 'editor' = 'inline';
  @Output() valueChange = new EventEmitter<string>();

  onComboChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.valueChange.emit(select.value);
  }
}
