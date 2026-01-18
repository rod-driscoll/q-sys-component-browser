import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { QSysService } from '../../services/qsys.service';
import { SecureTunnelDiscoveryService } from '../../services/secure-tunnel-discovery.service';
import { CredentialsDialogComponent } from '../credentials-dialog/credentials-dialog.component';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, CredentialsDialogComponent],
  template: `
    <header class="app-header">
      <div class="header-content">
        <div class="header-left">
          <h1 class="app-title">Q-SYS Component Browser</h1>
          <div class="design-name">{{ getDesignNameDisplay() }}</div>
        </div>
        
        <div class="header-status">
          <!-- Unified Connection Status Button -->
          <button class="ws-status-button" 
                  [class.secure]="secureTunnelService.useControlBasedCommunication()"
                  [class.fallback]="!secureTunnelService.useControlBasedCommunication() && secureTunnelService.isConnected()"
                  [class.disconnected]="!secureTunnelService.isConnected()"
                  (click)="toggleConnectionDetails()"
                  [title]="connectionStatusTooltip()">
            <span class="status-indicator"></span>
            <span class="ws-icon">{{ connectionIcon() }}</span>
            <span class="ws-text">{{ connectionStatusText() }}</span>
            <span class="status-detail">{{ coreAddress() }}</span>
            {{ showConnectionDetails ? '▼' : '▶' }}
          </button>
          
          <!-- Credentials Dialog -->
          <app-credentials-dialog></app-credentials-dialog>
        </div>
      </div>

      <!-- Connection Details Popup -->
      <div class="connection-details" *ngIf="showConnectionDetails">
        <div class="details-content">
          <h3>Connection Details</h3>
          <dl>
            <dt>Core Address:</dt>
            <dd>{{ coreAddress() }}</dd>
            
            <dt>Core Type:</dt>
            <dd>{{ getCoreType() }}</dd>
            
            <dt>QRWC Status:</dt>
            <dd [class.connected]="qsysService.isConnected()">{{ qsysService.isConnected() ? '✓ Connected' : '✗ Disconnected' }}</dd>
            
            <dt>Discovery Status:</dt>
            <dd [class.connected]="secureTunnelService.isConnected()">{{ secureTunnelService.isConnected() ? '✓ Connected' : '✗ Disconnected' }}</dd>
            
            <dt>Communication Mode:</dt>
            <dd [class.secure]="secureTunnelService.useControlBasedCommunication()" [class.fallback]="!secureTunnelService.useControlBasedCommunication()">
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
      overflow: visible;
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
      padding: 6px 12px;
      background: rgba(255, 255, 255, 0.15);
      border: 1px solid rgba(255, 255, 255, 0.2);
      color: white;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 500;
      transition: all 0.2s;
    }

    .ws-status-button .status-indicator {
      display: inline-block;
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: white;
      flex: 0 0 6px;
    }

    .ws-status-button.secure .status-indicator {
      background: #4caf50;
      box-shadow: 0 0 4px rgba(76, 175, 80, 0.8);
    }

    .ws-status-button.fallback .status-indicator {
      background: #ff9800;
      box-shadow: 0 0 4px rgba(255, 152, 0, 0.8);
    }

    .ws-status-button.disconnected .status-indicator {
      background: #f44336;
      box-shadow: 0 0 4px rgba(244, 67, 54, 0.8);
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
      position: fixed;
      top: 45px;
      right: 20px;
      background: white;
      color: #333;
      border-radius: 6px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
      z-index: 10000;
      min-width: 280px;
      animation: slideDown 0.2s ease-out;
    }

    @keyframes slideDown {
      from {
        opacity: 0;
        transform: translateY(-10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
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
  secureTunnelService = inject(SecureTunnelDiscoveryService);

  showConnectionDetails = false;
  private cachedStatus: any = null;
  private cachedStatusTime = 0;
  private cacheTimeout = 5000; // Cache for 5 seconds

  // Get cached core status to avoid repeated API calls
  private getCachedStatus() {
    const now = Date.now();
    if (!this.cachedStatus || (now - this.cachedStatusTime) > this.cacheTimeout) {
      try {
        this.cachedStatus = this.qsysService.getCoreStatus();
        this.cachedStatusTime = now;
      } catch (error) {
        return null;
      }
    }
    return this.cachedStatus;
  }

  // Get design name from QSysService status
  getDesignNameDisplay(): string {
    const status = this.getCachedStatus();
    return status?.designName || '';
  }

  // Get core type from QSysService status
  getCoreType(): string {
    const status = this.getCachedStatus();
    return status?.platform || 'Unknown';
  }

  // Core address without port
  coreAddress = computed(() => environment.RUNTIME_CORE_IP);

  connectionStatusText = computed(() => {
    if (!this.secureTunnelService.isConnected()) {
      return 'Initializing...';
    }
    if (this.secureTunnelService.useControlBasedCommunication()) {
      return 'Secure Tunnel';
    }
    return 'HTTP Fallback';
  });

  connectionStatusTooltip = computed(() => {
    if (!this.secureTunnelService.isConnected()) {
      return 'Discovery service is initializing';
    }
    if (this.secureTunnelService.useControlBasedCommunication()) {
      return 'Using secure control-based communication (json_input/json_output)';
    }
    return 'Using HTTP/WebSocket fallback';
  });

  connectionIcon = computed(() => {
    if (!this.secureTunnelService.isConnected()) {
      return '⏳';
    }
    if (this.secureTunnelService.useControlBasedCommunication()) {
      return '🔒';
    }
    return '⚠️';
  });

  communicationMode = computed(() => {
    if (this.secureTunnelService.useControlBasedCommunication()) {
      return 'Secure (Control-Based)';
    }
    return 'Fallback (HTTP/WebSocket)';
  });

  toggleConnectionDetails(): void {
    this.showConnectionDetails = !this.showConnectionDetails;
  }
}

