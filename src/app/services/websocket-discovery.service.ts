import { Injectable, signal, inject } from '@angular/core';
import { QSysService } from './qsys.service';
import { LuaScriptService } from './lua-script.service';

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
export class WebSocketDiscoveryService {
  private qsysService = inject(QSysService);
  private luaScriptService = inject(LuaScriptService);

  // Direct Control Names (MUST match what is in the Lua script)
  private readonly TRIGGER_CONTROL = 'trigger_update';
  private readonly OUTPUT_CONTROL = 'json_output';
  private readonly INPUT_CONTROL = 'json_input';

  // Script name to search for (Logic in LuaScriptService)
  private readonly SCRIPT_NAME_KEY = 'WebSocket Component Discovery';

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
        console.log(`Found Discovery Script in component: ${this.boundComponentName}`);
        this.loadingStage.set(`Found script in '${this.boundComponentName}', establishing tunnel...`);

        // Step 2: Bind to its direct controls
        await this.setupSecureTunnel(this.boundComponentName);

        // Step 3: Check if the component has json_input and json_output controls for control-based communication
        await this.checkForControlBasedCommunication(this.boundComponentName);
      } else {
        throw new Error('Discovery Script not found on Core. Please ensure WebSocketComponentDiscovery.lua is running in a script component.');
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

      // Filter for potential scripts
      // Optimization: Prioritize components with "Script" in name or type, or specifically "webserver" as per user config
      const candidates = components.filter(c =>
        (c.type && c.type === 'device_controller_script') &&
        (c.controlCount > 0) // Fallback: Check all components with controls if needed, but this is slow.
      );

      console.log(`Debug: Filtered ${candidates.length} candidates for deep scan from ${components.length} total.`);

      for (const comp of candidates) {
        try {
          // RPC to get just the Code control
          const webSocketManager = (this.qsysService as any).qrwc?.webSocketManager;
          if (!webSocketManager) {
            console.error('WebSocketManager not found');
            continue;
          }

          console.log(`Debug: Scanning component "${comp.name}"...`);
          // Fetch 'Code' control - Note: 'code' (lowercase) or 'Code' (Titlecase)
          // The user said "code" control. Q-SYS RPC is case sensitive for Names? Usually TitleCase "Code".
          // We will try both or just "Code" as standard. User said 'code'.
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
    // Subscribe to Control Updates for json_output (discovery data)
    this.qsysService.getControlUpdates().subscribe(update => {
      // Check if update is for OUR component and output control
      if (update.component === componentName && (update.control === this.OUTPUT_CONTROL || (update as any).name === this.OUTPUT_CONTROL || (update as any).Name === this.OUTPUT_CONTROL)) {
        const val = (update as any).String || (update as any).string || update.value;
        if (val !== undefined) {
          this.handleTunnelData(val);
        }
      }
      
      // Also check for json_input control (component updates)
      if (update.component === componentName && (update.control === this.INPUT_CONTROL || (update as any).name === this.INPUT_CONTROL || (update as any).Name === this.INPUT_CONTROL)) {
        const val = (update as any).String || (update as any).string || update.value;
        if (val !== undefined) {
          this.handleTunnelData(val);
        }
      }
    });

    // Add both json_output and json_input controls to ChangeGroup to receive automatic updates
    try {
      const webSocketManager = (this.qsysService as any).qrwc?.webSocketManager;
      const changeGroup = (this.qsysService as any).qrwc?.changeGroup;
      
      if (webSocketManager && changeGroup) {
        await webSocketManager.sendRpc('ChangeGroup.AddComponentControl', {
          Id: (changeGroup as any).id,
          Component: {
            Name: componentName,
            Controls: [
              { Name: this.OUTPUT_CONTROL },
              { Name: this.INPUT_CONTROL }
            ]
          }
        });
        console.log(`✓ Added ${this.OUTPUT_CONTROL} and ${this.INPUT_CONTROL} controls to ChangeGroup for automatic updates`);
      }
    } catch (e) {
      console.warn('Could not add controls to ChangeGroup:', e);
    }

    // Send Trigger to start discovery
    // Using existing public accessor
    await this.qsysService.setControlViaRpc(componentName, this.TRIGGER_CONTROL, 1);

    // Also, we might want to manually Poll the output control once to be sure, 
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

    // Connect to WebSocket updates endpoint for component updates
    this.connectToUpdatesEndpoint(componentName);

    this.isConnected.set(true);
    this.error.set(null);
    this.loadingStage.set('Secure Tunnel Established');
  }

  /**
   * Connect to the WebSocket updates endpoint for real-time component updates
   */
  private connectToUpdatesEndpoint(componentName: string): void {
    try {
      // Extract Q-SYS Core IP from the already-connected QRWC WebSocket URL
      let coreIp = '192.168.6.21'; // default fallback
      
      try {
        const qrwc = (this.qsysService as any).qrwc;
        if (qrwc && qrwc.webSocketManager) {
          const ws = qrwc.webSocketManager.socket;
          if (ws && ws.url) {
            const match = ws.url.match(/wss?:\/\/([^/:]+)/);
            if (match && match[1]) {
              coreIp = match[1];
            }
          }
        }
      } catch (e) {
        console.warn('Could not extract Core IP from QRWC, using default');
      }
      
      const corePort = 9091;
      const updateUrl = `ws://${coreIp}:${corePort}/ws/updates`;
      
      console.log(`Connecting to component updates WebSocket: ${updateUrl}`);
      
      const updateWs = new WebSocket(updateUrl);
      
      updateWs.onopen = () => {
        console.log('✓ Connected to /ws/updates endpoint for real-time component updates');
      };
      
      updateWs.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          if (message.type === 'componentUpdate') {
            console.log('Received component update via WebSocket:', message.componentName);
            this.componentUpdate.set(message);
          }
        } catch (err) {
          console.error('Error parsing update message:', err);
        }
      };
      
      updateWs.onerror = (error) => {
        console.error('WebSocket error on /ws/updates:', error);
      };
      
      updateWs.onclose = () => {
        console.log('Disconnected from /ws/updates endpoint');
        // Reconnect after 5 seconds
        setTimeout(() => this.connectToUpdatesEndpoint(componentName), 5000);
      };
    } catch (err) {
      console.error('Failed to connect to updates WebSocket:', err);
    }
  }

  /**
   * Handles incoming data from the secure tunnel
   */
  private handleTunnelData(data: string): void {
    if (!data) return;

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

        // Check if it's a component update message
        if (message.type === 'componentUpdate') {
          console.log('Received component update via secure tunnel:', message.componentName);
          this.componentUpdate.set(message);
        } else {
          // Otherwise process as discovery data
          this.processDiscoveryJson(data);
        }
      } catch (e) {
        // If parsing fails, try processing as discovery data
        this.processDiscoveryJson(data);
      }
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

  // Legacy stubs
  connectUpdates(): void {
    try {
      // Extract Q-SYS Core IP from the already-connected QRWC WebSocket URL
      // The QSysService has a connected QRWC instance we can inspect
      let coreIp = '192.168.6.21'; // default fallback
      
      try {
        const qrwc = (this.qsysService as any).qrwc;
        if (qrwc && qrwc.webSocketManager) {
          // Get the URL from the WebSocket manager
          const ws = qrwc.webSocketManager.socket;
          if (ws && ws.url) {
            // Extract IP from URL like "wss://192.168.104.220/qrc"
            const match = ws.url.match(/wss?:\/\/([^/:]+)/);
            if (match && match[1]) {
              coreIp = match[1];
            }
          }
        }
      } catch (e) {
        console.warn('Could not extract Core IP from QRWC, using default');
      }
      
      const corePort = 9091;
      const updateUrl = `ws://${coreIp}:${corePort}/ws/updates`;
      
      console.log(`Connecting to component updates WebSocket: ${updateUrl}`);
      
      const updateWs = new WebSocket(updateUrl);
      
      updateWs.onopen = () => {
        console.log('Connected to /ws/updates WebSocket endpoint on Q-SYS Core');
      };
      
      updateWs.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          if (message.type === 'componentUpdate') {
            console.log('Received component update:', message.componentName);
            this.componentUpdate.set(message);
          } else if (message.type === 'connected') {
            console.log('Updates endpoint ready');
          }
        } catch (err) {
          console.error('Error parsing update message:', err);
        }
      };
      
      updateWs.onerror = (error) => {
        console.error('WebSocket error on /ws/updates:', error);
      };
      
      updateWs.onclose = () => {
        console.log('Disconnected from /ws/updates endpoint');
        // Reconnect after 5 seconds
        setTimeout(() => this.connectUpdates(), 5000);
      };
    } catch (err) {
      console.error('Failed to connect to updates WebSocket:', err);
    }
  }
  disconnect(): void { this.isConnected.set(false); }
  reconnect(): void { this.connect(); }
  getDiscoveryData(): DiscoveryData | null { return this.discoveryData(); }
}
