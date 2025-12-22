import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ControlInfo } from '../../../../services/qsys-browser.service';

@Component({
  selector: 'app-status-control',
  imports: [CommonModule, FormsModule],
  templateUrl: './status-control.html',
  styleUrl: './status-control.css',
})
export class StatusControl {
  @Input() control!: ControlInfo;
  @Input() mode: 'inline' | 'editor' = 'inline';
  @Output() valueChange = new EventEmitter<number>();

  onValueChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.valueChange.emit(Number(select.value));
  }

  getStatusColorClass(): string {
    const value = this.control.value;
    switch (Number(value)) {
      case 0: return 'status-green';      // OK
      case 1: return 'status-orange';     // Compromised
      case 2: return 'status-red';        // Fault
      case 3: return 'status-grey';       // Not Present
      case 4: return 'status-red';        // Missing
      case 5: return 'status-blue';       // Initializing
      default: return 'status-grey';
    }
  }
}
