import { Component, inject, effect, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { QrwcAdapterService } from '../../services/qrwc-adapter.service';

@Component({
  selector: 'app-help-card',
  imports: [CommonModule],
  templateUrl: './help-card.html',
  styleUrl: './help-card.css',
})
export class HelpCard {
  readonly qrwc = inject(QrwcAdapterService);
  readonly helpText         = signal('Have you tried turning it off and on again?\nIf that doesn\'t work, please use the contact information below.');
  readonly helpPhonePrompt  = signal('Call For Assistance:');
  readonly helpPhone        = signal('(555) 555-5555');
  readonly helpEmailPrompt  = signal('Email to Report Issues:');
  readonly helpEmail        = signal('help@example.com');

  constructor() {
    // Bind to Q-SYS UCI Text Helper component for help text
    effect(() => {
      const component = this.qrwc.components()?.['UCI Text Helper'];
      if (!component) return;

      const helpTextControl = component.controls['HelpText'];
      if (helpTextControl) {
        this.helpText.set(helpTextControl.state.String ?? 'Have you tried turning it off and on again? If that doesn\'t work, please use the contact information below.');
        helpTextControl.on('update', (state) => {
          this.helpText.set(state.String ?? 'Have you tried turning it off and on again? If that doesn\'t work, please use the contact information below.');
        });
      }

      const helpPhonePromptControl = component.controls['HelpPhonePrompt'];
      if (helpPhonePromptControl) {
        this.helpPhonePrompt.set(helpPhonePromptControl.state.String ?? 'Call For Assistance:');
        helpPhonePromptControl.on('update', (state) => {
          this.helpPhonePrompt.set(state.String ?? 'Call For Assistance:');
        });
      }

      const helpPhoneControl = component.controls['HelpPhone'];
      if (helpPhoneControl) {
        this.helpPhone.set(helpPhoneControl.state.String ?? '(555) 555-5555');
        helpPhoneControl.on('update', (state) => {
          this.helpPhone.set(state.String ?? '(555) 555-5555');
        });
      }

      const helpEmailPromptControl = component.controls['HelpEmailPrompt'];
      if (helpEmailPromptControl) {
        this.helpEmailPrompt.set(helpEmailPromptControl.state.String ?? 'Email to Report Issues:');
        helpEmailPromptControl.on('update', (state) => {
          this.helpEmailPrompt.set(state.String ?? 'Email to Report Issues:');
        });
      }

      const helpEmailControl = component.controls['HelpEmail'];
      if (helpEmailControl) {
        this.helpEmail.set(helpEmailControl.state.String ?? 'help@example.com');
        helpEmailControl.on('update', (state) => {
          this.helpEmail.set(state.String ?? 'help@example.com');
        });
      }
    });
  }
}
