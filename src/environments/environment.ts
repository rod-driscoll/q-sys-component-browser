/**
 * Environment configuration for Q-SYS Angular Components
 *
 * IMPORTANT: To change the Q-SYS Core IP address, you can either:
 * 1. Update the QSYS_CORE_IP value below (default for all connections)
 * 2. Use URL parameters: ?host=192.168.1.100
 *
 * URL parameters take precedence over the default values.
 */

// Internal state for runtime overrides
let runtimeCoreIp = '192.168.104.220';
let runtimeUsername = 'admin';
let runtimePassword = 'admin';

export const environment = {
  production: false,

  // Q-SYS Core connection settings (defaults)
  // Change this IP address to match your Q-SYS Core
  QSYS_CORE_IP: '192.168.104.220',

  // Q-SYS Core authentication (defaults)
  // Update with your actual credentials
  AUTH_USERNAME: 'admin',
  AUTH_PASSWORD: 'admin',

  // Runtime overrides (set via setConnectionParams)
  get RUNTIME_CORE_IP(): string {
    return runtimeCoreIp;
  },

  get RUNTIME_CORE_PORT(): number {
    return 9091; // Q-SYS QRWC port (used for WebSocket connections)
  },

  get RUNTIME_USERNAME(): string {
    return runtimeUsername;
  },

  get RUNTIME_PASSWORD(): string {
    return runtimePassword;
  },

  // Derived URLs (use runtime values which can be overridden via URL params)
  get QSYS_HTTP_API_URL(): string {
    return `http://${runtimeCoreIp}:${this.RUNTIME_CORE_PORT}/api`;
  },

  // Method to set connection parameters at runtime (e.g., from URL params)
  setConnectionParams(ip?: string, port?: number, username?: string, password?: string): void {
    if (ip) {
      runtimeCoreIp = ip;
      console.log(`Runtime Q-SYS Core IP set to: ${ip}`);
    }
    if (username) {
      runtimeUsername = username;
      console.log(`Runtime Q-SYS username set to: ${username}`);
    }
    if (password) {
      runtimePassword = password;
      console.log(`Runtime Q-SYS password set`);
    }
    // Port override logic could go here if we weren't hardcoding 80/443 for secure
    if (port) {
      console.log(`Runtime Port Override (Not fully secure-implemented yet): ${port}`);
      // potentially override a runtimePort variable if we added one
    }
  },

  // Reset to defaults
  resetConnectionParams(): void {
    runtimeCoreIp = this.QSYS_CORE_IP;
    runtimeUsername = this.AUTH_USERNAME;
    runtimePassword = this.AUTH_PASSWORD;
    console.log('Connection parameters reset to defaults');
  }
};

// Initialize runtime values with defaults
environment.resetConnectionParams();
