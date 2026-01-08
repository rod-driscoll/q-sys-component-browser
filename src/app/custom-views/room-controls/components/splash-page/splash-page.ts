import { Component, inject, effect, signal, output } from '@angular/core';
import { QrwcAdapterService } from '../../services/qrwc-adapter.service';
import { LanguageSelector } from '../language-selector/language-selector';

@Component({
  selector: 'app-splash-page',
  imports: [LanguageSelector],
  templateUrl: './splash-page.html',
  styleUrl: './splash-page.css',
})
export class SplashPage {
  readonly qrwc = inject(QrwcAdapterService);
  readonly splashText = signal('Touch Screen to Continue');
  readonly onNavigateToBase = output<void>();

  constructor() {
    // Bind to Q-SYS UCI Text Helper component for splash text
    effect(() => {
      const component = this.qrwc.components()?.['UCI Text Helper'];
      if (!component) return;

      const control = component.controls['SplashText'];
      if (!control) return;

      // Initialize signal with current value
      this.splashText.set(control.state.String ?? 'Touch Screen to Continue');

      // Subscribe to updates
      control.on('update', (state) => {
        this.splashText.set(state.String ?? 'Touch Screen to Continue');
      });
    });
  }

  handleClick(): void {
    this.onNavigateToBase.emit();
  }
}
