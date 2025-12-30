import { Component, signal, ViewChild, AfterViewInit, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { QsysBrowser } from './components/qsys-browser/qsys-browser';
import { environment } from '../environments/environment';

// Expose browser component globally for MCP tool integration
declare global {
  interface Window {
    qsysBrowser?: QsysBrowser;
  }
}

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, QsysBrowser],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit, AfterViewInit {
  protected readonly title = signal('q-sys-angular-components');

  @ViewChild(QsysBrowser) browserComponent?: QsysBrowser;

  ngOnInit(): void {
    // Parse URL parameters for dynamic Q-SYS Core connection settings
    this.parseUrlParameters();
  }

  ngAfterViewInit(): void {
    // Expose browser component globally so MCP tools can call its methods
    if (this.browserComponent) {
      window.qsysBrowser = this.browserComponent;
      console.log('Browser component exposed on window.qsysBrowser');
      console.log('You can now call:');
      console.log('  window.qsysBrowser.setComponentsFromMCP(componentsArray)');
      console.log('  window.qsysBrowser.setControlsFromMCP(controlsArray)');
    }
  }

  /**
   * Parse URL parameters to override Q-SYS Core connection settings
   * Supports: ?host=192.168.1.100&port=9091
   */
  private parseUrlParameters(): void {
    const urlParams = new URLSearchParams(window.location.search);
    const hostParam = urlParams.get('host');
    const portParam = urlParams.get('port');

    if (hostParam || portParam) {
      console.log('URL parameters detected, updating connection settings:');

      const port = portParam ? parseInt(portParam, 10) : undefined;

      // Validate port if provided
      if (port !== undefined && (isNaN(port) || port <= 0 || port > 65535)) {
        console.error(`Invalid port parameter: ${portParam}. Using default.`);
        environment.setConnectionParams(hostParam || undefined, undefined);
      } else {
        environment.setConnectionParams(hostParam || undefined, port);
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
