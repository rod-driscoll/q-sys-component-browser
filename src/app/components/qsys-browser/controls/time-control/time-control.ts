import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ControlInfo } from '../../../../services/qsys-browser.service';

@Component({
  selector: 'app-time-control',
  imports: [CommonModule, FormsModule],
  templateUrl: './time-control.html',
  styleUrl: './time-control.css',
})
export class TimeControl {
  @Input() control!: ControlInfo;
  @Input() mode: 'inline' | 'editor' = 'inline';
  @Output() valueChange = new EventEmitter<number>();

  onTimeChange(event: Event, segment: 'hours' | 'minutes' | 'seconds'): void {
    const input = event.target as HTMLInputElement;
    const value = input.value.padStart(2, '0');

    const hours = segment === 'hours' ? parseInt(value) || 0 : this.getHours();
    const minutes = segment === 'minutes' ? parseInt(value) || 0 : this.getMinutes();
    const seconds = segment === 'seconds' ? parseInt(value) || 0 : this.getSeconds();

    const totalSeconds = hours * 3600 + minutes * 60 + seconds;
    this.valueChange.emit(totalSeconds);
  }

  getHours(): number {
    const totalSeconds = this.control.value ?? 0;
    return Math.floor(totalSeconds / 3600);
  }

  getMinutes(): number {
    const totalSeconds = this.control.value ?? 0;
    return Math.floor((totalSeconds % 3600) / 60);
  }

  getSeconds(): number {
    const totalSeconds = this.control.value ?? 0;
    return Math.floor(totalSeconds % 60);
  }

  getHoursString(): string {
    return String(this.getHours()).padStart(2, '0');
  }

  getMinutesString(): string {
    return String(this.getMinutes()).padStart(2, '0');
  }

  getSecondsString(): string {
    return String(this.getSeconds()).padStart(2, '0');
  }
}
