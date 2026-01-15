import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { QSysService } from '../../services/qsys.service';
import { WebSocketDiscoveryService } from '../../services/websocket-discovery.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule],
  template: `
    <header class="app-header">
      <div class="header-content">
        <div class="header-left">
          <h1 class="app-title">Q-SYS Component Browser</h1>
          <div class="design-name" *ngIf="designName()">{{ designName() }}</div>
        </div>
        
        <div class="header-status">
          <!-- QRWC Connection Status -->
          <div class="status-item" [class.connected]="qsysService.isConnected()" [class.disconnected]="!qsysService.isConnected()">
            <span class="status-indicator"></span>
            <span class="status-label">{{ qsysService.isConnected() ? 'Connected' : 'Disconnected' }}</span>
            <span class="status-detail" *ngIf="qsysService.isConnected()">{{ coreAddress() }}</span>
          </div>

          <!-- WebSocket Connection Status Button -->
          <button class="ws-status-button" 
                  [class.secure]="wsDiscoveryService.useControlBasedCommunication()"
                  [class.fallback]="!wsDiscoveryService.useControlBasedCommunication() && wsDiscoveryService.isConnected()"
                  [class.disconnected]="!wsDiscoveryService.isConnected()"
                  (click)="toggleConnectionDetails()"
                  [title]="connectionStatusTooltip()">
            <span class="ws-icon">{{ connectionIcon() }}</span>
            <span class="ws-text">{{ connectionStatusText() }}</span>
            {{ showConnectionDetails ? '▼' : '▶' }}
          </button>
        </div>
      </div>

      <!-- Connection Details Popup -->
      <div class="connection-details" *ngIf="showConnectionDetails">
        <div class="details-content">
          <h3>Connection Details</h3>
          <dl>
            <dt>Core Address:</dt>
            <dd>{{ coreAddress() }}</dd>
            
            <dt>QRWC Status:</dt>
            <dd [class.connected]="qsysService.isConnected()">{{ qsysService.isConnected() ? '✓ Connected' : '✗ Disconnected' }}</dd>
            
            <dt>Discovery Status:</dt>
            <dd [class.connected]="wsDiscoveryService.isConnected()">{{ wsDiscoveryService.isConnected() ? '✓ Connected' : '✗ Disconnected' }}</dd>
            
            <dt>Communication Mode:</dt>
            <dd [class.secure]="wsDiscoveryService.useControlBasedCommunication()" [class.fallback]="!wsDiscoveryService.useControlBasedCommunication()">
              {{ communicationMode() }}
            </dd>
          </dl>
          <button class="close-btn" (click)="toggleConnectionDetails()">Close</button>
        </div>
      </div>
    </header>
  `,
  styles: [`
    .app-header {
      background-color: #2c3e50;
      color: white;
      padding: 0;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      position: sticky;
      top: 0;
      z-index: 100;
      position: relative;
    }

    .header-content {
      max-width: 1400px;
      margin: 0 auto;
      padding: 8px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 20px;
    }

    .header-left {
      display: flex;
      flex-direction: column;
      gap: 2px;
      flex: 0 0 auto;
    }

    .app-title {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
    }

    .design-name {
      font-size: 12px;
      opacity: 0.8;
      font-family: 'Courier New', monospace;
    }

    .header-status {
      display: flex;
      gap: 12px;
      align-items: center;
      flex-wrap: wrap;
    }

    .status-item {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      padding: 4px 10px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 4px;
      transition: background 0.2s;
    }

    .status-item.connected {
      background: rgba(76, 175, 80, 0.2);
    }

    .status-item.disconnected {
      background: rgba(244, 67, 54, 0.2);
    }

    .status-indicator {
      display: inline-block;
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: white;
      flex: 0 0 6px;
    }

    .status-item.connected .status-indicator {
      background: #4caf50;
      box-shadow: 0 0 4px rgba(76, 175, 80, 0.8);
    }

    .status-item.disconnected .status-indicator {
      background: #f44336;
    }

    .status-label {
      font-weight: 500;
      white-space: nowrap;
    }

    .status-detail {
      font-size: 11px;
      opacity: 0.8;
      font-family: 'Courier New', monospace;
    }

    .ws-status-button {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      background: rgba(255, 255, 255, 0.15);
      border: 1px solid rgba(255, 255, 255, 0.2);
      color: white;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 500;
      transition: all 0.2s;
      white-space: nowrap;
    }

    .ws-status-button:hover {
      background: rgba(255, 255, 255, 0.25);
      transform: scale(1.05);
    }

    .ws-status-button:active {
      transform: scale(0.98);
    }

    .ws-status-button.secure {
      background: rgba(76, 175, 80, 0.3);
      border-color: rgba(76, 175, 80, 0.5);
    }

    .ws-status-button.secure:hover {
      background: rgba(76, 175, 80, 0.4);
      box-shadow: 0 0 8px rgba(76, 175, 80, 0.4);
    }

    .ws-status-button.fallback {
      background: rgba(255, 152, 0, 0.3);
      border-color: rgba(255, 152, 0, 0.5);
    }

    .ws-status-button.fallback:hover {
      background: rgba(255, 152, 0, 0.4);
      box-shadow: 0 0 8px rgba(255, 152, 0, 0.4);
    }

    .ws-status-button.disconnected {
      background: rgba(244, 67, 54, 0.3);
      border-color: rgba(244, 67, 54, 0.5);
    }

    .ws-status-button.disconnected:hover {
      background: rgba(244, 67, 54, 0.4);
      box-shadow: 0 0 8px rgba(244, 67, 54, 0.4);
    }

    .ws-icon {
      font-size: 12px;
    }

    .connection-details {
      position: absolute;
      top: 100%;
      right: 20px;
      background: white;
      color: #333;
      border-radius: 6px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
      z-index: 1000;
      min-width: 280px;
      margin-top: 6px;
    }

    .details-content {
      padding: 12px;
    }

    .connection-details h3 {
      margin: 0 0 10px 0;
      font-size: 14px;
      font-weight: 600;
    }

    .connection-details dl {
      margin: 0;
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 6px 10px;
    }

    .connection-details dt {
      font-weight: 600;
      font-size: 12px;
      color: #666;
    }

    .connection-details dd {
      margin: 0;
      font-size: 12px;
      word-break: break-all;
    }

    .connection-details dd.connected {
      color: #4caf50;
      font-weight: 500;
    }

    .connection-details dd.secure {
      color: #4caf50;
      font-weight: 500;
    }

    .connection-details dd.fallback {
      color: #ff9800;
      font-weight: 500;
    }

    .close-btn {
      margin-top: 10px;
      padding: 4px 10px;
      background: #f5f5f5;
      border: 1px solid #ddd;
      border-radius: 3px;
      cursor: pointer;
      font-size: 12px;
      width: 100%;
      transition: background 0.2s;
    }

    .close-btn:hover {
      background: #e8e8e8;
    }

    @media (max-width: 768px) {
      .header-content {
        flex-direction: column;
        gap: 8px;
      }

      .header-left {
        width: 100%;
      }

      .header-status {
        width: 100%;
        flex-direction: column;
      }

      .status-item, .ws-status-button {
        width: 100%;
        justify-content: space-between;
      }

      .connection-details {
        position: fixed;
        left: 10px;
        right: 10px;
        width: auto;
      }
    }
  `]
})
export class HeaderComponent {
  qsysService = inject(QSysService);
  wsDiscoveryService = inject(WebSocketDiscoveryService);

  showConnectionDetails = false;

  // Get design name from QSysService status
  designName = computed(() => {
    const status = (this.qsysService as any).status?.();
    return status ? status.designName : null;
  });

  // Core address without port
  coreAddress = computed(() => environment.RUNTIME_CORE_IP);

  connectionStatusText = computed(() => {
    if (!this.wsDiscoveryService.isConnected()) {
      return 'Initializing...';
    }
    if (this.wsDiscoveryService.useControlBasedCommunication()) {
      return 'Secure Tunnel';
    }
    return 'HTTP Fallback';
  });

  connectionStatusTooltip = computed(() => {
    if (!this.wsDiscoveryService.isConnected()) {
      return 'Discovery service is initializing';
    }
    if (this.wsDiscoveryService.useControlBasedCommunication()) {
      return 'Using secure control-based communication (json_input/json_output)';
    }
    return 'Using HTTP/WebSocket fallback';
  });

  connectionIcon = computed(() => {
    if (!this.wsDiscoveryService.isConnected()) {
      return '⏳';
    }
    if (this.wsDiscoveryService.useControlBasedCommunication()) {
      return '🔒';
    }
    return '⚠️';
  });

  communicationMode = computed(() => {
    if (this.wsDiscoveryService.useControlBasedCommunication()) {
      return 'Secure (Control-Based)';
    }
    return 'Fallback (HTTP/WebSocket)';
  });

  toggleConnectionDetails(): void {
    this.showConnectionDetails = !this.showConnectionDetails;
  }
}

