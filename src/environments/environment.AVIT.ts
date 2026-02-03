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

  // QRWC WebSocket security setting
  // true  = wss://[IP]/qrc (port 443, requires valid SSL certificate)
  // false = ws://[IP]/qrc  (port 80, no encryption)
  // Set to false if you get SSL certificate errors with self-signed certs
  QRWC_USE_SECURE: true,

  // Q-SYS Core authentication (defaults)
  // Update with your actual credentials
  AUTH_USERNAME: 'admin',
  AUTH_PASSWORD: 'admin',

  // Runtime overrides (set via setConnectionParams)
  get RUNTIME_CORE_IP(): string {
    return runtimeCoreIp;
  },

  // Lua Server port (TunnelDiscovery.lua HTTP API and legacy WebSocket)
  // Note: This is NOT the QRWC port. QRWC uses wss://[IP]/qrc on port 443 (or ws:// on port 80)
  get LUA_SERVER_PORT(): number {
    return 9091;
  },

  get RUNTIME_USERNAME(): string {
    return runtimeUsername;
  },

  get RUNTIME_PASSWORD(): string {
    return runtimePassword;
  },

  // Lua HTTP API URL (served by TunnelDiscovery.lua script)
  // Note: This is NOT the Q-SYS Core HTTP API - it's the custom Lua server
  get LUA_HTTP_API_URL(): string {
    return `http://${runtimeCoreIp}:${this.LUA_SERVER_PORT}/api`;
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
