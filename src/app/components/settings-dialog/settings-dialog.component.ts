import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../environments/environment';
import { QSysService } from '../../services/qsys.service';

@Component({
  selector: 'app-settings-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './settings-dialog.component.html',
  styleUrl: './settings-dialog.component.css'
})
export class SettingsDialogComponent {
  protected isOpen = signal(false);
  protected coreIp = signal('');
  protected corePort = signal('');
  protected isReconnecting = signal(false);

  constructor(private qsysService: QSysService) {}

  open(): void {
    // Load current settings from localStorage or environment
    const savedHost = localStorage.getItem('qsys-host') || environment.RUNTIME_CORE_IP;
    const savedPort = localStorage.getItem('qsys-port') || environment.RUNTIME_CORE_PORT.toString();

    this.coreIp.set(savedHost);
    this.corePort.set(savedPort);
    this.isOpen.set(true);
  }

  close(): void {
    this.isOpen.set(false);
  }

  async save(): Promise<void> {
    const ip = this.coreIp().trim();
    const port = this.corePort().trim();

    // Validate IP
    if (!ip) {
      alert('Please enter a valid IP address');
      return;
    }

    // Validate port
    const portNum = parseInt(port, 10);
    if (port && (isNaN(portNum) || portNum <= 0 || portNum > 65535)) {
      alert('Please enter a valid port (1-65535)');
      return;
    }

    // Save to localStorage
    localStorage.setItem('qsys-host', ip);
    if (port) {
      localStorage.setItem('qsys-port', port);
    } else {
      localStorage.removeItem('qsys-port');
    }

    // Update environment
    environment.setConnectionParams(ip, portNum || undefined);

    console.log('Settings saved:');
    console.log(`Core IP: ${environment.RUNTIME_CORE_IP}`);
    console.log(`Core Port: ${environment.RUNTIME_CORE_PORT}`);

    // Check if the app is running as a PWA or from a different host than the target Core
    const currentHost = window.location.hostname;
    const currentPort = window.location.port || (window.location.protocol === 'https:' ? '443' : '80');
    const targetHost = environment.RUNTIME_CORE_IP;
    const targetPort = environment.RUNTIME_CORE_PORT.toString();

    // Check if running as PWA (standalone mode)
    const isPWA = window.matchMedia('(display-mode: standalone)').matches ||
                  (window.navigator as any).standalone ||
                  document.referrer.includes('android-app://');

    // Log to both console and localStorage (localStorage persists across navigation)
    const debugInfo = {
      timestamp: new Date().toISOString(),
      currentLocation: `${currentHost}:${currentPort}`,
      targetCore: `${targetHost}:${targetPort}`,
      isPWA,
      hostsMatch: currentHost === targetHost,
      portsMatch: currentPort === targetPort,
      willReconnect: isPWA || (currentHost === targetHost && currentPort === targetPort)
    };

    localStorage.setItem('settings-debug-last', JSON.stringify(debugInfo));

    console.log(`=== Settings Save Debug ===`);
    console.log(`Current location: ${currentHost}:${currentPort}`);
    console.log(`Target Core: ${targetHost}:${targetPort}`);
    console.log(`Running as PWA: ${isPWA}`);
    console.log(`Hosts match: ${currentHost === targetHost}`);
    console.log(`Ports match: ${currentPort === targetPort}`);
    console.log(`Will reconnect without redirect: ${isPWA || (currentHost === targetHost && currentPort === targetPort)}`);

    // Always reconnect services without redirecting
    // The app is served from one location (web server or PWA cache)
    // but connects to Q-SYS Core services (QRWC, RPC, WebSocket) at the specified IP:port
    console.log('✓ Reconnecting to Q-SYS Core services without page reload');

    // Show reconnecting status
    this.isReconnecting.set(true);

    try {
      // Disconnect from current Q-SYS Core
      console.log('Disconnecting from Q-SYS Core...');
      this.qsysService.disconnect();

      // Wait a moment for cleanup
      await new Promise(resolve => setTimeout(resolve, 500));

      // Reconnect to new Q-SYS Core
      console.log('Reconnecting to Q-SYS Core with new settings...');
      console.log(`Target: ${environment.RUNTIME_CORE_IP}:${environment.RUNTIME_CORE_PORT}`);

      await this.qsysService.connect({
        coreIp: environment.RUNTIME_CORE_IP,
        secure: true,
        pollInterval: 350,
      });

      console.log('✓ Successfully reconnected to Q-SYS Core');

      // Close dialog
      this.close();
    } catch (error) {
      console.error('Failed to reconnect to Q-SYS Core:', error);
      console.error('Error details:', error);

      // Keep dialog open on error so user can try again
      alert(`Failed to reconnect to Q-SYS Core at ${environment.RUNTIME_CORE_IP}:${environment.RUNTIME_CORE_PORT}\n\nError: ${error instanceof Error ? error.message : String(error)}\n\nPlease check the IP address and port.`);
    } finally {
      this.isReconnecting.set(false);
    }
  }

  clearSettings(): void {
    if (confirm('Clear all saved connection settings? This will reload the page.')) {
      localStorage.removeItem('qsys-host');
      localStorage.removeItem('qsys-port');
      window.location.reload();
    }
  }
}
