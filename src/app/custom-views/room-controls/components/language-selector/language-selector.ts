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
      if (!component) {
        console.log('[LanguageSelector] UCI Text Helper component not found');
        return;
      }

      console.log('[LanguageSelector] UCI Text Helper found, checking for LanguageSelect control');
      const languageControl = component.controls['LanguageSelect'];
      if (!languageControl) {
        console.warn('[LanguageSelector] LanguageSelect control not found on UCI Text Helper');
        console.log('[LanguageSelector] Available controls:', Object.keys(component.controls));
        return;
      }

      console.log('[LanguageSelector] LanguageSelect control found:', {
        String: languageControl.state.String,
        Choices: languageControl.state.Choices,
        Position: languageControl.state.Position,
        Value: languageControl.state.Value
      });

      // Get current language
      this.currentLanguage.set(languageControl.state.String ?? 'Language');

      // Get available language choices
      // If choices are already available, use them
      if (languageControl.state.Choices && languageControl.state.Choices.length > 0) {
        this.availableLanguages.set(languageControl.state.Choices);
        console.log('[LanguageSelector] Set available languages from state:', languageControl.state.Choices);
      } else {
        // Otherwise, fetch them via RPC
        console.log('[LanguageSelector] No Choices in state, fetching via RPC...');
        this.fetchLanguageChoices();
      }

      // Subscribe to updates
      languageControl.on('update', (state) => {
        this.currentLanguage.set(state.String ?? 'Language');
        if (state.Choices && state.Choices.length > 0) {
          this.availableLanguages.set(state.Choices);
        }
      });
    });
  }

  private async fetchLanguageChoices(): Promise<void> {
    try {
      // Access the underlying webSocketManager to make RPC call
      const qrwc = (this.qrwc as any).qsysService?.qrwc;
      if (!qrwc) {
        console.error('[LanguageSelector] QRWC not available');
        return;
      }

      const webSocketManager = (qrwc as any).webSocketManager;
      if (!webSocketManager) {
        console.error('[LanguageSelector] WebSocketManager not available');
        return;
      }

      // Fetch control details via RPC
      const result = await webSocketManager.sendRpc('Component.GetControls', {
        Name: 'UCI Text Helper'
      });

      console.log('[LanguageSelector] Component.GetControls result:', result);

      // Find the LanguageSelect control in the response
      const languageSelectControl = result?.Controls?.find((c: any) => c.Name === 'LanguageSelect');

      if (languageSelectControl?.Choices && languageSelectControl.Choices.length > 0) {
        this.availableLanguages.set(languageSelectControl.Choices);
        console.log('[LanguageSelector] Fetched languages via RPC:', languageSelectControl.Choices);
      } else {
        console.warn('[LanguageSelector] LanguageSelect control has no Choices');
      }
    } catch (error) {
      console.error('[LanguageSelector] Failed to fetch language choices:', error);
    }
  }

  toggleLanguageList(): void {
    this.showLanguageList.update(val => !val);
  }

  selectLanguage(language: string): void {
    const component = this.qrwc.components()?.['UCI Text Helper'];
    if (!component) return;

    const control = component.controls['LanguageSelect'];
    if (!control) return;

    // Find the index of the selected language in the Choices array
    const choices = control.state.Choices;
    if (!choices) return;

    const languageIndex = choices.indexOf(language);
    if (languageIndex === -1) return;

    // Update Q-SYS with selected language by position (index)
    control.setPosition(languageIndex);
    this.showLanguageList.set(false);
  }
}
