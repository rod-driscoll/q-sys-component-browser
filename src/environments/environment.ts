/**
 * Environment configuration for Q-SYS Angular Components
 *
 * IMPORTANT: To change the Q-SYS Core IP address, you can either:
 * 1. Update the QSYS_CORE_IP value below (default for all connections)
 * 2. Use URL parameters: ?host=192.168.1.100&port=9091
 *
 * URL parameters take precedence over the default values.
 */

// Internal state for runtime overrides
let runtimeCoreIp = '192.168.6.21';
let runtimeCorePort = 9091;

export const environment = {
  production: false,

  // Q-SYS Core connection settings (defaults)
  // Change this IP address to match your Q-SYS Core
  QSYS_CORE_IP: '192.168.6.21',
  // port for http and webserver connection (not qrwc - also not the native core http server)
  // The native webserver on a qsys does not support custom projects so we install a lua webserver onto a script
  // We use this webserver to access components with 'Script' only code access (not 'External' or 'All')
  QSYS_CORE_PORT: 9091,

  // Runtime overrides (set via setConnectionParams)
  get RUNTIME_CORE_IP(): string {
    return runtimeCoreIp;
  },
  get RUNTIME_CORE_PORT(): number {
    return runtimeCorePort;
  },

  // Derived URLs (use runtime values which can be overridden via URL params)
  get QSYS_WS_DISCOVERY_URL(): string {
    return `ws://${runtimeCoreIp}:${runtimeCorePort}/ws/discovery`;
  },
  get QSYS_WS_UPDATES_URL(): string {
    return `ws://${runtimeCoreIp}:${runtimeCorePort}/ws/updates`;
  },
  get QSYS_HTTP_API_URL(): string {
    return `http://${runtimeCoreIp}:${runtimeCorePort}/api`;
  },

  // Method to set connection parameters at runtime (e.g., from URL params)
  setConnectionParams(ip?: string, port?: number): void {
    if (ip) {
      runtimeCoreIp = ip;
      console.log(`Runtime Q-SYS Core IP set to: ${ip}`);
    }
    if (port) {
      runtimeCorePort = port;
      console.log(`Runtime Q-SYS Core Port set to: ${port}`);
    }
  },

  // Reset to defaults
  resetConnectionParams(): void {
    runtimeCoreIp = this.QSYS_CORE_IP;
    runtimeCorePort = this.QSYS_CORE_PORT;
    console.log('Connection parameters reset to defaults');
  }
};

// Initialize runtime values with defaults
environment.resetConnectionParams();
