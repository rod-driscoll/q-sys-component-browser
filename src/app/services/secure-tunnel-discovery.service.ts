import { Injectable, signal, inject } from '@angular/core';
import { QSysService } from './qsys.service';
import { LuaScriptService } from './lua-script.service';
import { environment } from '../../environments/environment';

export interface DiscoveryMessage {
  type: string;
  data?: any;
  message?: string;
}

export interface DiscoveryData {
  timestamp: string;
  totalComponents: number;
  components: Array<{
    name: string;
    type: string;
    controlCount: number;
    controls: Array<any>;
    properties?: Array<any>;
    error?: string;
  }>;
}

export interface ComponentUpdate {
  type: 'componentUpdate';
  componentName: string;
  controls: Array<any>;
}

@Injectable({
  providedIn: 'root'
})
export class SecureTunnelDiscoveryService {
  private qsysService = inject(QSysService);
  private luaScriptService = inject(LuaScriptService);

  // Direct Control Names (MUST match what is in the Lua script)
  private readonly TRIGGER_CONTROL = 'trigger_update';
  private readonly OUTPUT_CONTROL = 'json_output';
  private readonly INPUT_CONTROL = 'json_input';

  // Script name to search for (Logic in LuaScriptService)
  private readonly SCRIPT_NAME_KEY = 'Tunnel Discovery';

  // State
  private boundComponentName: string | null = null;

  // Signals for reactive state
  public isConnected = signal<boolean>(false);
  public useControlBasedCommunication = signal<boolean>(false);  // Use json_input/json_output controls instead of HTTP
  public discoveryData = signal<DiscoveryData | null>(null);
  public error = signal<string | null>(null);
  public componentUpdate = signal<ComponentUpdate | null>(null);
  public connectionFailed = signal<boolean>(false);
  public loadingStage = signal<string>('');

  // Internal state for chunk reassembly
  private jsonBuffer = '';
  private expectedChunks = 0;
  private receivedChunks = 0;
  private lastPolledValue = '';

  constructor() { }

  /**
   * Connect to the Discovery Service
   * "Smart Discovery": Scans for the script component, then binds to standard controls.
   */
  async connect(): Promise<void> {
    if (this.isConnected()) {
      console.log('Discovery already connected');
      return;
    }

    console.log('Initiating Secure Component Discovery (No Named Controls)...');
    this.loadingStage.set('Connecting to Q-SYS Core...');

    try {
      // Ensure Q-SYS Service is connected
      if (!this.qsysService.isConnected()) {
        this.loadingStage.set('Waiting for QRAM connection...');
        let attempts = 0;
        while (!this.qsysService.isConnected() && attempts < 20) {
          await new Promise(r => setTimeout(r, 500));
          attempts++;
        }
        if (!this.qsysService.isConnected()) {
          throw new Error('Q-SYS Core connection failed');
        }
      }

      this.loadingStage.set('Scanning for Discovery Script...');

      // Step 1: Find the component running the script
      this.boundComponentName = await this.findDiscoveryComponent();

      if (this.boundComponentName) {
        console.log(`✓ Found Discovery Script in component: ${this.boundComponentName}`);
        this.loadingStage.set(`Found script in '${this.boundComponentName}', establishing tunnel...`);

        // Step 2: Bind to its direct controls
        await this.setupSecureTunnel(this.boundComponentName);

        // Step 3: Check if the component has json_input and json_output controls for control-based communication
        await this.checkForControlBasedCommunication(this.boundComponentName);
      } else {
        console.warn('⚠ Discovery Script not found on Core.');
        console.warn('  Secure tunnel features (File Browser, etc.) will not be available.');
        console.warn('  To enable: Load TunnelDiscovery.lua into a script component.');
        this.loadingStage.set('No Secure Tunnel');
        // Set as "connected" but without tunnel - app can still function
        this.isConnected.set(true);
        return;
      }

    } catch (err: any) {
      console.error('Discovery Connection Failed:', err);
      this.error.set(err.message || 'Failed to connect');
      this.connectionFailed.set(true);
      this.loadingStage.set('Connection Failed');
    }
  }

  /**
   * Check if the component has json_input and json_output controls
   */
  private async checkForControlBasedCommunication(componentName: string): Promise<void> {
    try {
      const webSocketManager = (this.qsysService as any).qrwc?.webSocketManager;
      if (!webSocketManager) return;

      const res = await webSocketManager.sendRpc('Component.Get', {
        Name: componentName,
        Controls: [
          { Name: this.INPUT_CONTROL },
          { Name: this.OUTPUT_CONTROL }
        ]
      });

      if (res && res.Controls && res.Controls.length === 2) {
        this.useControlBasedCommunication.set(true);
        console.log('✓ Using control-based communication (json_input/json_output)');
        this.loadingStage.set('Using Control-Based Communication');
      } else {
        console.log('Falling back to HTTP/WebSocket communication');
        this.loadingStage.set('Using HTTP/WebSocket Fallback');
      }
    } catch (err) {
      console.warn('Could not verify control-based communication, will use HTTP fallback:', err);
    }
  }

  /**
   * Scans components to find the one running the discovery script
   */
  private async findDiscoveryComponent(): Promise<string | null> {
    try {
      const components = await this.qsysService.getComponents(true);
      console.log(`Scanning ${components.length} components for Script signature...`);

      // Log all component names for debugging
      console.log('📋 All components found:');
      const controllerScripts = components.filter(c =>
        (c.type && c.type === 'device_controller_script')
      );
      
      controllerScripts.forEach((c, idx) => {
        console.log(`  [${idx}] "${c.name}" (type: ${c.type}, controls: ${c.controlCount})`);
     });

      // Filter for potential scripts
      // Don't filter by controlCount since script components often report 0 controls via GetControls
      // but have controls accessible via Component.Get RPC
      const candidates = controllerScripts;

      console.log(`Debug: Checking ${candidates.length} script components for deep scan from ${components.length} total.`);

      for (const comp of candidates) {
        try {
          // RPC to get just the Code control
          const webSocketManager = (this.qsysService as any).qrwc?.webSocketManager;
          if (!webSocketManager) {
            console.error('WebSocketManager not found');
            continue;
          }

          console.log(`Debug: Scanning component "${comp.name}"...`);
          // Use Component.Get to fetch the code control
          // Component.GetControls may not return script controls, so we use Component.Get directly
          const result = await webSocketManager.sendRpc('Component.Get', {
            Name: comp.name,
            Controls: [{ Name: 'code' }]
          }).catch(() => null);
          console.log(`Debug: Scan result for ${comp.name}:`, result);

          if (result && result.Controls) {
            console.log(`Debug: Scanning component ${comp.name} for Code control...`);
            const codeControl = result.Controls.find((c: any) => c.Name === 'Code' || c.Name === 'code');
            if (codeControl) {
              console.log(`Debug: Checked ${comp.name}, found Code control (Length: ${codeControl.String?.length})`);
              if (codeControl.String && this.luaScriptService.isScriptPresent(codeControl.String, this.SCRIPT_NAME_KEY)) {
                console.log(`Debug: MATCH FOUND in ${comp.name}`);
                return comp.name;
              }
            }
          }

          // Small delay between queries to prevent Core overload
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (scanErr) {
          // Ignore individual component scan errors
          // console.debug(`Skipping scan of ${comp.name}`, scanErr);
        }
      }
      return null;
    } catch (e) {
      console.error('Scan failed', e);
      return null;
    }
  }

  /**
   * Sets up the secure tunnel using Direct Component Controls
   */
  private async setupSecureTunnel(componentName: string): Promise<void> {
    // Subscribe to Control Updates for json_output (Q-SYS → Browser)
    // json_output: Q-SYS sends discovery data and component updates to browser
    console.log(`[TUNNEL-SETUP] Setting up subscription for ${componentName}.${this.OUTPUT_CONTROL}`);
    this.qsysService.getControlUpdates().subscribe(update => {
      console.log('[TUNNEL-SETUP] Received control update:', update.component, update.control);
      // Only listen to json_output for data FROM Q-SYS
      if (update.component === componentName && (update.control === this.OUTPUT_CONTROL || (update as any).name === this.OUTPUT_CONTROL || (update as any).Name === this.OUTPUT_CONTROL)) {
        const val = (update as any).String || (update as any).string || update.value;
        console.log(`[TUNNEL-SETUP] ✓ Matched ${componentName}.${this.OUTPUT_CONTROL}, value length:`, val?.length);
        if (val !== undefined) {
          this.handleTunnelData(val);
        }
      }
    });

    // Add json_output control to ChangeGroup to receive automatic updates FROM Q-SYS
    // json_input is for Browser → Q-SYS communication (not subscribed here)
    // Add json_output control to ChangeGroup to receive automatic updates FROM Q-SYS
    // json_input is for Browser → Q-SYS communication (not subscribed here)
    try {
      const webSocketManager = (this.qsysService as any).qrwc?.webSocketManager;
      const changeGroup = (this.qsysService as any).qrwc?.changeGroup;
      
      if (webSocketManager && changeGroup) {
        console.log(`[TUNNEL-SETUP] Adding ${componentName}.${this.OUTPUT_CONTROL} to ChangeGroup ${(changeGroup as any).id}`);
        await webSocketManager.sendRpc('ChangeGroup.AddComponentControl', {
          Id: (changeGroup as any).id,
          Component: {
            Name: componentName,
            Controls: [
              { Name: this.OUTPUT_CONTROL }  // Only subscribe to json_output (Q-SYS → Browser)
            ]
          }
        });
        console.log(`✓ Added ${this.OUTPUT_CONTROL} control to ChangeGroup for automatic updates from Q-SYS`);
      } else {
        console.warn('[TUNNEL-SETUP] Missing webSocketManager or changeGroup');
      }
    } catch (e) {
      console.error('[TUNNEL-SETUP] Failed to add control to ChangeGroup:', e);
    }

    // Send Trigger to start discovery
    // Using existing public accessor
    await this.qsysService.setControlViaRpc(componentName, this.TRIGGER_CONTROL, 1);

    // Set up manual polling for json_output since String controls may not trigger ChangeGroup updates
    // Poll every 500ms to check for component updates
    const pollInterval = setInterval(async () => {
      try {
        const webSocketManager = (this.qsysService as any).qrwc?.webSocketManager;
        if (webSocketManager) {
          const res = await webSocketManager.sendRpc('Component.Get', {
            Name: componentName,
            Controls: [{ Name: this.OUTPUT_CONTROL }]
          });
          if (res && res.Controls && res.Controls.length > 0) {
            const currentValue = res.Controls[0].String;
            if (currentValue && currentValue !== this.lastPolledValue) {
              console.log('[TUNNEL-POLL] New value detected, length:', currentValue.length);
              this.lastPolledValue = currentValue;
              this.handleTunnelData(currentValue);
            }
          }
        }
      } catch (e) {
        console.warn('[TUNNEL-POLL] Poll failed:', e);
      }
    }, 500);

    // Also, manually Poll the output control once immediately to get initial data 
    // in case the Trigger doesn't cause an auto-push of the output control change if we aren't "subscribed/change-grouped".
    // A simple follow-up Get can help ensure we see the result.
    setTimeout(async () => {
      try {
        const webSocketManager = (this.qsysService as any).qrwc?.webSocketManager;
        if (webSocketManager) {
          const res = await webSocketManager.sendRpc('Component.Get', {
            Name: componentName,
            Controls: [{ Name: this.OUTPUT_CONTROL }]
          });
          if (res && res.Controls && res.Controls.length > 0) {
            this.handleTunnelData(res.Controls[0].String);
          }
        }
      } catch (e) { console.warn('Poll failed', e); }
    }, 500);

    // Component updates will arrive via the json_output control subscription above
    // Do NOT open a direct WebSocket connection - use the secure tunnel instead

    this.isConnected.set(true);
    this.error.set(null);
    this.loadingStage.set('Secure Tunnel Established');
  }

  /**
   * Handles incoming data from the secure tunnel
   */
  private handleTunnelData(data: string): void {
    if (!data) return;

    console.log('[TUNNEL-DATA] Received:', data.substring(0, 200)); // Log first 200 chars

    if (data.startsWith('START:')) {
      this.jsonBuffer = '';
      this.expectedChunks = parseInt(data.split(':')[1], 10);
      this.receivedChunks = 0;
      this.loadingStage.set(`Receiving Data (0/${this.expectedChunks})...`);
    } else if (data.startsWith('CHUNK:')) {
      const parts = data.match(/^CHUNK:(\d+):(\d+):(.*)$/);
      if (parts) {
        const content = parts[3];
        this.jsonBuffer += content;
        this.receivedChunks++;
        this.loadingStage.set(`Receiving Data (${this.receivedChunks}/${this.expectedChunks})...`);
      }
    } else if (data === 'END') {
      this.processDiscoveryJson(this.jsonBuffer);
      this.jsonBuffer = '';
    } else if (data.trim().startsWith('{')) {
      // Try to parse as JSON to determine message type
      try {
        const message = JSON.parse(data);
        console.log('[TUNNEL-DATA] Parsed JSON message:', message);

        // Check if it's a component update message
        if (message.type === 'componentUpdate') {
          console.log('Received component update via secure tunnel:', message.componentName);
          this.componentUpdate.set(message);
        } else {
          // Otherwise process as discovery data
          console.log('[TUNNEL-DATA] Processing as discovery data');
          this.processDiscoveryJson(data);
        }
      } catch (e) {
        // If parsing fails, try processing as discovery data
        console.warn('[TUNNEL-DATA] JSON parse failed, trying as discovery data:', e);
        this.processDiscoveryJson(data);
      }
    } else {
      console.log('[TUNNEL-DATA] Unhandled data format');
    }
  }

  private processDiscoveryJson(jsonStr: string): void {
    try {
      const data = JSON.parse(jsonStr);
      console.log(`Received secure discovery data: ${data.totalComponents} components`);
      console.log('Discovery component names:', data.components?.map((c: any) => c.name || c.Name).join(', '));
      
      // Log webserver component details if found
      const webserverComp = data.components?.find((c: any) => (c.name || c.Name) === 'webserver');
      if (webserverComp) {
        console.log('Found webserver component:', webserverComp);
        if (Array.isArray(webserverComp.controls)) {
          console.log('Webserver controls:', webserverComp.controls.map((ctrl: any) => ctrl.name || ctrl.Name));
        } else {
          console.log('Webserver controls property is not an array:', typeof webserverComp.controls);
        }
      }
      
      this.discoveryData.set(data);
    } catch (e) {
      console.error('Failed to parse discovery JSON', e);
      this.error.set('Invalid Data Received');
    }
  }

  /**
   * Send a control set command through the secure tunnel (json_input)
   * Returns true if sent through tunnel, false if tunnel not available
   */
  async sendControlCommand(componentName: string, controlName: string, value: any, position?: number): Promise<boolean> {
    if (!this.boundComponentName || !this.useControlBasedCommunication()) {
      return false;
    }

    try {
      const webSocketManager = (this.qsysService as any).qrwc?.webSocketManager;
      if (!webSocketManager) {
        return false;
      }

      const command = {
        type: 'setControl',
        component: componentName,
        control: controlName,
        value: value,
        position: position
      };

      const commandJson = JSON.stringify(command);
      console.log('[TUNNEL-SEND] Sending control command via json_input:', command);

      await webSocketManager.sendRpc('Component.Set', {
        Name: this.boundComponentName,
        Controls: [{
          Name: this.INPUT_CONTROL,
          Value: 0,  // Dummy value for RPC
          String: commandJson
        }]
      });

      return true;
    } catch (e) {
      console.error('[TUNNEL-SEND] Failed to send command via tunnel:', e);
      return false;
    }
  }

  /**
   * Read a file from the Q-SYS Core via the secure tunnel (json_input/json_output)
   * @param path - File path on the Core (e.g., '/design/ExternalControls.xml')
   * @returns Promise with file content and content type
   */
  async readFile(path: string): Promise<{ content: string; contentType: string }> {
    if (!this.boundComponentName || !this.useControlBasedCommunication()) {
      throw new Error('Secure tunnel not available for file operations');
    }

    const webSocketManager = (this.qsysService as any).qrwc?.webSocketManager;
    if (!webSocketManager) {
      throw new Error('QRWC WebSocket manager not available');
    }

    // Generate unique request ID
    const requestId = `file-read-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('File read timeout (10s)'));
      }, 10000);

      // Set up one-time listener for the response
      const checkResponse = () => {
        const outputValue = this.lastPolledValue;
        if (!outputValue) return;

        try {
          const response = JSON.parse(outputValue);
          
          // Check if this is our response
          if (response.requestId === requestId) {
            clearTimeout(timeout);
            
            if (response.type === 'fileReadResponse') {
              console.log('[TUNNEL-FILE] Successfully read file:', path);
              resolve({
                content: response.content,
                contentType: response.contentType
              });
            } else if (response.type === 'fileReadError') {
              console.error('[TUNNEL-FILE] File read error:', response.error);
              reject(new Error(response.error || 'Failed to read file'));
            }
          }
        } catch (e) {
          // Not JSON or not our response, keep waiting
        }
      };

      // Poll json_output for response (every 100ms)
      const pollInterval = setInterval(() => {
        checkResponse();
      }, 100);

      // Send file read request via json_input
      const command = {
        type: 'readFile',
        requestId: requestId,
        path: path
      };

      const commandJson = JSON.stringify(command);
      console.log('[TUNNEL-FILE] Sending file read request via json_input:', command);

      webSocketManager.sendRpc('Component.Set', {
        Name: this.boundComponentName,
        Controls: [{
          Name: this.INPUT_CONTROL,
          Value: 0,
          String: commandJson
        }]
      }).then(() => {
        console.log('[TUNNEL-FILE] File read request sent, waiting for response...');
      }).catch((e) => {
        clearTimeout(timeout);
        clearInterval(pollInterval);
        reject(new Error(`Failed to send file read request: ${e}`));
      });
    });
  }

  // Legacy stubs for backward compatibility
  disconnect(): void { this.isConnected.set(false); }
  reconnect(): void { this.connect(); }
  getDiscoveryData(): DiscoveryData | null { return this.discoveryData(); }
}
