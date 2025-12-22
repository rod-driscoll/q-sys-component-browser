import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ControlInfo } from '../../../../services/qsys-browser.service';

@Component({
  selector: 'app-state-trigger-control',
  imports: [CommonModule, FormsModule],
  templateUrl: './state-trigger-control.html',
  styleUrl: './state-trigger-control.css',
})
export class StateTriggerControl {
  @Input() control!: ControlInfo;
  @Input() mode: 'inline' | 'editor' = 'inline';
  @Output() valueChange = new EventEmitter<number>();
  @Output() trigger = new EventEmitter<void>();

  onValueChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.valueChange.emit(Number(select.value));
  }

  onTrigger(): void {
    this.trigger.emit();
  }
}
