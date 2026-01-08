import { Component, inject, effect, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { QrwcAdapterService } from '../../services/qrwc-adapter.service';

@Component({
  selector: 'app-language-selector',
  imports: [CommonModule],
  templateUrl: './language-selector.html',
  styleUrl: './language-selector.css',
})
export class LanguageSelector {
  readonly qrwc = inject(QrwcAdapterService);
  readonly currentLanguage = signal('Language');
  readonly availableLanguages = signal<string[]>([]);
  readonly showLanguageList = signal(false);

  constructor() {
    // Bind to Q-SYS UCI Text Helper component for language selection
    effect(() => {
      const component = this.qrwc.components()?.['UCI Text Helper'];
      if (!component) return;

      const languageControl = component.controls['LanguageSelect'];
      if (!languageControl) return;

      // Get current language
      this.currentLanguage.set(languageControl.state.String ?? 'Language');

      // Get available language choices
      if (languageControl.state.Choices) {
        this.availableLanguages.set(languageControl.state.Choices);
      }

      // Subscribe to updates
      languageControl.on('update', (state) => {
        this.currentLanguage.set(state.String ?? 'Language');
        if (state.Choices) {
          this.availableLanguages.set(state.Choices);
        }
      });
    });
  }

  toggleLanguageList(): void {
    this.showLanguageList.update(val => !val);
  }

  selectLanguage(language: string): void {
    const component = this.qrwc.components()?.['UCI Text Helper'];
    if (!component) return;

    const control = component.controls['LanguageSelect'];
    if (!control) return;

    // Update Q-SYS with selected language
    control.update(language);
    this.showLanguageList.set(false);
  }
}
