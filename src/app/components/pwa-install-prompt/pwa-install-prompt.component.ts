import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * PWA Install Prompt Component
 * Displays an install prompt to users after 5 seconds
 * Respects user dismissal for 7 days
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
          <p>Install this app for quick access and offline support</p>
          <div class="install-actions">
            <button (click)="install()" class="btn-install">Install</button>
            <button (click)="dismiss()" class="btn-dismiss">Not now</button>
          </div>
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
  `]
})
export class PwaInstallPromptComponent implements OnInit {
  protected showPrompt = signal(false);
  private deferredPrompt: any = null;

  ngOnInit(): void {
    // Listen for beforeinstallprompt event
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;

      // Only show install prompt if host is configured
      const savedHost = localStorage.getItem('qsys-host');
      if (!savedHost) {
        console.log('PWA install prompt hidden: Q-SYS host not configured. Access with ?host= parameter first.');
        return;
      }

      // Check if user previously dismissed
      const dismissed = localStorage.getItem('pwa-install-dismissed');
      const dismissedTime = dismissed ? parseInt(dismissed, 10) : 0;
      const daysSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60 * 24);

      // Show prompt if not dismissed or dismissed more than 7 days ago
      if (!dismissed || daysSinceDismissed > 7) {
        setTimeout(() => {
          console.log(`PWA install prompt will appear. Host configured: ${savedHost}`);
          this.showPrompt.set(true);
        }, 5000); // Show after 5 seconds
      }
    });

    // Handle successful installation
    window.addEventListener('appinstalled', () => {
      console.log('PWA installed successfully');
      this.showPrompt.set(false);
      localStorage.removeItem('pwa-install-dismissed');
    });
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
