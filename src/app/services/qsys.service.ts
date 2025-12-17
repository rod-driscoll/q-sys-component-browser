import { Injectable, signal } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { QrwcConnectionOptions } from '../models/qsys-control.model';
import { Qrwc } from '@q-sys/qrwc';

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
  private qrwcComponents: any = null;
  private currentComponentListener: any = null;
  private currentComponent: any = null;

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

  constructor() {}

  /**
   * Connect to Q-SYS Core using QRWC library
   * @param optionsOrIp - Connection options object or IP address string
   */
  async connect(optionsOrIp: QrwcConnectionOptions | string): Promise<void> {
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

    const protocol = this.options.secure ? 'wss' : 'ws';
    const url = `${protocol}://${this.options.coreIp}/qrc-public-api/v0`;

    try {
      console.log('Connecting to Q-SYS Core via QRWC...');

      // Create WebSocket
      const socket = new WebSocket(url);

      // Wait for WebSocket to open
      await new Promise<void>((resolve, reject) => {
        socket.onopen = () => resolve();
        socket.onerror = (error) => reject(error);
      });

      // Create QRWC instance using factory method
      // Note: Not passing a logger to avoid verbose polling spam in console
      // QRWC will still poll ALL components automatically - this is expected behavior
      this.qrwc = await Qrwc.createQrwc({
        socket,
        pollingInterval: this.options.pollInterval || 35,
        // No logger = no console spam from polling
      });

      console.log('Connected to Q-SYS Core');

      // Note: Don't set connected status yet - wait for QRWC to be ready
      // QRWC needs time to discover components

      // Set connection status after a brief delay to allow QRWC to initialize
      setTimeout(() => {
        this.qrwcComponents = this.qrwc?.components || null;
        this.isConnected.set(true);
        this.connectionStatus$.next(true);
        console.log('QRWC initialization complete');
      }, 1000);

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

    if (this.qrwc) {
      this.qrwc.disconnect();
      this.qrwc = null;
      this.qrwcComponents = null;
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
  getControlUpdates(): Observable<{ component: string; control: string; value: any; position?: number; string?: string; Bool?: boolean }> {
    return this.controlUpdates$.asObservable();
  }

  /**
   * Get all components from Q-SYS Core
   * Returns a promise that resolves with the component list
   */
  async getComponents(): Promise<ComponentWithControls[]> {
    if (!this.qrwcComponents) {
      throw new Error('Not connected to Q-SYS Core');
    }

    try {
      // Get all component names
      const componentNames = Object.keys(this.qrwcComponents);

      // For each component, get its controls to count them
      const componentsWithCounts: ComponentWithControls[] = [];

      for (const name of componentNames) {
        const component = this.qrwcComponents[name];
        // Controls are in component.controls, not directly on component
        const componentControls = component.controls || {};
        const controlCount = Object.keys(componentControls).length;


        componentsWithCounts.push({
          name: name,
          type: component._state?.Type || 'Unknown',
          controlCount: controlCount
        });
      }

      return componentsWithCounts;
    } catch (error) {
      console.error('Failed to get components:', error);
      throw error;
    }
  }

  /**
   * Get all controls for a specific component
   * Returns a promise that resolves with the control list
   */
  async getComponentControls(componentName: string): Promise<any[]> {
    if (!this.qrwcComponents) {
      throw new Error('Not connected to Q-SYS Core');
    }

    try {
      const component = this.qrwcComponents[componentName];
      if (!component) {
        throw new Error(`Component "${componentName}" not found`);
      }

      // Controls are in component.controls, not directly on component
      const componentControls = component.controls;
      if (!componentControls) {
        console.warn(`Component "${componentName}" has no controls property`);
        return [];
      }

      const controlNames = Object.keys(componentControls);
      const controls: any[] = [];

      for (const controlName of controlNames) {
        const control = componentControls[controlName];

        // Access control state
        const state = control.state || control;

        // Debug log for combo box controls
        if (controlName.toLowerCase().includes('display') || controlName.toLowerCase().includes('call')) {
          console.log(`Control ${controlName}:`, {
            Type: state.Type,
            hasChoices: !!state.Choices,
            Choices: state.Choices,
            allKeys: Object.keys(state)
          });
        }

        // Debug log for knob/fader controls
        if (controlName.toLowerCase().includes('volume') || controlName.toLowerCase().includes('fader') || state.Position !== undefined) {
          console.log(`Control ${controlName} (has Position):`, {
            Type: state.Type,
            Value: state.Value,
            ValueMin: state.ValueMin,
            ValueMax: state.ValueMax,
            Position: state.Position,
            String: state.String,
            allKeys: Object.keys(state)
          });
        }

        // Infer/correct control type
        let controlType = state.Type;

        // Override type based on control properties (Q-SYS often reports incorrect types)
        if (state.Choices && Array.isArray(state.Choices) && state.Choices.length > 0) {
          // Has choices = Combo box (Q-SYS often reports as "Text")
          controlType = 'Combo box';
        } else if (state.Position !== undefined && controlType === 'Float') {
          // Float with Position = Knob/Fader (use Position for control, not Value)
          controlType = 'Knob';
        } else if (!controlType || controlType === '') {
          // If no type provided, infer from name patterns
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

        controls.push({
          Name: controlName,
          Type: controlType,
          Direction: state.Direction || 'Read/Write',
          Value: state.Value,
          ValueMin: state.ValueMin,
          ValueMax: state.ValueMax,
          Position: state.Position,
          String: state.String,
          Choices: state.Choices
        });
      }

      return controls;
    } catch (error) {
      console.error(`Failed to get controls for ${componentName}:`, error);
      throw error;
    }
  }

  /**
   * Subscribe to a component's control changes using component-level event listener
   */
  subscribeToComponent(componentName: string): void {
    if (!this.qrwcComponents) {
      console.error('Not connected to Q-SYS Core');
      return;
    }

    // Unsubscribe from previous component if any
    if (this.currentComponentListener) {
      this.unsubscribeFromComponent();
    }

    try {
      const component = this.qrwcComponents[componentName];
      if (!component) {
        console.error(`Component "${componentName}" not found`);
        return;
      }

      console.log(`Subscribing to component: ${componentName}`);

      // Store reference to component
      this.currentComponent = component;

      // Set up component-level event listener
      // This will listen to all controls in the component
      // QRWC is already polling this component automatically
      this.currentComponentListener = component.on('update', (control: any, state: any) => {
        // The first parameter is the control object (not a string), extract the name
        const controlName = control.name || control;
        console.log(`Control update: ${componentName}:${controlName}`, state);

        this.controlUpdates$.next({
          component: componentName,
          control: controlName,
          value: state.Value,
          position: state.Position,
          string: state.String,
          Bool: state.Bool
        });
      });

    } catch (error) {
      console.error(`Failed to subscribe to component ${componentName}:`, error);
    }
  }

  /**
   * Unsubscribe from the current component
   */
  unsubscribeFromComponent(): void {
    if (this.currentComponentListener) {
      console.log('Unsubscribing from component');

      // Remove event listener
      this.currentComponentListener.off();
      this.currentComponentListener = null;
    }

    // Clear component reference
    if (this.currentComponent) {
      this.currentComponent = null;
    }
  }

  /**
   * Set a control value
   */
  async setControl(componentName: string, controlName: string, value: any, ramp?: number): Promise<void> {
    if (!this.qrwcComponents) {
      throw new Error('Not connected to Q-SYS Core');
    }

    try {
      const component = this.qrwcComponents[componentName];
      if (!component) {
        throw new Error(`Component "${componentName}" not found`);
      }

      // Access control from component.controls
      const control = component.controls?.[controlName];
      if (!control) {
        throw new Error(`Control "${controlName}" not found in component "${componentName}"`);
      }

      console.log(`Setting ${componentName}:${controlName} to ${value}${ramp ? ` with ramp ${ramp}s` : ''}`);

      // Check control type from state
      const state = control.state || control;
      const controlType = state.Type;

      // Identify pulse triggers:
      // - Type must be "Trigger" (Q-SYS reports this for true pulse triggers)
      // - Controls ending in "Trig" are usually pulse triggers
      // - BUT: SystemOn/SystemOff/PowerOn/PowerOff are STATE triggers, not pulse triggers
      const isStateTrigger = /^(System|Power)(On|Off)$/i.test(controlName);
      const isPulseTrigger = (controlType === 'Trigger' || controlName.endsWith('Trig')) &&
                            !isStateTrigger &&
                            value === 1;

      if (isPulseTrigger) {
        // For pulse triggers, pulse high then low
        console.log(`Triggering ${componentName}:${controlName} (pulse)`);
        await control.update(1);
        await control.update(0);
      } else {
        // For State Triggers and all other controls, just set the value
        if (ramp !== undefined && ramp > 0) {
          await control.update(value, ramp);
        } else {
          await control.update(value);
        }
      }

    } catch (error) {
      console.error(`Failed to set control ${componentName}:${controlName}:`, error);
      throw error;
    }
  }

  /**
   * Enable continuous polling - not needed with event listeners
   * Kept for compatibility
   */
  public enableContinuousPolling(): void {
    // Not needed with QRWC event listeners
    console.log('Continuous polling not needed - using event listeners');
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

      console.log('Core Engine Status:', status);

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
