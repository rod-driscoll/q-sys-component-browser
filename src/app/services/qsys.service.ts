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

  constructor() { }

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
      // QRWC needs time to discover and populate component.controls objects
      setTimeout(async () => {
        this.qrwcComponents = this.qrwc?.components || null;

        // Debug: Log which components have controls loaded at initialization
        if (this.qrwcComponents) {
          try {
            // Use getComponents() method instead of manual access
            const components = await this.getComponents();
            let loadedCount = 0;
            let notLoadedCount = 0;

            console.log('=== Component Control Loading Status ===');
            components.forEach(comp => {
              if (comp.controlCount === 0) {
                console.log(`  ⚠ ${comp.name}: 0 controls (may not be loaded yet)`);
                notLoadedCount++;
              } else {
                console.log(`  ✓ ${comp.name}: ${comp.controlCount} controls`);
                loadedCount++;
              }
            });

            console.log(`\nSummary: ${loadedCount} components with controls, ${notLoadedCount} components with 0 controls`);
            console.log('Components with 0 controls may load their controls when accessed.');
            console.log('========================================');
          } catch (error) {
            console.error('Failed to log component status:', error);
          }
        }

        this.isConnected.set(true);
        this.connectionStatus$.next(true);
        console.log('QRWC initialization complete');
      }, 2000); // Suggestion: Increase from 2000ms to 5000ms to allow more time for component discovery

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
   * Refresh component control counts after QRWC has had more time to load
   * Useful for getting accurate counts after initial lazy loading
   */
  async refreshComponentCounts(): Promise<ComponentWithControls[]> {
    if (!this.qrwcComponents) {
      throw new Error('Not connected to Q-SYS Core');
    }

    console.log('Refreshing component control counts...');

    // Give QRWC additional time to populate controls
    await new Promise(resolve => setTimeout(resolve, 2000));

    return this.getComponents();
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

        // Priority 1: If it has Choices, it's a Combo box (or List Box)
        // This overrides Position checks because even if it has a position (e.g. index),
        // the presence of choices means we should show a dropdown.
        // EXCEPTION: If it has ValueMin AND ValueMax, it's likely an Integer Knob with choices (steps),
        // so we should let it fall through to the Knob check.
        if (state.Choices && Array.isArray(state.Choices) && state.Choices.length > 0 &&
          (state.ValueMin === undefined || state.ValueMax === undefined)) {
          controlType = 'Combo box';
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
          Name: controlName,
          Type: controlType,
          Direction: state.Direction || 'Read/Write',
          Value: state.Value,
          ValueMin: state.ValueMin,
          ValueMax: state.ValueMax,
          Position: state.Position,
          String: state.String,
          Choices: state.Choices,
          StringMin: state.StringMin,
          StringMax: state.StringMax,
          // Add inferred properties
          Units: inferredProps.units,
          PushAction: inferredProps.pushAction,
          IndicatorType: inferredProps.indicatorType
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
   * Set a control position (0-1)
   * Uses QRWC's control.update({ Position: value }) API
   */
  async setControlPosition(componentName: string, controlName: string, position: number): Promise<void> {
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

      console.log(`Setting ${componentName}:${controlName} position to ${position}`);

      // Use QRWC's update method with Position property
      // According to QRWC docs: await control.update({ Position: 0.5 })
      await control.update({ Position: position });

    } catch (error) {
      console.error(`Failed to set control position ${componentName}:${controlName}:`, error);
      throw error;
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
