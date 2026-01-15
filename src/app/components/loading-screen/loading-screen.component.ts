import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppInitializationService } from '../../services/app-initialization.service';

@Component({
  selector: 'app-loading-screen',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="loading-overlay" *ngIf="!appInit.initializationComplete()">
      <div class="loading-container">
        <div class="spinner"></div>
        <h2>Initializing Q-SYS Component Browser</h2>
        <p class="status-text">{{ appInit.loadingStage() }}</p>
        <div class="progress-bar">
          <div class="progress-fill"></div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .loading-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    }

    .loading-container {
      text-align: center;
      color: white;
    }

    .spinner {
      width: 50px;
      height: 50px;
      margin: 0 auto 30px;
      border: 4px solid rgba(255, 255, 255, 0.3);
      border-top: 4px solid white;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    h2 {
      margin: 0 0 15px 0;
      font-size: 24px;
      font-weight: 600;
    }

    .status-text {
      margin: 0 0 20px 0;
      font-size: 14px;
      opacity: 0.9;
      min-height: 20px;
    }

    .progress-bar {
      width: 300px;
      height: 4px;
      background: rgba(255, 255, 255, 0.2);
      border-radius: 2px;
      margin: 0 auto;
      overflow: hidden;
    }

    .progress-fill {
      height: 100%;
      background: white;
      border-radius: 2px;
      animation: progress 2s ease-in-out infinite;
    }

    @keyframes progress {
      0% { width: 0%; }
      50% { width: 100%; }
      100% { width: 100%; }
    }
  `]
})
export class LoadingScreenComponent {
  appInit = inject(AppInitializationService);
}
