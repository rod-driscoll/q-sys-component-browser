import { Injectable, inject, signal } from '@angular/core';
import { QSysService } from './qsys.service';
import { WebSocketDiscoveryService } from './websocket-discovery.service';
import { LuaScriptService } from './lua-script.service';

/**
 * App-level initialization service
 * Handles the complete initialization sequence BEFORE any pages load:
 * 1. Connect to Q-SYS Core (QRWC)
 * 2. Complete WebSocket discovery (establish secure tunnel)
 * 3. Load Lua scripts (enable file system, etc.)
 * 
 * This ensures all custom view pages can safely use control-based communication
 * and other features that depend on discovery completion.
 */
@Injectable({
  providedIn: 'root'
})
export class AppInitializationService {
  private qsysService = inject(QSysService);
  private wsDiscoveryService = inject(WebSocketDiscoveryService);
  private luaScriptService = inject(LuaScriptService);

  // Signals for app-level state
  public isInitializing = signal<boolean>(false);
  public initializationComplete = signal<boolean>(false);
  public loadingStage = signal<string>('');
  public error = signal<string | null>(null);

  constructor() { }

  /**
   * Initialize the entire app
   * Should be called from App.ngOnInit() BEFORE any routes load
   */
  async initializeApp(): Promise<void> {
    if (this.initializationComplete()) {
      console.log('[APP-INIT] Already initialized, skipping');
      return;
    }

    if (this.isInitializing()) {
      console.log('[APP-INIT] Already initializing, waiting...');
      // Wait for existing initialization to complete
      return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          if (this.initializationComplete()) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);
      });
    }

    this.isInitializing.set(true);
    this.error.set(null);

    try {
      // Step 1: Wait for QRWC connection
      console.log('[APP-INIT] Step 1: Ensuring Q-SYS Core connection...');
      this.loadingStage.set('Connecting to Q-SYS Core...');
      await this.waitForQRWCConnection();
      console.log('[APP-INIT] ✓ Q-SYS Core connected');

      // Step 2: Complete WebSocket discovery (establishes secure tunnel)
      console.log('[APP-INIT] Step 2: Initializing WebSocket discovery...');
      this.loadingStage.set('Discovering secure tunnel...');
      await this.initializeWebSocketDiscovery();
      console.log('[APP-INIT] ✓ WebSocket discovery complete');

      // Step 3: Load Lua scripts (enables file system, etc.)
      console.log('[APP-INIT] Step 3: Loading Lua scripts...');
      this.loadingStage.set('Loading Lua scripts...');
      await this.loadLuaScripts();
      console.log('[APP-INIT] ✓ Lua scripts loaded');

      // All done!
      this.loadingStage.set('Ready');
      this.initializationComplete.set(true);
      this.isInitializing.set(false);
      console.log('[APP-INIT] ✓ App initialization complete - all pages can now use secure communication');

    } catch (err: any) {
      console.error('[APP-INIT] Initialization failed:', err);
      this.error.set(err.message || 'Initialization failed');
      this.isInitializing.set(false);
      throw err;
    }
  }

  /**
   * Wait for QRWC connection to be established
   */
  private waitForQRWCConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Q-SYS Core connection timeout (20s)'));
      }, 20000);

      const checkConnection = setInterval(() => {
        if (this.qsysService.isConnected()) {
          clearInterval(checkConnection);
          clearTimeout(timeout);
          resolve();
        }
      }, 100);
    });
  }

  /**
   * Initialize WebSocket discovery service
   */
  private initializeWebSocketDiscovery(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('WebSocket discovery timeout (20s)'));
      }, 20000);

      try {
        // Watch for discovery completion
        const checkDiscovery = setInterval(() => {
          if (this.wsDiscoveryService.isConnected()) {
            clearInterval(checkDiscovery);
            clearTimeout(timeout);
            resolve();
          }

          // Check for connection failure
          if (this.wsDiscoveryService.connectionFailed()) {
            clearInterval(checkDiscovery);
            clearTimeout(timeout);
            const error = this.wsDiscoveryService.error() || 'Discovery failed';
            reject(new Error(error));
          }
        }, 100);

        // Initiate discovery
        this.wsDiscoveryService.connect().catch(err => {
          clearInterval(checkDiscovery);
          clearTimeout(timeout);
          reject(err);
        });
      } catch (err) {
        clearTimeout(timeout);
        reject(err);
      }
    });
  }

  /**
   * Load Lua scripts required for various features
   */
  private loadLuaScripts(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Lua script loading timeout (15s)'));
      }, 15000);

      try {
        this.luaScriptService.loadScripts();
        // Give Lua scripts time to fully initialize
        setTimeout(() => {
          clearTimeout(timeout);
          resolve();
        }, 1000);
      } catch (err) {
        clearTimeout(timeout);
        reject(err);
      }
    });
  }

  /**
   * Check if the app is ready for page loads
   */
  isReady(): boolean {
    return this.initializationComplete() && !this.isInitializing();
  }

  /**
   * Get current initialization stage
   */
  getCurrentStage(): string {
    return this.loadingStage();
  }
}
