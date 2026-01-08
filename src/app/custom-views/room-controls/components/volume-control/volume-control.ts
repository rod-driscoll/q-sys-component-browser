import { Component, inject, effect, signal, viewChild, afterNextRender } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { QrwcAdapterService } from '../../services/qrwc-adapter.service';

@Component({
  selector: 'app-volume-control',
  imports: [CommonModule, FormsModule],
  templateUrl: './volume-control.html',
  styleUrl: './volume-control.css',
})
export class VolumeControl {
  readonly qrwc = inject(QrwcAdapterService);
  readonly volumeLevel = signal(0);
  readonly sliderValue = signal(0);
  readonly isMuted = signal(false);
  private isUserDragging = false;
  private dragEndTimeout?: number;
  readonly Math = Math;

  private sliderElement = viewChild<any>('volumeSlider');
  private sliderWidth = signal(200);
  private thumbWidth = signal(24);
  private sliderBorder = signal(0);

  // Calculate label position accounting for thumb width and slider border
  getLabelPosition(): number {
    const value = this.sliderValue();
    const sliderWidth = this.sliderWidth();
    const thumbWidth = this.thumbWidth();
    //const sliderBorder = this.sliderBorder();
    // Effective slider width is total width minus borders on both sides
    //const effectiveSliderWidth = sliderWidth - (sliderBorder * 2);
    const effectiveThumbWidth = thumbWidth * 3/4; // Approximate visual center of thumb
    //console.log(`SliderWidth: ${sliderWidth}, ThumbWidth: ${thumbWidth}, effectiveThumbWidth: ${effectiveThumbWidth}, SliderBorder: ${sliderBorder}`);
    const offset = (effectiveThumbWidth / sliderWidth) * 100;
    return offset + (value * (100 - 2 * offset) / 100);
  }

  constructor() {
    // Get dynamic dimensions after render
    afterNextRender(() => {
      const slider = this.sliderElement()?.nativeElement;
      if (slider) {
        const sliderStyle = window.getComputedStyle(slider);

        // Get slider width (includes border)
        this.sliderWidth.set(slider.offsetWidth);

        // Get slider border width
        const sliderBorderValue = parseInt(sliderStyle.borderLeftWidth) || 0;
        this.sliderBorder.set(sliderBorderValue);

        // Get thumb width from computed styles including borders
        try {
          const thumbStyle = window.getComputedStyle(slider, '::-webkit-slider-thumb');
          const thumbWidthValue = parseInt(thumbStyle.width) || 0;
          const thumbBorderValue = parseInt(thumbStyle.borderWidth) || 0;

          // Total visual width = content width + (border width * 2)
          const totalThumbWidth = thumbWidthValue + (thumbBorderValue * 2);

          if (totalThumbWidth > 0) {
            this.thumbWidth.set(totalThumbWidth);
          }
        } catch {
          // Fallback for browsers that don't support pseudo-element styles
          this.thumbWidth.set(24);
        }
      }
    });

    // Bind to Q-SYS Room Controls component
    effect(() => {
      const component = this.qrwc.components()?.['Room Controls'];
      if (!component) return;

      // Volume fader
      const volumeFader = component.controls['VolumeFader'];
      if (volumeFader) {
        // Always update volumeLevel for gradient
        this.volumeLevel.set(volumeFader.state.Value ?? 0);
        // Only update sliderValue when not dragging
        if (!this.isUserDragging) {
          this.sliderValue.set(volumeFader.state.Value ?? 0);
        }
        volumeFader.on('update', (state) => {
          // Always update volumeLevel for gradient
          this.volumeLevel.set(state.Value ?? 0);
          // Only update sliderValue when not dragging
          if (!this.isUserDragging) {
            this.sliderValue.set(state.Value ?? 0);
          }
        });
      }

      // Mute control
      const volumeMute = component.controls['VolumeMute'];
      if (volumeMute) {
        this.isMuted.set(volumeMute.state.Bool ?? false);
        volumeMute.on('update', (state) => {
          this.isMuted.set(state.Bool ?? false);
        });
      }
    });
  }

  volumeUpStart(): void {
    const component = this.qrwc.components()?.['Room Controls'];
    if (!component) return;

    const control = component.controls['VolumeUpDown 1'];
    if (!control) return;

    control.update(true);
  }

  volumeUpEnd(): void {
    const component = this.qrwc.components()?.['Room Controls'];
    if (!component) return;

    const control = component.controls['VolumeUpDown 1'];
    if (!control) return;

    control.update(false);
  }

  volumeDownStart(): void {
    const component = this.qrwc.components()?.['Room Controls'];
    if (!component) return;

    const control = component.controls['VolumeUpDown 2'];
    if (!control) return;

    control.update(true);
  }

  volumeDownEnd(): void {
    const component = this.qrwc.components()?.['Room Controls'];
    if (!component) return;

    const control = component.controls['VolumeUpDown 2'];
    if (!control) return;

    control.update(false);
  }

  toggleMute(): void {
    const component = this.qrwc.components()?.['Room Controls'];
    if (!component) return;

    const control = component.controls['VolumeMute'];
    if (!control) return;

    // Toggle mute
    control.update(!this.isMuted());
  }

  onVolumeChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    const value = parseFloat(target.value);

    // Only update sliderValue for smooth thumb movement
    // volumeLevel stays at the last Q-SYS value for gradient
    this.sliderValue.set(value);

    const component = this.qrwc.components()?.['Room Controls'];
    if (!component) return;

    const control = component.controls['VolumeFader'];
    if (!control) return;

    control.update(value);
  }

  onSliderStart(): void {
    // Clear any pending timeout
    if (this.dragEndTimeout) {
      clearTimeout(this.dragEndTimeout);
      this.dragEndTimeout = undefined;
    }
    this.isUserDragging = true;
  }

  onSliderEnd(): void {
    // Wait before allowing Q-SYS updates again
    this.dragEndTimeout = setTimeout(() => {
      this.isUserDragging = false;
      this.dragEndTimeout = undefined;
    }, 500);
  }
}
