import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * PWA Install Prompt Component
 * Displays an install prompt to users after 5 seconds
 * Respects user dismissal for 7 days
 * Shows iOS-specific instructions since Safari doesn't support beforeinstallprompt
 */
@Component({
  selector: 'app-pwa-install-prompt',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (showPrompt()) {
      <div class="install-prompt">
        <div class="install-content">
          <h3>Install Q-SYS Control</h3>
          @if (isIOS()) {
            <p>To install, tap <span class="ios-share-icon">&#xE900;</span> then "Add to Home Screen"</p>
            <div class="install-actions">
              <button (click)="dismiss()" class="btn-dismiss">Got it</button>
            </div>
          } @else {
            <p>Install this app for quick access and offline support</p>
            <div class="install-actions">
              <button (click)="install()" class="btn-install">Install</button>
              <button (click)="dismiss()" class="btn-dismiss">Not now</button>
            </div>
          }
        </div>
      </div>
    }
  `,
  styles: [`
    .install-prompt {
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: white;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      padding: 20px;
      max-width: 400px;
      width: calc(100% - 40px);
      z-index: 1000;
      animation: slideUp 0.3s ease-out;
    }

    @keyframes slideUp {
      from {
        transform: translateX(-50%) translateY(100px);
        opacity: 0;
      }
      to {
        transform: translateX(-50%) translateY(0);
        opacity: 1;
      }
    }

    .install-content h3 {
      margin: 0 0 8px 0;
      color: #333;
    }

    .install-content p {
      margin: 0 0 16px 0;
      color: #666;
      font-size: 14px;
    }

    .install-actions {
      display: flex;
      gap: 12px;
    }

    .btn-install, .btn-dismiss {
      flex: 1;
      padding: 10px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      transition: all 0.2s;
    }

    .btn-install {
      background: #00b4d8;
      color: white;
    }

    .btn-install:hover {
      background: #0096b8;
    }

    .btn-dismiss {
      background: #f0f0f0;
      color: #666;
    }

    .btn-dismiss:hover {
      background: #e0e0e0;
    }

    .ios-share-icon {
      display: inline-block;
      width: 20px;
      height: 20px;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23007AFF'%3E%3Cpath d='M12 2l3.5 3.5-1.4 1.4L12 4.8l-2.1 2.1-1.4-1.4L12 2zm-1 5h2v9h-2V7zm-5 7h3v2H6v4h12v-4h-3v-2h5v8H4v-8h2z'/%3E%3C/svg%3E");
      background-size: contain;
      background-repeat: no-repeat;
      vertical-align: middle;
      margin: 0 2px;
    }
  `]
})
export class PwaInstallPromptComponent implements OnInit {
  protected showPrompt = signal(false);
  private deferredPrompt: any = null;
  private _isIOS = false;

  ngOnInit(): void {
    // Detect iOS
    this._isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    // Check if already running as standalone PWA
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;

    if (isStandalone) {
      console.log('PWA install prompt hidden: Already running as installed PWA');
      return;
    }

    // For iOS, show manual instructions
    if (this._isIOS) {
      this.showIOSPromptIfEligible();
      return;
    }

    // Listen for beforeinstallprompt event (Chrome, Edge, etc.)
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;
      this.showPromptIfEligible();
    });

    // Handle successful installation
    window.addEventListener('appinstalled', () => {
      console.log('PWA installed successfully');
      this.showPrompt.set(false);
      localStorage.removeItem('pwa-install-dismissed');
    });
  }

  private showPromptIfEligible(): void {
    // Only show install prompt if host is configured
    const savedHost = localStorage.getItem('qsys-host');
    if (!savedHost) {
      console.log('PWA install prompt hidden: Q-SYS host not configured. Access with ?host= parameter first.');
      return;
    }

    if (!this.shouldShowPrompt()) {
      return;
    }

    setTimeout(() => {
      console.log(`PWA install prompt will appear. Host configured: ${savedHost}`);
      this.showPrompt.set(true);
    }, 5000);
  }

  private showIOSPromptIfEligible(): void {
    const savedHost = localStorage.getItem('qsys-host');
    if (!savedHost) {
      console.log('iOS PWA prompt hidden: Q-SYS host not configured.');
      return;
    }

    if (!this.shouldShowPrompt()) {
      return;
    }

    setTimeout(() => {
      console.log('iOS PWA install instructions will appear');
      this.showPrompt.set(true);
    }, 5000);
  }

  private shouldShowPrompt(): boolean {
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    if (!dismissed) {
      return true;
    }
    const dismissedTime = parseInt(dismissed, 10);
    const daysSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60 * 24);
    return daysSinceDismissed > 7;
  }

  isIOS(): boolean {
    return this._isIOS;
  }

  async install(): Promise<void> {
    if (!this.deferredPrompt) {
      return;
    }

    this.deferredPrompt.prompt();
    const { outcome } = await this.deferredPrompt.userChoice;

    console.log(`Install prompt ${outcome}`);

    this.deferredPrompt = null;
    this.showPrompt.set(false);
  }

  dismiss(): void {
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
    this.showPrompt.set(false);
  }
}
