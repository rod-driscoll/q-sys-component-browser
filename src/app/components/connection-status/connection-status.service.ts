import { Injectable, signal } from '@angular/core';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ConnectionStatusService {
  // Dialog visibility state
  showSettingsDialog = signal(false);

  // Form values (initialized from environment)
  formIp = signal(environment.RUNTIME_CORE_IP);
  formUsername = signal(environment.RUNTIME_USERNAME);
  formPassword = signal(environment.RUNTIME_PASSWORD);

  openSettings(): void {
    // Reset form values to current environment values
    this.formIp.set(environment.RUNTIME_CORE_IP);
    this.formUsername.set(environment.RUNTIME_USERNAME);
    this.formPassword.set(environment.RUNTIME_PASSWORD);
    this.showSettingsDialog.set(true);
  }

  closeSettings(): void {
    this.showSettingsDialog.set(false);
  }

  /**
   * Apply new connection settings and reload the page to reconnect
   */
  applySettings(ip: string, username: string, password: string): void {
    // Update environment with new values
    environment.setConnectionParams(ip, undefined, username, password);

    // Close dialog
    this.closeSettings();

    // Reload the page to reconnect with new settings
    window.location.reload();
  }

  /**
   * Get current connection info for display
   * Note: QRWC uses port 443 for wss:// or port 80 for ws://
   */
  getConnectionInfo(): { ip: string; port: number; secure: boolean; wsUrl: string } {
    const ip = environment.RUNTIME_CORE_IP;
    const secure = environment.QRWC_USE_SECURE;
    const port = secure ? 443 : 80;
    const protocol = secure ? 'wss' : 'ws';
    const wsUrl = `${protocol}://${ip}/qrc`;

    return { ip, port, secure, wsUrl };
  }
}
