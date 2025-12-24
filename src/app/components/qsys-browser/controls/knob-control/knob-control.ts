import { Component, Input, Output, EventEmitter, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ControlInfo } from '../../../../services/qsys-browser.service';
import { Subject, Subscription } from 'rxjs';
import { throttleTime } from 'rxjs/operators';

@Component({
  selector: 'app-knob-control',
  imports: [CommonModule, FormsModule],
  templateUrl: './knob-control.html',
  styleUrl: './knob-control.css',
})
export class KnobControl implements OnDestroy {
  @Input() control!: ControlInfo;
  @Input() mode: 'inline' | 'positionChange' | 'editor' = 'inline';
  @Output() valueChange = new EventEmitter<number>();
  @Output() positionChange = new EventEmitter<number>();
  @Output() dragStart = new EventEmitter<void>();
  @Output() dragEnd = new EventEmitter<void>();

  private inputSubject = new Subject<number>();
  private subscription: Subscription;

  // Feedback suppression state
  private isAdjusting = false;
  private localPosition = 0;
  private lastSentPosition: number | null = null;
  private feedbackTimeoutId: any = null;

  constructor() {
    this.subscription = this.inputSubject.pipe(
      throttleTime(200, undefined, { leading: true, trailing: true })
    ).subscribe(position => {
      // Track the last position we sent
      this.lastSentPosition = position;
      // Emit position (0-1)
      this.positionChange.emit(position);
    });
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
    if (this.feedbackTimeoutId) {
      clearTimeout(this.feedbackTimeoutId);
    }
  }

  // Get the position to display on the slider
  // If adjusting, use local position to prevent jumping/fighting with server updates
  get checkPosition(): number {
    if (this.isAdjusting) {
      return this.localPosition;
    }

    // If we recently sent a position and the feedback matches (within tolerance), accept it
    if (this.lastSentPosition !== null) {
      const feedbackPosition = this.control.position ?? 0;
      const tolerance = 0.01; // 1% tolerance
      if (Math.abs(feedbackPosition - this.lastSentPosition) < tolerance) {
        // Feedback matches our last sent position, clear the tracking
        this.lastSentPosition = null;
      } else {
        // Feedback doesn't match yet, keep using local position to prevent jump
        return this.localPosition;
      }
    }

    return this.control.position ?? 0;
  }

  onSliderInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const position = parseFloat(input.value);

    // Update local position immediately
    this.localPosition = position;

    // If we receive input, we are adjusting
    if (!this.isAdjusting) {
      this.startAdjusting();
    }

    // Emit position (0-1) directly
    // This allows the server to handle the correct mapping (e.g. Logarithmic)
    this.inputSubject.next(position);
  }

  onAbsoluteValueChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const absoluteValue = parseFloat(input.value);

    const valueMin = this.control.valueMin ?? 0;
    const valueMax = this.control.valueMax ?? 1;

    // Clamp to valid range
    const clampedValue = Math.max(valueMin, Math.min(valueMax, absoluteValue));

    // Direct update, no throttling needed for manual entry
    this.valueChange.emit(clampedValue);
  }

  startAdjusting(): void {
    this.isAdjusting = true;
    if (this.feedbackTimeoutId) {
      clearTimeout(this.feedbackTimeoutId);
      this.feedbackTimeoutId = null;
    }
  }

  onDragStart(): void {
    this.startAdjusting();
    // Initialize local position from current control position to avoid jump
    this.localPosition = this.control.position ?? 0;
    this.dragStart.emit();
  }

  onDragEnd(): void {
    // Set timeout to re-enable feedback after 500ms
    this.feedbackTimeoutId = setTimeout(() => {
      this.isAdjusting = false;
      this.feedbackTimeoutId = null;
    }, 500);

    this.dragEnd.emit();
  }

  getAbsoluteValue(): number {
    // Use the actual value from QRWC instead of calculating from position
    // QRWC already provides the correct absolute value
    if (this.control.value !== undefined) {
      return Math.round(this.control.value * 100) / 100;
    }

    // Fallback to position-based calculation if value is not available
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
    if (this.control.string) {
      return this.control.string;
    }
    return this.getAbsoluteValue().toFixed(1);
  }
}
