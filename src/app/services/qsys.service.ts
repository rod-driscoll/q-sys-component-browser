import { Injectable, signal } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { QrwcConnectionOptions } from '../models/qsys-control.model';
import { Qrwc } from '@q-sys/qrwc';
import { environment } from '../../environments/environment';

export interface ComponentWithControls {
  name: string;
  type: string;
  controlCount: number;
}

@Injectable({
  providedIn: 'root',
})
export class QSysService {
  private qrwc: any = null;
  private currentComponentListener: any = null;
  private currentComponent: any = null;

  // Component cache and observable
  private componentsCache: ComponentWithControls[] | null = null;
  private componentsLoaded$ = new BehaviorSubject<ComponentWithControls[]>([]);

  // Script-only components cache (from Lua WebSocket discovery)
  private scriptOnlyComponentsCache: any[] | null = null;

  // Keepalive timer to prevent connection timeout
  private keepaliveTimer: any = null;

  // Reconnection state
  private reconnectTimer: any = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private isReconnecting = false;

  // Disconnection tracking for smart cache management
  private lastDisconnectionTime: number | null = null;
  private disconnectionDurationThreshold = 60000; // 60 seconds in ms

  // Connection state
  public isConnected = signal(false);
  private connectionStatus$ = new BehaviorSubject<boolean>(false);
  private controlUpdates$ = new Subject<{
    component: string;
    control: string;
    value: any;
    position?: number;
    string?: string;
    Bool?: boolean;
  }>();

  // Store connection options
  private options: QrwcConnectionOptions | null = null;

  // Track whether poll interceptor has been set up
  private pollInterceptorSetup = false;

  // Reconnection counter - increments on each successful reconnection
  // Components can watch this to re-register with new ChangeGroup
  public reconnectionCount = signal(0);

  // Track the current ChangeGroup ID to detect when it changes
  private currentChangeGroupId: string | null = null;

  // Callback to notify when ChangeGroup changes (for component re-registration)
  private changeGroupChangedCallback: (() => Promise<void>) | null = null;

  constructor() { }

  /**
   * Register a callback to be invoked when ChangeGroup ID changes
   * Used by QrwcAdapterService to re-register components
   */
  onChangeGroupChanged(callback: () => Promise<void>): void {
    this.changeGroupChangedCallback = callback;
  }

  /**
   * Connect to Q-SYS Core using QRWC library
   * @param optionsOrIp - Connection options object or IP address string
   */
  async connect(optionsOrIp: QrwcConnectionOptions | string): Promise<void> {
    // Parse connection options
    if (typeof optionsOrIp === 'string') {
      this.options = {
        coreIp: optionsOrIp,
        secure: true,
        pollInterval: 350,
      };
    } else {
      this.options = optionsOrIp;
    }

    const protocol = this.options.secure ? 'wss' : 'ws';
    //const url = `${protocol}://${this.options.coreIp}/qrc-public-api/v0`;
    const url = `${protocol}://${this.options.coreIp}/qrc`;

    try {
      console.log('Connecting to Q-SYS Core via QRWC...');

      // Create WebSocket
      const socket = new WebSocket(url);

      // Add close handler to update connection status
      socket.onclose = () => {
        console.log('QRWC WebSocket closed');
        this.isConnected.set(false);
        this.connectionStatus$.next(false);
      };

      // Wait for WebSocket to open
      await new Promise<void>((resolve, reject) => {
        socket.onopen = () => resolve();
        socket.onerror = (error) => {
          console.error('QRWC WebSocket error:', error);
          this.isConnected.set(false);
          this.connectionStatus$.next(false);
          reject(error);
        };
      });

      // Create QRWC instance using factory method
      // Pass a custom logger to capture errors without polling spam
      // Use componentFilter to prevent loading ANY components initially (avoids timeout errors)
      this.qrwc = await Qrwc.createQrwc({
        socket,
        pollingInterval: this.options.pollInterval || 350,
        componentFilter: () => false, // Don't load any components during initialization
        logger: {
          debug: () => { }, // Suppress debug messages (polling spam)
          info: () => { },  // Suppress info messages
          warn: (message: string) => console.warn('QRWC Warning:', message),
          error: (error: Error) => console.error('QRWC Error:', error.message, error),
        },
      });

      // CRITICAL: Stop QRWC's internal ChangeGroup polling immediately
      // QRWC starts polling automatically during createQrwc(), but we need to control
      // polling ourselves to avoid ChangeGroup ID conflicts after reconnection
      const changeGroup = (this.qrwc as any).changeGroup;
      const newChangeGroupId = (changeGroup as any)?.id;

      console.log('Checking for QRWC automatic polling...', {
        hasChangeGroup: !!changeGroup,
        hasIntervalRef: !!(changeGroup as any)?.intervalRef,
        newChangeGroupId: newChangeGroupId,
        previousChangeGroupId: this.currentChangeGroupId
      });

      if ((changeGroup as any).intervalRef) {
        console.log('Stopping QRWC automatic polling to prevent ChangeGroup conflicts');
        clearInterval((changeGroup as any).intervalRef);
        (changeGroup as any).intervalRef = null;
      } else {
        console.log('No QRWC automatic polling found (intervalRef not set yet)');
      }

      // Listen for QRWC error events
      this.qrwc.on('error', (error: Error) => {
        console.error('QRWC Error Event:', error.message);
        // Check if this is a control loading error
        if (error.message?.includes('Failed to fetch controls')) {
          console.warn('Component control loading failed - will fallback to HTTP API');
        }
      });

      // Listen for disconnection events
      this.qrwc.on('disconnected', (reason: string) => {
        console.warn('QRWC Disconnected:', reason);
        // Record disconnection time for smart cache management
        this.lastDisconnectionTime = Date.now();
        console.log('[RECONNECT] Disconnection recorded at', new Date(this.lastDisconnectionTime).toISOString());
        this.isConnected.set(false);
        this.connectionStatus$.next(false);

        // Attempt to reconnect automatically
        this.attemptReconnect();
      });

      console.log('Connected to Q-SYS Core');

      // QRWC is now ready - no components were loaded during initialization (componentFilter returned false for all)
      // Components will be fetched via direct RPC call when needed
      this.isConnected.set(true);
      this.connectionStatus$.next(true);

      // Reset reconnection state on successful connection
      this.reconnectAttempts = 0;
      this.isReconnecting = false;
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }

      // Reset poll interceptor flag so it gets set up fresh when components register
      this.pollInterceptorSetup = false;

      // Check if ChangeGroup ID has changed (indicates reconnection or new QRWC instance)
      // IMPORTANT: This must happen AFTER isConnected.set(true) so that effects watching
      // both isConnected and reconnectionCount will trigger properly
      if (this.currentChangeGroupId && newChangeGroupId && this.currentChangeGroupId !== newChangeGroupId) {
        console.log(`ChangeGroup ID changed from ${this.currentChangeGroupId} to ${newChangeGroupId} - triggering re-registration`);

        // CRITICAL: Stop ChangeGroup polling immediately after reconnection
        // The new ChangeGroup ID exists on the client but doesn't exist on Q-SYS Core yet
        // (no controls have been added to it). Polling with this ID will fail with
        // "Change group does not exist" until components re-register and add controls.
        // We must stop polling now and let component re-registration restart it.
        if ((changeGroup as any).intervalRef) {
          console.log('⚠ Stopping ChangeGroup polling (new ChangeGroup not yet created on Q-SYS Core)');
          clearInterval((changeGroup as any).intervalRef);
          (changeGroup as any).intervalRef = null;
        }

        this.currentChangeGroupId = newChangeGroupId;
        this.reconnectionCount.update(count => count + 1);
        console.log(`ChangeGroup changed - reconnection #${this.reconnectionCount()}`);

        // Reset poll interceptor flag so it gets set up again on the new ChangeGroup
        this.pollInterceptorSetup = false;

        // Invoke callback to re-register components with new ChangeGroup
        // This will add controls to the new ChangeGroup and restart polling
        if (this.changeGroupChangedCallback) {
          this.changeGroupChangedCallback().catch(error => {
            console.error('Error in ChangeGroup changed callback:', error);
          });
        }
      } else if (newChangeGroupId) {
        this.currentChangeGroupId = newChangeGroupId;
      }

      console.log('QRWC initialization complete - ready to fetch components on-demand');

      // Don't re-apply poll interceptor here after reconnection!
      // The ChangeGroup object exists in QRWC but hasn't been created on Q-SYS Core yet.
      // It will be properly initialized when components register controls via
      // ensureChangeGroupPollingAndInterception(), which sets up both the interceptor
      // AND ensures the ChangeGroup is created on Q-SYS by adding controls to it first.

      // Start keepalive timer to prevent connection timeout
      const webSocketManager = (this.qrwc as any).webSocketManager;
      this.startKeepalive(webSocketManager);

    } catch (error) {
      console.error('Failed to connect:', error);
      this.isConnected.set(false);
      this.connectionStatus$.next(false);
      throw error;
    }
  }

  /**
   * Disconnect from Q-SYS Core
   */
  disconnect(): void {
    if (this.currentComponentListener) {
      this.unsubscribeFromComponent();
    }

    // Stop keepalive timer
    this.stopKeepalive();

    if (this.qrwc) {
      // CRITICAL: Stop ChangeGroup polling BEFORE disconnecting
      // This prevents the old polling interval from continuing to run after disconnect/reconnect
      try {
        const changeGroup = (this.qrwc as any).changeGroup;
        if (changeGroup && (changeGroup as any).intervalRef) {
          console.log('Stopping ChangeGroup polling before disconnect');
          clearInterval((changeGroup as any).intervalRef);
          (changeGroup as any).intervalRef = null;
        }
      } catch (error) {
        console.warn('Error stopping ChangeGroup polling:', error);
      }

      // Try to disconnect the QRWC instance
      // The QRWC library may not have a disconnect method, so we access the WebSocket directly
      try {
        if (typeof this.qrwc.disconnect === 'function') {
          this.qrwc.disconnect();
        } else {
          // Access the underlying WebSocket and close it
          const webSocketManager = (this.qrwc as any).webSocketManager;
          if (webSocketManager && webSocketManager.socket) {
            webSocketManager.socket.close();
          }
        }
      } catch (error) {
        console.warn('Error during disconnect:', error);
      }
      this.qrwc = null;
    }

    // Component cache removed - using RPC instead of QRWC Components

    this.isConnected.set(false);
    this.connectionStatus$.next(false);
    
    // Clear disconnection tracking on manual disconnect
    this.lastDisconnectionTime = null;
    this.clearScriptOnlyComponentsCache();

    // Stop any reconnection attempts when manually disconnecting
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.reconnectAttempts = 0;
    this.isReconnecting = false;
  }

  /**
   * Attempt to reconnect to Q-SYS Core with exponential backoff
   */
  private attemptReconnect(): void {
    // Don't start multiple reconnection attempts
    if (this.isReconnecting) {
      return;
    }

    // Check if we've exceeded max attempts
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error(`Max reconnection attempts (${this.maxReconnectAttempts}) reached. Please refresh the page to reconnect.`);
      return;
    }

    this.isReconnecting = true;
    this.reconnectAttempts++;

    // Calculate delay with exponential backoff: 2s, 4s, 8s, 16s, 32s
    const delayMs = Math.pow(2, this.reconnectAttempts) * 1000;

    console.log(`Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delayMs / 1000}s...`);

    this.reconnectTimer = setTimeout(async () => {
      if (!this.options) {
        console.error('Cannot reconnect: No connection options stored');
        this.isReconnecting = false;
        return;
      }

      try {
        console.log(`Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}...`);
        await this.connect(this.options);
        console.log('✓ Reconnection successful');
      } catch (error) {
        console.error(`Reconnection attempt ${this.reconnectAttempts} failed:`, error);
        this.isReconnecting = false;
        // Try again if we haven't reached max attempts
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.attemptReconnect();
        }
      }
    }, delayMs);
  }

  /**
   * Get observable for connection status
   */
  getConnectionStatus(): Observable<boolean> {
    return this.connectionStatus$.asObservable();
  }

  /**
   * Get the core IP address from connection options
   */
  getCoreIp(): string | null {
    return this.options?.coreIp || null;
  }

  /**
   * Get observable for control updates
   */
  getControlUpdates(): Observable<{ component: string; control: string; value: any; position?: number; string?: string; Bool?: boolean }> {
    return this.controlUpdates$.asObservable();
  }

  /**
   * Get observable for components loaded event
   * Emits when components are fetched from Q-SYS Core
   */
  getComponentsLoaded(): Observable<ComponentWithControls[]> {
    return this.componentsLoaded$.asObservable();
  }

  /**
   * Get cached components if available, otherwise returns empty array
   */
  getCachedComponents(): ComponentWithControls[] {
    return this.componentsCache || [];
  }

  /**
   * Cache script-only components discovered via Lua WebSocket
   * These are cached separately so they persist across QRWC reconnections
   */
  cacheScriptOnlyComponents(components: any[]): void {
    if (components && components.length > 0) {
      this.scriptOnlyComponentsCache = components;
      console.log(`[CACHE] Cached ${components.length} script-only components for fast reconnection`);
    }
  }

  /**
   * Get cached script-only components if fast reconnection (< 60s)
   */
  getCachedScriptOnlyComponents(): any[] | null {
    if (!this.lastDisconnectionTime || !this.scriptOnlyComponentsCache) {
      return null;
    }

    const timeSinceDisconnect = Date.now() - this.lastDisconnectionTime;
    if (timeSinceDisconnect < this.disconnectionDurationThreshold) {
      console.log(`[CACHE] Returning ${this.scriptOnlyComponentsCache.length} cached script-only components (fast reconnection)`);
      return this.scriptOnlyComponentsCache;
    }

    // Slow reconnection - clear script cache
    console.log(`[CACHE] Clearing script-only component cache (slow reconnection: ${timeSinceDisconnect}ms >= 60s)`);
    this.scriptOnlyComponentsCache = null;
    return null;
  }

  /**
   * Clear script-only components cache on manual disconnect
   */
  clearScriptOnlyComponentsCache(): void {
    this.scriptOnlyComponentsCache = null;
  }

  /**
   * Refresh component control counts after QRWC has had more time to load
   * Note: With the new on-demand loading approach, this just re-fetches the component list
   */
  async refreshComponentCounts(): Promise<ComponentWithControls[]> {
    if (!this.qrwc) {
      throw new Error('Not connected to Q-SYS Core');
    }

    console.log('Refreshing component list...');
    // Force refresh by clearing cache
    this.componentsCache = null;
    return this.getComponents();
  }

  /**
   * Get all components from Q-SYS Core via direct RPC call
   * This avoids the timeout issues from QRWC's automatic control loading
   * Returns a promise that resolves with the component list with control counts
   * Uses cache if available to avoid redundant fetches
   * 
   * Smart caching: If reconnection occurs within 60 seconds, reuses cached components
   * since the Q-SYS design hasn't changed. For reconnections > 60 seconds, reloads all data.
   */
  async getComponents(forceRefresh: boolean = false): Promise<ComponentWithControls[]> {
    if (!this.qrwc) {
      throw new Error('Not connected to Q-SYS Core');
    }

    // Check if we should use cached components (fast reconnection)
    if (!forceRefresh && this.componentsCache && this.lastDisconnectionTime) {
      const timeSinceDisconnect = Date.now() - this.lastDisconnectionTime;
      const reconnected = this.isConnected();
      
      if (reconnected && timeSinceDisconnect < this.disconnectionDurationThreshold) {
        // Fast reconnection (< 60 seconds) - design hasn't changed
        console.log(`[RECONNECT] Fast reconnection detected (${timeSinceDisconnect}ms < 60s) - reusing cached components`);
        console.log(`Returning ${this.componentsCache.length} cached components (no design changes expected)`);
        // Notify subscribers that components are loaded (for UI re-initialization)
        this.componentsLoaded$.next(this.componentsCache);
        return this.componentsCache;
      } else if (reconnected && timeSinceDisconnect >= this.disconnectionDurationThreshold) {
        // Slow reconnection (>= 60 seconds) - design might have changed
        console.log(`[RECONNECT] Slow reconnection detected (${timeSinceDisconnect}ms >= 60s) - clearing cache and reloading`);
        this.componentsCache = null;
        this.lastDisconnectionTime = null;
      }
    } else if (!forceRefresh && this.componentsCache) {
      console.log(`Returning ${this.componentsCache.length} cached components`);
      return this.componentsCache;
    }

    try {
      console.log('Fetching components via Component.GetComponents RPC...');

      // Access the internal WebSocketManager to call Component.GetComponents directly
      // This is safe because QRWC exposes it as a public property (just not in TypeScript types)
      const webSocketManager = (this.qrwc as any).webSocketManager;
      if (!webSocketManager) {
        throw new Error('WebSocketManager not available');
      }

      // Call Component.GetComponents RPC directly
      const components = await webSocketManager.sendRpc('Component.GetComponents', 'test');
      console.log(`Found ${components.length} components via RPC`);

      // Fetch control counts with limited concurrency to avoid overloading the Core
      console.log('Fetching control counts for all components (limited concurrency)...');

      const concurrencyLimit = 2; // further limit parallel RPCs to reduce Core load
      const componentsWithCounts: ComponentWithControls[] = [];

      let currentIndex = 0;
      const workers = Array.from({ length: concurrencyLimit }, async () => {
        while (true) {
          const idx = currentIndex++;
          if (idx >= components.length) break;
          const component: any = components[idx];

          // Skip script components when counting controls to avoid overload
          if (component.Type === 'device_controller_script') {
            console.log(`  ↩ ${component.Name}: skipping control count (script component)`);
            componentsWithCounts[idx] = {
              name: component.Name,
              type: component.Type || 'Unknown',
              controlCount: 0
            };
            // Small delay to avoid hammering RPC endpoint even on skip
            await new Promise(r => setTimeout(r, 25));
            continue;
          }

          // Standard components: use retry logic (max 3 attempts)
          const maxAttempts = 3;

          try {
            const controlCount = await this.fetchControlCountWithRetry(
              webSocketManager,
              component.Name,
              maxAttempts
            );

            componentsWithCounts[idx] = {
              name: component.Name,
              type: component.Type || 'Unknown',
              controlCount: controlCount
            };
          } catch (err) {
            console.warn(`  ✗ ${component.Name}: failed to fetch controls - ${String(err)}`);
            componentsWithCounts[idx] = {
              name: component.Name,
              type: component.Type || 'Unknown',
              controlCount: 0
            };
          }

          // Small delay to avoid hammering RPC endpoint
          await new Promise(r => setTimeout(r, 25));
        }
      });

      await Promise.all(workers);

      console.log(`Loaded ${componentsWithCounts.length} components with control counts`);

      // Log summary of successes vs failures
      const successCount = componentsWithCounts.filter(c => c.controlCount > 0).length;
      const failedCount = componentsWithCounts.filter(c => c.controlCount === 0).length;
      console.log(`  ✓ ${successCount} components loaded successfully`);
      if (failedCount > 0) {
        console.log(`  ⚠ ${failedCount} components failed to load controls`);
      }

      // Cache the components and notify subscribers
      this.componentsCache = componentsWithCounts;
      this.componentsLoaded$.next(componentsWithCounts);
      
      // Clear disconnection tracking after successful reload
      this.lastDisconnectionTime = null;
      console.log('[RECONNECT] Component reload complete - disconnection tracking cleared');

      // Keepalive is already started in connect() method

      return componentsWithCounts;
    } catch (error) {
      console.error('Failed to get components:', error);
      throw error;
    }
  }

  /**
   * Start keepalive timer to prevent WebSocket connection timeout
   * Sends StatusGet RPC every 15 seconds to keep connection alive
   */
  private startKeepalive(webSocketManager: any): void {
    // Clear any existing timer
    if (this.keepaliveTimer) {
      clearInterval(this.keepaliveTimer);
      console.log('Cleared previous keepalive timer');
    }

    console.log('Starting keepalive timer (StatusGet every 15s)...');

    let keepaliveCount = 0;
    // Send StatusGet RPC every 15 seconds to keep connection alive
    this.keepaliveTimer = setInterval(async () => {
      keepaliveCount++;
      try {
        console.log(`[KEEPALIVE] Sending StatusGet (attempt ${keepaliveCount})...`);
        const result = await Promise.race([
          webSocketManager.sendRpc('StatusGet', undefined),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Keepalive timeout after 5s')), 5000)
          )
        ]);
        console.log(`[KEEPALIVE] StatusGet succeeded (attempt ${keepaliveCount}):`, result);
      } catch (error) {
        console.warn(`[KEEPALIVE] StatusGet failed (attempt ${keepaliveCount}):`, error);
      }
    }, 15000); // 15 seconds

    console.log('Keepalive timer started (15s interval)');
  }

  /**
   * Stop keepalive timer
   */
  private stopKeepalive(): void {
    if (this.keepaliveTimer) {
      console.log('[KEEPALIVE] Stopping keepalive timer');
      clearInterval(this.keepaliveTimer);
      this.keepaliveTimer = null;
    }
  }

  /**
   * Fetch control count with retry logic for components that timeout
   * Uses exponential backoff: 1s, 2s, 4s delays between retries
   */
  private async fetchControlCountWithRetry(
    webSocketManager: any,
    componentName: string,
    maxAttempts: number = 3
  ): Promise<number> {
    let lastError: any;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        // Call Component.GetControls RPC to get control count
        const controlsResult = await Promise.race([
          webSocketManager.sendRpc('Component.GetControls', {
            Name: componentName
          }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('RPC timeout after 3000ms')), 3000)
          )
        ]);

        // Success - return count
        if (attempt > 1) {
          console.log(`  ✓ ${componentName}: succeeded on attempt ${attempt}`);
        }
        return controlsResult.Controls?.length || 0;

      } catch (error) {
        lastError = error;
        const errorMessage = error instanceof Error ? error.message : String(error);

        // Check if it's a timeout error
        const isTimeout = errorMessage.includes('timeout') || errorMessage.includes('timed out') || errorMessage.includes('RPC timeout');

        if (isTimeout && attempt < maxAttempts) {
          // Calculate delay with exponential backoff: 1s, 2s, 4s
          const delayMs = Math.pow(2, attempt - 1) * 1000;
          console.log(`  ⏱ ${componentName}: timeout on attempt ${attempt}, retrying in ${delayMs}ms...`);

          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, delayMs));
        } else if (attempt === maxAttempts) {
          // Final attempt failed
          console.warn(`  ✗ ${componentName}: failed after ${maxAttempts} attempts - ${errorMessage}`);
        }
      }
    }

    // All attempts failed - return 0
    return 0;
  }

  /**
   * Set control value via RPC
   * Uses Component.Set RPC directly
   */
  async setControlViaRpc(componentName: string, controlName: string, value: any): Promise<void> {
    if (!this.qrwc) {
      throw new Error('Not connected to Q-SYS Core');
    }

    try {
      const webSocketManager = (this.qrwc as any).webSocketManager;

      // Use Component.Set RPC to set control value
      await webSocketManager.sendRpc('Component.Set', {
        Name: componentName,
        Controls: [
          {
            Name: controlName,
            Value: value
          }
        ]
      });

      console.log(`Set ${componentName}:${controlName} = ${value} via RPC`);
    } catch (error) {
      console.error(`Failed to set control via RPC:`, error);
      throw error;
    }
  }

  /**
   * Set control position via RPC
   * Uses Component.Set RPC with Position parameter
   */
  private async setControlPositionViaRpc(componentName: string, controlName: string, position: number): Promise<void> {
    if (!this.qrwc) {
      throw new Error('Not connected to Q-SYS Core');
    }

    try {
      const webSocketManager = (this.qrwc as any).webSocketManager;

      // Use Component.Set RPC to set control position
      await webSocketManager.sendRpc('Component.Set', {
        Name: componentName,
        Controls: [
          {
            Name: controlName,
            Position: position
          }
        ]
      });

      console.log(`Set ${componentName}:${controlName} position = ${position} via RPC`);
    } catch (error) {
      console.error(`Failed to set control position via RPC:`, error);
      throw error;
    }
  }

  /**
   * Get component controls via RPC call
   * Uses Component.GetControls to get control definitions
   */
  private async getComponentControlsViaRpc(componentName: string): Promise<any[]> {
    if (!this.qrwc) {
      throw new Error('Not connected to Q-SYS Core');
    }

    try {
      console.log(`Fetching controls for component: ${componentName}`);

      const webSocketManager = (this.qrwc as any).webSocketManager;
      // Use Component.GetControls to get control names for ChangeGroup registration
      const result = await webSocketManager.sendRpc('Component.GetControls', { Name: componentName });

      console.log(`Fetched ${result.Controls.length} controls for ${componentName}`);
      return result.Controls;
    } catch (error) {
      console.error(`Failed to fetch controls for ${componentName}:`, error);
      throw error;
    }
  }

  /**
   * Infer additional Q-SYS control properties that are not reported by the API
   * Based on Q-SYS documentation: Controls Properties
   */
  private inferControlProperties(state: any, controlName: string): { units?: string; pushAction?: string; indicatorType?: string } {
    const result: { units?: string; pushAction?: string; indicatorType?: string } = {};

    // Infer Units for Knob controls
    if (state.Position !== undefined) {
      const stringValue = state.String || '';
      const type = state.Type;

      if (type === 'Float') {
        if (stringValue.endsWith('Hz')) {
          result.units = 'Hz';
        } else if (stringValue.endsWith('dB')) {
          result.units = 'Meter';
        } else if (stringValue.endsWith('%')) {
          result.units = 'Percent';
        } else if (stringValue.startsWith('L') || stringValue.startsWith('R') || stringValue === 'C') {
          result.units = 'Pan';
        } else if (stringValue.includes('.') && !/[a-zA-Z]/.test(stringValue)) {
          result.units = 'Float';
        }
      } else if (type === 'Integer' || (type === 'Array' && state.ValueMin !== undefined && state.ValueMax !== undefined)) {
        result.units = 'Integer';
      } else if (type === 'Time') {
        result.units = 'Seconds';
      }
    }

    // Infer Push Action for Button controls
    const type = state.Type;
    if (type === 'Trigger') {
      result.pushAction = 'Trigger';
    } else if (type === '' || type === 'State Trigger') {
      result.pushAction = 'State Trigger';
    }

    // Infer Type for Text controls that are actually Combo Boxes
    if (type === 'Text' && state.Position !== undefined) {
      result.indicatorType = 'Combo Box';
    }

    return result;
  }

  /**
   * Fetch Choices for Text controls using Component.Get RPC
   *
   * IMPORTANT - Q-SYS COMBO BOX PATTERN:
   * ======================================
   * Q-SYS combo boxes have these characteristics:
   * - Type: "Text"
   * - Choices: array of strings (the dropdown options)
   * - Position: current selected index (optional)
   * - String: current selected value
   *
   * Q-SYS RPC API BEHAVIOR:
   * -----------------------
   * Component.GetControls - Returns control METADATA but NO Choices array
   * Component.Get         - Returns control CURRENT VALUES including Choices array ✓
   *
   * SOLUTION PATTERN:
   * -----------------
   * 1. Use Component.GetControls to get all control metadata (fast)
   * 2. Filter for Text controls (potential combo boxes)
   * 3. Use Component.Get to fetch current values for Text controls (includes Choices)
   * 4. Merge Choices from Component.Get into the control metadata
   * 5. Detect combo boxes: Type === "Text" AND Choices.length > 0
   *
   * This pattern must be used whenever loading controls to ensure combo boxes
   * have their Choices array populated and can display dropdown options in the UI.
   */
  private async fetchChoicesViaComponentGet(componentName: string, textControlNames: string[]): Promise<Map<string, string[]>> {
    const webSocketManager = (this.qrwc as any).webSocketManager;
    const choicesMap = new Map<string, string[]>();

    try {
      console.log(`Fetching current values for ${textControlNames.length} Text controls via Component.Get...`);

      // Call Component.Get to get current state including Choices
      const result = await webSocketManager.sendRpc('Component.Get', {
        Name: componentName,
        Controls: textControlNames.map(name => ({ Name: name }))
      });

      // Extract Choices from result
      if (result.Controls && Array.isArray(result.Controls)) {
        for (const control of result.Controls) {
          if (control.Choices && Array.isArray(control.Choices) && control.Choices.length > 0) {
            choicesMap.set(control.Name, control.Choices);
          }
        }
      }

      console.log(`✓ Found Choices for ${choicesMap.size} controls via Component.Get`);
    } catch (error) {
      console.warn(`Failed to fetch Choices via Component.Get for ${componentName}:`, error);
    }

    return choicesMap;
  }

  /**
   * Merge Choices into RPC control states
   */
  private mergeChoicesIntoStates(rpcStates: any[], choicesMap: Map<string, string[]>): any[] {
    return rpcStates.map(state => {
      const choices = choicesMap.get(state.Name);
      if (choices) {
        return { ...state, Choices: choices };
      }
      return state;
    });
  }

  /**
   * Get all controls for a specific component
   * Returns a promise that resolves with the control list
   * Uses direct RPC call to avoid QRWC's ChangeGroup registration
   */
  async getComponentControls(componentName: string): Promise<any[]> {
    if (!this.qrwc) {
      throw new Error('Not connected to Q-SYS Core');
    }

    try {
      // Get controls via RPC call (fast, no ChangeGroup registration)
      let controlStates = await this.getComponentControlsViaRpc(componentName);

      if (controlStates.length === 0) {
        console.warn(`Component "${componentName}" has no controls`);
        return [];
      }

      // Check if any Text controls exist (potential combo boxes)
      const textControlNames = controlStates
        .filter(state => state.Type === 'Text')
        .map(state => state.Name);

      if (textControlNames.length > 0) {
        // Fetch Choices for Text controls using Component.Get RPC
        const choicesMap = await this.fetchChoicesViaComponentGet(componentName, textControlNames);

        // Merge Choices into control states
        controlStates = this.mergeChoicesIntoStates(controlStates, choicesMap);
      }

      const controls: any[] = [];

      for (const state of controlStates) {
        const controlName = state.Name;

        // Infer/correct control type
        let controlType = state.Type;

        // Override type based on control properties (Q-SYS often reports incorrect types)

        // Priority 1: If it has Choices AND Type is "Text", it's a Combo box
        // IMPORTANT: This is the COMBO BOX DETECTION pattern (see fetchChoicesViaComponentGet for details)
        // Q-SYS combo boxes have Type: "Text" with a Choices array
        // Choices must be fetched via Component.Get RPC (not included in Component.GetControls)
        // They may also have Position (index into Choices), ValueMin, and ValueMax
        // The key identifier is: Type="Text" + Choices.length > 0
        if (state.Choices && Array.isArray(state.Choices) && state.Choices.length > 0 &&
          controlType === 'Text') {
          controlType = 'Combo box';
          // Debug logging
          if (controlName.includes('Select')) {
            console.log(`✓ Detected Combo box: ${controlName} (${state.Choices.length} choices)`, {
              Type: state.Type,
              hasPosition: state.Position !== undefined,
              hasValueMin: state.ValueMin !== undefined,
              hasValueMax: state.ValueMax !== undefined
            });
          }
        } else if (controlName.includes('Select') && state.Choices) {
          // Debug: log when Select controls with Choices are NOT detected as combo box
          console.log(`✗ NOT Combo box: ${controlName}`, {
            hasChoices: !!state.Choices,
            isArray: Array.isArray(state.Choices),
            choicesLength: state.Choices?.length,
            originalType: state.Type,
            hasPosition: state.Position !== undefined,
            hasValueMin: state.ValueMin !== undefined,
            hasValueMax: state.ValueMax !== undefined
          });
        }
        // Priority 2: Check for Position - Array types with Position (but no choices) are Integer Knobs
        else if (state.Position !== undefined && (controlType === 'Float' || controlType === 'Array')) {
          // Float or Array with Position = Knob/Fader (use Position for control, not Value)
          controlType = 'Knob';
        }
        // Priority 3: Infer from name patterns if no type provided
        else if (!controlType || controlType === '') {
          if (/^(System|Power)(On|Off)$/i.test(controlName)) {
            controlType = 'State Trigger';
          } else if (controlName.endsWith('Trig') || controlName.toLowerCase().includes('trigger')) {
            controlType = 'Trigger';
          } else if (state.Position !== undefined) {
            controlType = 'Knob';
          } else {
            controlType = 'Text';
          }
        }

        // Infer additional properties
        const inferredProps = this.inferControlProperties(state, controlName);

        controls.push({
          name: controlName,
          type: controlType,
          direction: state.Direction || 'Read/Write',
          value: state.Value,
          valueMin: state.ValueMin,
          valueMax: state.ValueMax,
          position: state.Position,
          string: state.String,
          choices: state.Choices,
          stringMin: state.StringMin,
          stringMax: state.StringMax,
          // Add inferred properties
          units: inferredProps.units,
          pushAction: inferredProps.pushAction,
          indicatorType: inferredProps.indicatorType
        });
      }

      return controls;
    } catch (error) {
      console.error(`Failed to get controls for ${componentName}:`, error);
      // Fallback to HTTP API if RPC fails
      return this.getComponentControlsViaHTTP(componentName);
    }
  }

  /**
   * Subscribe to a component's control changes using QRWC's ChangeGroup
   * Uses QRWC's internal ChangeGroup to register controls for polling feedback
   */
  async subscribeToComponent(componentName: string): Promise<void> {
    if (!this.qrwc) {
      throw new Error('Not connected to Q-SYS Core');
    }

    try {
      console.log(`Subscribing to component: ${componentName} via ChangeGroup`);

      // Unsubscribe from current component if any
      if (this.currentComponentListener) {
        await this.unsubscribeFromComponent();
      }

      // Get controls for the component
      const controls = await this.getComponentControlsViaRpc(componentName);

      if (controls.length === 0) {
        console.warn(`Component ${componentName} has no controls to subscribe to`);
        return;
      }

      // Access QRWC's internal ChangeGroup
      const changeGroup = (this.qrwc as any).changeGroup;
      const webSocketManager = (this.qrwc as any).webSocketManager;

      // Register all controls with the ChangeGroup
      console.log(`Registering ${controls.length} controls with ChangeGroup for ${componentName}`);

      // Build the controls array for ChangeGroup.AddComponentControl
      // Exclude special tunnel controls to avoid feedback loops
      const controlsToRegister = controls
        .filter(control => {
          const n = (control.Name || '').toLowerCase();
          return n !== 'json_input' && n !== 'json_output' && n !== 'trigger_update';
        })
        .map(control => ({
          Name: control.Name
        }));

      if (controlsToRegister.length !== controls.length) {
        console.log(`Filtered out ${controls.length - controlsToRegister.length} special controls for ${componentName} (json_input/json_output/trigger_update)`);
      }

      // Register all controls at once
      await webSocketManager.sendRpc('ChangeGroup.AddComponentControl', {
        Id: (changeGroup as any).id,
        Component: {
          Name: componentName,
          Controls: controlsToRegister
        }
      });

      // Store the component name for unsubscribe
      this.currentComponentListener = componentName;

      console.log(`✓ Subscribed to ${componentName} with ${controls.length} controls via ChangeGroup`);

      // IMPORTANT: Set up poll interception BEFORE starting polling
      // This ensures the interval captures our intercepted poll method
      this.listenToChangeGroupUpdates(componentName);

      // Start ChangeGroup polling if not already started
      // Since we used componentFilter: () => false, QRWC didn't start polling automatically
      await this.ensureChangeGroupPollingStarted();

    } catch (error) {
      console.error(`Failed to subscribe to component ${componentName}:`, error);
      throw error;
    }
  }

  /**
   * Ensure ChangeGroup polling is started
   * QRWC only starts polling if components were loaded during init,
   * but we filtered them all out, so we need to start it manually
   */
  private async ensureChangeGroupPollingStarted(): Promise<void> {
    const changeGroup = (this.qrwc as any).changeGroup;

    // Check if polling is already started by checking for intervalRef
    if ((changeGroup as any).intervalRef) {
      console.log('ChangeGroup polling already started');
      return;
    }

    console.log('Starting ChangeGroup polling...');

    // Start polling - this calls the internal startPolling method
    await (changeGroup as any).startPolling();

    console.log('✓ ChangeGroup polling started');
  }

  /**
   * Public method to ensure ChangeGroup polling and interception are set up
   * Used by room controls adapter to ensure updates are received
   */
  async ensureChangeGroupPollingAndInterception(): Promise<void> {
    // IMPORTANT: Set up interception BEFORE starting polling
    // This ensures the interval uses our intercepted poll method
    this.listenToChangeGroupUpdates(null as any);
    await this.ensureChangeGroupPollingStarted();
  }

  /**
   * Listen to ChangeGroup poll results and emit control updates
   */
  private listenToChangeGroupUpdates(componentName: string): void {
    // Access QRWC's internal ChangeGroup
    const changeGroup = (this.qrwc as any).changeGroup;

    // Override the ChangeGroup's poll method to intercept results
    // Store original poll method
    // IMPORTANT: Check both _originalPoll AND pollInterceptorSetup flag
    // After reconnection, QRWC creates a new ChangeGroup instance without _originalPoll,
    // but our service-level flag might still be true from the old instance
    if (!(changeGroup as any)._originalPoll && !this.pollInterceptorSetup) {
      (changeGroup as any)._originalPoll = (changeGroup as any).poll.bind(changeGroup);

      // Mark that we've set up the interceptor (for reconnection handling)
      this.pollInterceptorSetup = true;

      console.log('✓ Poll interceptor set up for ChangeGroup:', (changeGroup as any).id);

      // Replace with our interceptor
      (changeGroup as any).poll = async () => {
        // Call original poll
        const webSocketManager = (this.qrwc as any).webSocketManager;
        try {
          // Get the current ChangeGroup ID dynamically (important for reconnections)
          const currentChangeGroup = (this.qrwc as any).changeGroup;
          const changeGroupId = (currentChangeGroup as any).id;

          console.log('[Poll Interceptor] Polling with ChangeGroup ID:', changeGroupId);

          const pollResult = await webSocketManager.sendRpc('ChangeGroup.Poll', {
            Id: changeGroupId
          });

          // Process changes for ALL components in ChangeGroup
          // Emit updates for any control changes, subscribers will filter for what they need
          if (pollResult.Changes) {
            pollResult.Changes.forEach((change: any) => {
              // Emit control update for all components (not just currentComponentListener)
              this.controlUpdates$.next({
                component: change.Component,
                control: change.Name,
                value: change.Value,
                position: change.Position,
                string: change.String,
                Bool: change.Bool
              });
            });
          }

          // Also call original register callbacks
          pollResult.Changes.forEach((change: any) => {
            const key = `${change.Component}:${change.Name}`;
            if ((changeGroup as any).register.has(key)) {
              const callback = (changeGroup as any).register.get(key);
              callback(change);
            }
          });
        } catch (error) {
          const message = 'QRWC: RPC Error: ChangeGroup.Poll failed to poll for changes.';
          
          // Check if this is a "Change group does not exist" error
          // This happens during reconnection when polling continues with old ChangeGroup ID
          // before re-registration completes
          if (error instanceof Error && error.message.includes("does not exist")) {
            // Silently stop polling - re-registration will restart it
            if ((changeGroup as any).intervalRef) {
              clearInterval((changeGroup as any).intervalRef);
              (changeGroup as any).intervalRef = null;
            }
            return;  // Don't log error for expected reconnection case
          }
          
          // For other errors, log normally
          if (error instanceof Error) {
            error.message = `${message}\n${error.message}`;
            (this.qrwc as any).logger.error(error);
          } else {
            const errorObj = new Error(`${message}\n${error}`);
            (this.qrwc as any).logger.error(errorObj);
          }
        }
      };
    }
  }

  /**
   * Unsubscribe from the current component
   * Removes controls from QRWC's ChangeGroup
   */
  async unsubscribeFromComponent(): Promise<void> {
    if (!this.currentComponentListener) {
      return;
    }

    try {
      console.log(`Unsubscribing from component: ${this.currentComponentListener}`);

      const webSocketManager = (this.qrwc as any).webSocketManager;
      const changeGroup = (this.qrwc as any).changeGroup;

      // Remove component from ChangeGroup
      await webSocketManager.sendRpc('ChangeGroup.Remove', {
        Id: (changeGroup as any).id,
        Component: this.currentComponentListener
      });

      this.currentComponentListener = null;

      console.log('✓ Unsubscribed from component');
    } catch (error) {
      console.error('Failed to unsubscribe from component:', error);
      // Don't throw - just log the error
    }
  }

  /**
   * Get component controls via HTTP API (for components not loaded by QRWC)
   * Some Script components are not populated by QRWC due to lazy loading, so we fetch via HTTP API
   */
  private async getComponentControlsViaHTTP(componentName: string): Promise<any[]> {
    const url = `${environment.QSYS_HTTP_API_URL}/components/${encodeURIComponent(componentName)}/controls`;

    console.log(`Fetching controls via HTTP API: ${url}`);

    try {
      const response = await fetch(url);

      if (!response.ok) {
        let errorDetails = `HTTP ${response.status}: ${response.statusText}`;

        // Special handling for 404 - webserver not loaded
        if (response.status === 404) {
          errorDetails = `HTTP API not available (404). Please load 'WebSocketComponentDiscovery.lua' onto a Script component's 'code' control in Q-SYS Designer first.`;
          console.error(errorDetails);
          console.error(`The HTTP API webserver must be running on the Q-SYS Core to access components with controls not loaded by QRWC.`);
          console.error(`Steps to fix:`);
          console.error(`  1. Open Q-SYS Designer and select a Script component`);
          console.error(`  2. Find the 'code' control in the component`);
          console.error(`  3. Load 'WebSocketComponentDiscovery.lua' into the code control`);
          console.error(`  4. Save and deploy the design`);
        } else {
          try {
            const errorData = await response.json();
            if (errorData.error) {
              errorDetails += ` - ${errorData.error}`;
            }
          } catch (e) {
            // Response wasn't JSON, use status text
          }
        }

        throw new Error(errorDetails);
      }

      const data = await response.json();

      if (!data.controls || !Array.isArray(data.controls)) {
        console.warn(`HTTP API response for "${componentName}" has no controls array`);
        return [];
      }

      console.log(`✓ Fetched ${data.controls.length} controls via HTTP API for ${componentName}`);

      // Transform HTTP API format to match QRWC format
      return data.controls.map((ctrl: any) => ({
        name: ctrl.name,
        type: ctrl.type,
        value: ctrl.value,
        position: ctrl.position,
        string: ctrl.string,
        choices: ctrl.choices,
        min: ctrl.min,
        max: ctrl.max,
        rampTime: ctrl.rampTime,
        // Include any other properties from HTTP API
        ...ctrl
      }));
    } catch (error) {
      console.error(`Failed to fetch controls via HTTP API for ${componentName}:`, error);
      throw error;
    }
  }

  /**
   * Set a control value via HTTP API (for WebSocket-discovered components)
   */
  async setControlViaHTTP(componentName: string, controlName: string, value: any): Promise<void> {
    const url = `${environment.QSYS_HTTP_API_URL}/components/${encodeURIComponent(componentName)}/controls/${encodeURIComponent(controlName)}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ value }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(`HTTP ${response.status}: ${errorData.error || response.statusText}`);
    }

    console.log(`Set ${componentName}:${controlName} to ${value} via HTTP`);
  }

  /**
   * Set a control value using RPC
   */
  async setControl(componentName: string, controlName: string, value: any, ramp?: number): Promise<void> {
    try {
      console.log(`Setting ${componentName}:${controlName} to ${value}${ramp ? ` with ramp ${ramp}s` : ''}`);

      // Check if this is a pulse trigger (based on control name pattern)
      const isStateTrigger = /^(System|Power)(On|Off)$/i.test(controlName);
      const isPulseTrigger = controlName.endsWith('Trig') && !isStateTrigger && value === 1;

      if (isPulseTrigger) {
        // For pulse triggers, pulse high then low
        console.log(`Triggering ${componentName}:${controlName} (pulse)`);
        await this.setControlViaRpc(componentName, controlName, 1);
        await this.setControlViaRpc(componentName, controlName, 0);
      } else {
        // For all other controls, just set the value
        await this.setControlViaRpc(componentName, controlName, value);
      }
    } catch (error) {
      console.error(`Failed to set control ${componentName}:${controlName}:`, error);
      // Fallback to HTTP API if RPC fails
      console.log('Falling back to HTTP API...');
      return this.setControlViaHTTP(componentName, controlName, value);
    }
  }

  /**
   * Set a control position (0-1)
   * Uses RPC with Position parameter
   */
  async setControlPosition(componentName: string, controlName: string, position: number): Promise<void> {
    try {
      console.log(`Setting ${componentName}:${controlName} position to ${position}`);
      await this.setControlPositionViaRpc(componentName, controlName, position);
    } catch (error) {
      console.error(`Failed to set control position ${componentName}:${controlName}:`, error);
      // Fallback to HTTP API if RPC fails
      console.log('Falling back to HTTP API...');
      return this.setControlViaHTTP(componentName, controlName, position);
    }
  }

  /**
   * Get Core engine status information
   * Returns information like Platform, State, DesignName, etc.
   * Note: Firmware version is not available through QRWC
   */
  getCoreStatus(): any {
    if (!this.qrwc) {
      throw new Error('Not connected to Q-SYS Core');
    }

    try {
      // Access engineStatus property
      const status = this.qrwc.engineStatus;

      return {
        designName: status?.DesignName || 'Unknown',
        platform: status?.Platform || 'Unknown',
        state: status?.State || 'Unknown',
        designCode: status?.DesignCode || 'Unknown',
        isRedundant: status?.IsRedundant || false,
        isEmulator: status?.IsEmulator || false,
        statusCode: status?.Status?.Code,
        statusString: status?.Status?.String
      };
    } catch (error) {
      console.error('Failed to get Core status:', error);
      throw error;
    }
  }
}
