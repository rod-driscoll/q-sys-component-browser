import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ControlInfo } from '../../../../services/qsys-browser.service';

@Component({
  selector: 'app-text-control',
  imports: [CommonModule, FormsModule],
  templateUrl: './text-control.html',
  styleUrl: './text-control.css',
})
export class TextControl {
  @Input() control!: ControlInfo;
  @Input() mode: 'inline' | 'editor' = 'inline';
  @Output() valueChange = new EventEmitter<string>();

  onTextChange(event: Event): void {
    const textarea = event.target as HTMLTextAreaElement;
    this.valueChange.emit(textarea.value);
  }

  getRows(): number {
    return this.mode === 'inline' ? 2 : 4;
  }
}
