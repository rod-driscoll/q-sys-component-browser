import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlInfo } from '../../../../services/qsys-browser.service';

@Component({
  selector: 'app-trigger-control',
  imports: [CommonModule],
  templateUrl: './trigger-control.html',
  styleUrl: './trigger-control.css',
})
export class TriggerControl {
  @Input() control!: ControlInfo;
  @Output() trigger = new EventEmitter<void>();

  onTrigger(): void {
    this.trigger.emit();
  }
}
