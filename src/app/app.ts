import { Component, signal, OnInit, ViewChild } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { environment } from '../environments/environment';
import { QSysService } from './services/qsys.service';
import { PwaInstallPromptComponent } from './components/pwa-install-prompt/pwa-install-prompt.component';
import { SettingsDialogComponent } from './components/settings-dialog/settings-dialog.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, PwaInstallPromptComponent, SettingsDialogComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {
  protected readonly title = signal('q-sys-angular-components');

  @ViewChild(SettingsDialogComponent) settingsDialog!: SettingsDialogComponent;

  constructor(private qsysService: QSysService) {}

  ngOnInit(): void {
    // Parse URL parameters for dynamic Q-SYS Core connection settings
    this.parseUrlParameters();

    // Connect to Q-SYS Core on app initialization
    this.connectToQSys();
  }

  /**
   * Connect to Q-SYS Core at app level
   * This ensures connection is available regardless of entry route
   */
  private connectToQSys(): void {
    this.qsysService.connect({
      coreIp: environment.RUNTIME_CORE_IP,
      secure: true,
      pollInterval: 35,
    }).catch((error) => {
      console.error('Failed to connect to Q-SYS Core:', error);
    });
  }

  /**
   * Parse URL parameters to override Q-SYS Core connection settings
   * Supports two formats:
   *   1. ?host=192.168.1.100:9092 (host with port)
   *   2. ?host=192.168.1.100&port=9092 (separate parameters)
   * Saves parameters to localStorage for PWA use
   */
  private parseUrlParameters(): void {
    const urlParams = new URLSearchParams(window.location.search);
    let hostParam = urlParams.get('host');
    let portParam = urlParams.get('port');

    // Parse host:port format if host contains a colon
    if (hostParam && hostParam.includes(':')) {
      const parts = hostParam.split(':');
      hostParam = parts[0];
      portParam = parts[1]; // Override port parameter with value from host
      console.log(`Parsed host:port format - Host: ${hostParam}, Port: ${portParam}`);
    }

    // Check localStorage for saved connection parameters
    const savedHost = localStorage.getItem('qsys-host');
    const savedPort = localStorage.getItem('qsys-port');

    // URL parameters take precedence over localStorage
    const finalHost = hostParam || savedHost;
    const finalPort = portParam || savedPort;

    if (hostParam || portParam) {
      console.log('URL parameters detected, saving to localStorage and updating connection settings:');

      // Save to localStorage for future PWA launches
      if (hostParam) {
        localStorage.setItem('qsys-host', hostParam);
      }
      if (portParam) {
        localStorage.setItem('qsys-port', portParam);
      }
    } else if (savedHost || savedPort) {
      console.log('Using saved connection settings from localStorage:');
    }

    if (finalHost || finalPort) {
      const port = finalPort ? parseInt(finalPort, 10) : undefined;

      // Validate port if provided
      if (port !== undefined && (isNaN(port) || port <= 0 || port > 65535)) {
        console.error(`Invalid port parameter: ${finalPort}. Using default.`);
        environment.setConnectionParams(finalHost || undefined, undefined);
      } else {
        environment.setConnectionParams(finalHost || undefined, port);
      }

      // Log the active connection settings
      console.log(`Active Q-SYS Core IP: ${environment.RUNTIME_CORE_IP}`);
      console.log(`Active Q-SYS Core Port: ${environment.RUNTIME_CORE_PORT}`);
      console.log(`WebSocket Discovery URL: ${environment.QSYS_WS_DISCOVERY_URL}`);
      console.log(`HTTP API URL: ${environment.QSYS_HTTP_API_URL}`);
    } else {
      console.log(`Using default Q-SYS Core connection: ${environment.RUNTIME_CORE_IP}:${environment.RUNTIME_CORE_PORT}`);
    }
  }
}
