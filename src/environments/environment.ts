/**
 * Environment configuration for Q-SYS Angular Components
 *
 * IMPORTANT: To change the Q-SYS Core IP address, update the QSYS_CORE_IP value below.
 * This is the single source of truth for all Q-SYS Core connection settings.
 */
export const environment = {
  production: false,

  // Q-SYS Core connection settings
  // Change this IP address to match your Q-SYS Core
  QSYS_CORE_IP: '192.168.104.220',
  QSYS_CORE_PORT: 9091,

  // Derived URLs (do not modify these directly)
  get QSYS_WS_DISCOVERY_URL(): string {
    return `ws://${this.QSYS_CORE_IP}:${this.QSYS_CORE_PORT}/ws/discovery`;
  },
  get QSYS_WS_UPDATES_URL(): string {
    return `ws://${this.QSYS_CORE_IP}:${this.QSYS_CORE_PORT}/ws/updates`;
  },
  get QSYS_HTTP_API_URL(): string {
    return `http://${this.QSYS_CORE_IP}:${this.QSYS_CORE_PORT}/api`;
  }
};
