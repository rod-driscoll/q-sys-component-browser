import { Component, inject, effect, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { QrwcAdapterService } from '../../services/qrwc-adapter.service';

@Component({
  selector: 'app-home-card',
  imports: [CommonModule],
  templateUrl: './home-card.html',
  styleUrl: './home-card.css',
})
export class HomeCard {
  readonly qrwc = inject(QrwcAdapterService);
  readonly sourceNames = signal<string[]>(['Source One', 'Source Two', 'Source Three']);
  readonly selectedSource = signal(0);

  constructor() {
    // Bind to Q-SYS UCI Text Helper for source names
    effect(() => {
      const textHelper = this.qrwc.components()?.['UCI Text Helper'];
      if (!textHelper) return;

      // Q-SYS arrays appear as individual controls with space-separated indices
      // e.g., 'SourceNames 1', 'SourceNames 2', etc.
      const names: string[] = [];
      let i = 1;
      while (true) {
        const controlName = `SourceNames ${i}`;
        const control = textHelper.controls[controlName];
        if (!control?.state.String) {
          break; // Stop when we don't find the next control
        }

        const index = i - 1; // Convert to 0-based index for array
        names.push(control.state.String);
        control.on('update', (state) => {
          if (state.String) {
            const updated = [...this.sourceNames()];
            updated[index] = state.String;
            this.sourceNames.set(updated);
          }
        });
        i++;
      }
      if (names.length > 0) {
        this.sourceNames.set(names);
      }
    });

    // Track selected source
    effect(() => {
      const hdmiComponent = this.qrwc.components()?.['HDMISourceSelect_1'];
      if (!hdmiComponent) return;

      // Find which selector is active
      let i = 0;
      while (true) {
        const controlName = `selector.${i}`;
        const control = hdmiComponent.controls[controlName];
        if (!control) {
          //console.log(`HDMISourceSelect_1.${controlName} NOT FOUND`);
          break; // Stop when we don't find the next control
        }

        const currentIndex = i; // Capture current index for closure

        // Set initial selected state
        if (control.state.Bool) {
          this.selectedSource.set(currentIndex);
        }

        // Subscribe to updates
        control.on('update', (state) => {
          //console.log(`HDMISourceSelect_1.${controlName} NEW STATE:`, state.Bool);
          if (state.Bool) {
            this.selectedSource.set(currentIndex);
          }
        });
        i++;
      }
    });
  }

  selectSource(index: number): void {
    const component = this.qrwc.components()?.['HDMISourceSelect_1'];
    if (!component) return;

    const controlName = `selector.${index}`;
    const control = component.controls[controlName];
    if (!control) return;

    control.update(true);
  }

  getSourceIcon(index: number): string {
    const icons = ['tv', 'laptop', 'cable'];
    return icons[index] || 'input';
  }
}
