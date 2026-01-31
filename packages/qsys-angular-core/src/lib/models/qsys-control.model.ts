export type ControlType = 'Text' | 'Boolean' | 'Trigger' | 'Float' | 'Integer' | 'Status' | 'Time' | 'Array';
export type ControlDirection = 'Read/Write' | 'Read Only' | 'Write Only';

export interface QSysControl {
  name: string;
  type: ControlType;
  direction: ControlDirection;
  value?: any;
  position?: number;
  string?: string;
}

export interface QSysComponent {
  name: string;
  controls: Map<string, QSysControl>;
}

export interface QrwcMessage {
  method?: string;
  params?: any;
  id?: number;
  jsonrpc?: string;
  result?: any;
  error?: any;
}

/**
 * Default poll interval in milliseconds for QRWC ChangeGroup polling.
 * This is the canonical source - all poll intervals should reference this constant.
 */
export const DEFAULT_POLL_INTERVAL = 350;

export interface QrwcConnectionOptions {
  coreIp: string;
  redundantCoreIp?: string;
  secure?: boolean;
  pollInterval?: number;
  controlFilter?: string[];
}
