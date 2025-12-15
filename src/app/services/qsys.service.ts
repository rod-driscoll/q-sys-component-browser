import { Injectable, signal, computed } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import {
  QSysComponent,
  QSysControl,
  QrwcMessage,
  QrwcConnectionOptions,
} from '../models/qsys-control.model';

@Injectable({
  providedIn: 'root',
})
export class QSysService {
  private ws: WebSocket | null = null;
  private components = new Map<string, QSysComponent>();
  private messageId = 0;
  private pollInterval: number = 35;
  private pollTimer: any;
  private changeGroupId: string = 'AutoPoll';

  // Connection state
  public isConnected = signal(false);
  private connectionStatus$ = new BehaviorSubject<boolean>(false);
  private controlUpdates$ = new Subject<{ component: string; control: string; value: any }>();

  // Store connection options
  private options: QrwcConnectionOptions | null = null;

  constructor() {}

  /**
   * Connect to Q-SYS Core
   * @param optionsOrIp - Connection options object or IP address string
   */
  connect(optionsOrIp: QrwcConnectionOptions | string): void {
    // Parse connection options
    if (typeof optionsOrIp === 'string') {
      this.options = {
        coreIp: optionsOrIp,
        secure: false,
        pollInterval: 35,
      };
    } else {
      this.options = optionsOrIp;
    }

    this.pollInterval = this.options.pollInterval || 35;
    const protocol = this.options.secure ? 'wss' : 'ws';
    const url = `${protocol}://${this.options.coreIp}/qrc-public-api/v0`;

    try {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        console.log('Connected to Q-SYS Core');
        this.isConnected.set(true);
        this.connectionStatus$.next(true);
        // Create ChangeGroup for auto-polling
        this.createChangeGroup();
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event.data);
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.isConnected.set(false);
        this.connectionStatus$.next(false);
      };

      this.ws.onclose = () => {
        console.log('Disconnected from Q-SYS Core');
        this.isConnected.set(false);
        this.connectionStatus$.next(false);
        this.stopPolling();

        // Attempt reconnection after 5 seconds
        setTimeout(() => {
          if (this.options) {
            console.log('Attempting to reconnect...');
            this.connect(this.options);
          }
        }, 5000);
      };
    } catch (error) {
      console.error('Failed to connect:', error);
      this.isConnected.set(false);
      this.connectionStatus$.next(false);
    }
  }

  /**
   * Disconnect from Q-SYS Core
   */
  disconnect(): void {
    this.stopPolling();
    this.destroyChangeGroup();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected.set(false);
    this.connectionStatus$.next(false);
  }

  /**
   * Get observable for connection status
   */
  getConnectionStatus(): Observable<boolean> {
    return this.connectionStatus$.asObservable();
  }

  /**
   * Get observable for control updates
   */
  getControlUpdates(): Observable<{ component: string; control: string; value: any }> {
    return this.controlUpdates$.asObservable();
  }

  /**
   * Register a component for monitoring
   */
  addComponent(componentName: string): void {
    if (!this.components.has(componentName)) {
      this.components.set(componentName, {
        name: componentName,
        controls: new Map(),
      });
    }
  }

  /**
   * Add a control to monitor via ChangeGroup
   */
  addControl(componentName: string, controlName: string): void {
    this.addComponent(componentName);

    const component = this.components.get(componentName);
    if (component && !component.controls.has(controlName)) {
      component.controls.set(controlName, {
        name: controlName,
        type: 'Text',
        direction: 'Read/Write',
      });

      // Add control to ChangeGroup for automatic updates using the correct method
      this.sendMessage({
        jsonrpc: '2.0',
        method: 'ChangeGroup.AddComponentControl',
        params: {
          Id: this.changeGroupId,
          Component: {
            Name: componentName,
            Controls: [
              {
                Name: controlName,
              },
            ],
          },
        },
        id: this.getNextId(),
      });
    }
  }

  /**
   * Set a control value using Component.Set method
   */
  setControl(componentName: string, controlName: string, value: any, ramp?: number): void {
    const controlData: any = {
      Name: controlName,
      Value: value,
    };

    if (ramp !== undefined) {
      controlData.Ramp = ramp;
    }

    this.sendMessage({
      jsonrpc: '2.0',
      method: 'Component.Set',
      params: {
        Name: componentName,
        Controls: [controlData],
      },
      id: this.getNextId(),
    });
  }

  /**
   * Trigger a control (for Trigger type controls) using Component.Set
   */
  trigger(componentName: string, controlName: string): void {
    this.sendMessage({
      jsonrpc: '2.0',
      method: 'Component.Set',
      params: {
        Name: componentName,
        Controls: [
          {
            Name: controlName,
            Value: 1, // Triggers are set to 1
          },
        ],
      },
      id: this.getNextId(),
    });
  }

  /**
   * Get a control value (returns a signal)
   */
  getControl(componentName: string, controlName: string): any {
    const component = this.components.get(componentName);
    if (component) {
      return component.controls.get(controlName);
    }
    return null;
  }

  /**
   * Handle incoming messages from Q-SYS Core
   */
  private handleMessage(data: string): void {
    try {
      const message: QrwcMessage = JSON.parse(data);

      // Log errors in detail
      if (message.error) {
        console.error('Q-SYS Error:', JSON.stringify(message.error, null, 2), 'for message ID:', message.id);
        console.error('Full error message:', message);
      }

      // Handle ChangeGroup.Poll response (contains control updates)
      if (message.result && message.result.Changes && Array.isArray(message.result.Changes)) {
        // Log control changes (but only if there are any)
        if (message.result.Changes.length > 0) {
          console.log('Q-SYS ← Control changes:', message.result.Changes.map((c: any) =>
            `${c.Component}:${c.Name} = ${c.Value}`
          ).join(', '));
        }

        message.result.Changes.forEach((change: any) => {
          const component = this.components.get(change.Component);
          if (component) {
            const control = component.controls.get(change.Name);
            if (control) {
              control.value = change.Value;
              control.position = change.Position;
              control.string = change.String;

              // Emit update
              this.controlUpdates$.next({
                component: change.Component,
                control: change.Name,
                value: change.Value,
              });
            } else {
              console.warn(`Control ${change.Name} not found in component ${change.Component}`);
            }
          } else {
            console.warn(`Component ${change.Component} not found`);
          }
        });
      }
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  }

  /**
   * Send a message to Q-SYS Core
   */
  private sendMessage(message: QrwcMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      // Log control commands (but not polling)
      if (message.method && message.method !== 'ChangeGroup.Poll') {
        console.log(`Q-SYS → ${message.method}:`, message.params);
      }
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket not open, cannot send message:', message);
    }
  }

  /**
   * Get next message ID
   */
  private getNextId(): number {
    return ++this.messageId;
  }

  /**
   * Initialize ChangeGroup and do a single poll to activate it
   * After the initial poll, continuous polling will fetch updates
   */
  private createChangeGroup(): void {
    // Do a single poll to get initial values
    setTimeout(() => {
      this.pollControls();
    }, 100);
  }

  /**
   * Enable continuous polling for control updates
   * This is required to receive ongoing updates from Q-SYS
   */
  public enableContinuousPolling(): void {
    if (!this.pollTimer) {
      this.pollTimer = setInterval(() => {
        this.pollControls();
      }, this.pollInterval);
    }
  }

  /**
   * Start polling for control updates using ChangeGroup.Poll
   * (Not needed - single poll activates the ChangeGroup)
   */
  private startPolling(): void {
    // Not needed - single poll in createChangeGroup() activates async updates
  }

  /**
   * Stop polling
   */
  private stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  /**
   * Poll ChangeGroup for control updates (manual poll if needed)
   */
  private pollControls(): void {
    this.sendMessage({
      jsonrpc: '2.0',
      method: 'ChangeGroup.Poll',
      params: {
        Id: this.changeGroupId,
      },
      id: this.getNextId(),
    });
  }

  /**
   * Destroy ChangeGroup on disconnect (just stop polling, no explicit destroy needed)
   */
  private destroyChangeGroup(): void {
    // No explicit ChangeGroup.Destroy needed, just stop polling
    // The polling is already stopped by stopPolling() in disconnect()
  }
}
