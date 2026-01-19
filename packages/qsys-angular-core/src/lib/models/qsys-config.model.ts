import { InjectionToken } from '@angular/core';

/**
 * Configuration for Q-SYS Angular Core services
 */
export interface QSysConfig {
  /** Q-SYS Core IP address */
  coreIp: string;

  /** Q-SYS Core port (default: 9091) */
  corePort?: number;

  /** Default username for authentication */
  defaultUsername?: string;

  /** Default password for authentication */
  defaultPassword?: string;

  /** Use secure WebSocket (wss://) */
  secure?: boolean;

  /** Polling interval in ms (default: 350) */
  pollingInterval?: number;
}

/**
 * Injection token for Q-SYS configuration
 */
export const QSYS_CONFIG = new InjectionToken<QSysConfig>('QSYS_CONFIG');

/**
 * Default configuration values
 */
export const DEFAULT_QSYS_CONFIG: Partial<QSysConfig> = {
  corePort: 9091,
  secure: false,
  pollingInterval: 350
};
