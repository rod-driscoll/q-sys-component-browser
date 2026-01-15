import { Component, OnInit, OnDestroy, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationHeaderComponent } from '../../components/custom-views/shared/navigation-header/navigation-header.component';
import { KnobControl } from '../../components/qsys-browser/controls/knob-control/knob-control';
import { BooleanControl } from '../../components/qsys-browser/controls/boolean-control/boolean-control';
// import { ButtonControl } from '../../components/qsys-browser/controls/button-control/button-control';
import { TextControl } from '../../components/qsys-browser/controls/text-control/text-control';
import { ComboControl } from '../../components/qsys-browser/controls/combo-control/combo-control';
import { NAMED_CONTROLS_METADATA } from './named-controls.metadata';
import { NamedControlsService, NamedControl } from '../../services/named-controls.service';
import { ControlInfo } from '../../services/qsys-browser.service';
import { LuaScriptService } from '../../services/lua-script.service';
import { QSysService } from '../../services/qsys.service';
import { WebSocketDiscoveryService } from '../../services/websocket-discovery.service';

/**
 * Named Controls custom view
 * Displays all named controls from ExternalControls.xml as interactive controls
 */
@Component({
  selector: 'app-named-controls',
  standalone: true,
  imports: [
    CommonModule,
    NavigationHeaderComponent,
    KnobControl,
    BooleanControl,
    // ButtonControl,
    TextControl,
    ComboControl
  ],
  templateUrl: './named-controls.component.html',
  styleUrl: './named-controls.component.css'
})
export class NamedControlsComponent implements OnInit, OnDestroy {
  /** View title from metadata */
  readonly title = NAMED_CONTROLS_METADATA.title;

  constructor(
    private namedControlsService: NamedControlsService,
    private luaScriptService: LuaScriptService,
    private qsysService: QSysService,
    private wsDiscoveryService: WebSocketDiscoveryService
  ) {}

  // Use service signals via getters
  get namedControls() { return this.namedControlsService.namedControls; }
  get isLoading() { return this.namedControlsService.isLoading; }
  get errorMessage() { return this.namedControlsService.error; }
  get isConnected() { return this.namedControlsService.isConnected; }

  ngOnInit(): void {
    // Initialize named controls with proper dependency sequencing
    this.initializeNamedControls();
  }

  ngOnDestroy(): void {
    // No cleanup needed - using QRWC which is managed by QSysService
  }

  /**
   * Initialize named controls with proper sequencing:
   * 1. Wait for QRWC connection
   * 2. Wait for components to load
   * 3. Ensure WebSocket discovery is complete
   * 4. Load Lua scripts for file system access
   * 5. Load named controls from ExternalControls.xml
   */
  private async initializeNamedControls(): Promise<void> {
    try {
      // Step 1: Wait for QRWC connection
      await this.waitForQRWCConnection();
      console.log('✓ QRWC connection established');

      // Step 2: Wait for components to load
      await this.waitForComponentsLoaded();
      console.log('✓ Components loaded');

      // Step 3: Ensure WebSocket discovery is complete
      await this.ensureDiscoveryComplete();
      console.log('✓ WebSocket discovery complete');

      // Step 4: Load Lua scripts for file system access
      await this.loadLuaScripts();
      console.log('✓ Lua scripts loaded');

      // Step 5: Now load named controls
      await this.loadControls();
      console.log('✓ Named controls loaded');
    } catch (error) {
      console.error('Failed to initialize named controls:', error);
      this.namedControlsService.error.set(
        error instanceof Error ? error.message : 'Failed to initialize named controls'
      );
    }
  }

  /**
   * Wait for QRWC connection to be established
   */
  private waitForQRWCConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Check if already connected
      if (this.qsysService.isConnected()) {
        resolve();
        return;
      }

      // Wait for connection with timeout
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for QRWC connection'));
      }, 10000); // 10 second timeout

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
   * Wait for components to be loaded from QRWC
   */
  private async waitForComponentsLoaded(): Promise<void> {
    // This will trigger component loading if not already done
    const components = await this.qsysService.getComponents();
    if (!components || components.length === 0) {
      throw new Error('No components loaded from Q-SYS Core');
    }
  }

  /**
   * Ensure WebSocket discovery is complete before accessing file system
   * The discovery process sets up the tunnel needed for file access
   */
  private async ensureDiscoveryComplete(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Check if already connected
      if (this.wsDiscoveryService.isConnected()) {
        resolve();
        return;
      }

      // Start discovery and wait for completion
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for WebSocket discovery'));
      }, 15000); // 15 second timeout

      const checkConnection = setInterval(() => {
        if (this.wsDiscoveryService.isConnected()) {
          clearInterval(checkConnection);
          clearTimeout(timeout);
          resolve();
        }
      }, 100);

      // Initiate discovery if not already started
      if (!this.wsDiscoveryService.isConnected()) {
        this.wsDiscoveryService.connect().catch(err => {
          clearInterval(checkConnection);
          clearTimeout(timeout);
          reject(err);
        });
      }
    });
  }

  /**
   * Load Lua scripts for WebSocket file system endpoint
   */
  private async loadLuaScripts(): Promise<void> {
    try {
      await this.luaScriptService.loadScripts();
    } catch (error) {
      console.warn('Failed to load Lua scripts:', error);
      // Continue - file system might still be available
    }
  }

  /**
   * Load named controls
   */
  private async loadControls(): Promise<void> {
    try {
      await this.namedControlsService.loadNamedControls();
    } catch (error) {
      console.error('Failed to load named controls:', error);
    }
  }

  /**
   * Get icon for control type
   */
  getControlIcon(type: string): string {
    switch (type) {
      case 'Float':
      case 'Integer':
        return '🎚️';
      case 'Boolean':
        return '🔘';
      case 'String':
        return '📝';
      case 'Trigger':
        return '⚡';
      default:
        return '🎛️';
    }
  }

  /**
   * Get display value for control
   */
  getDisplayValue(control: NamedControl): string {
    if (control.value === undefined && control.stringValue === undefined) {
      return '-';
    }

    if (control.stringValue !== undefined) {
      return control.stringValue;
    }

    if (typeof control.value === 'boolean') {
      return control.value ? 'On' : 'Off';
    }

    if (typeof control.value === 'number') {
      if (control.type === 'Float') {
        return control.value.toFixed(2);
      }
      return control.value.toString();
    }

    return String(control.value);
  }

  /**
   * Handle control value change
   */
  async onControlValueChange(control: NamedControl, newValue: number | string | boolean): Promise<void> {
    console.log('Named control value changed:', control.id, newValue);
    try {
      await this.namedControlsService.setControlValue(control.id, newValue);
    } catch (error) {
      console.error('Failed to set control value:', error);
    }
  }

  /**
   * Handle trigger control click
   */
  async onTriggerClick(control: NamedControl): Promise<void> {
    console.log('Triggering named control:', control.id);
    try {
      await this.namedControlsService.triggerControl(control.id);
    } catch (error) {
      console.error('Failed to trigger control:', error);
    }
  }

  /**
   * Refresh named controls list
   */
  async refresh(): Promise<void> {
    await this.namedControlsService.refresh();
  }

  /**
   * Convert NamedControl to ControlInfo for use with control components
   */
  toControlInfo(control: NamedControl): ControlInfo {
    return {
      id: control.id,
      name: control.controlId,
      string: control.stringValue || '',
      value: typeof control.value === 'number' ? control.value : 0,
      position: control.position || 0,
      type: this.mapControlType(control.type),
      direction: control.mode === 'R' ? 'output' : 'input',
      componentId: control.componentId,
      componentName: control.componentLabel
    } as ControlInfo;
  }

  /**
   * Map named control type to ControlInfo type
   */
  private mapControlType(type: string): string {
    switch (type) {
      case 'Float':
      case 'Integer':
        return 'knob';
      case 'Boolean':
        return 'led_button';
      case 'String':
        return 'text';
      case 'Trigger':
        return 'trigger';
      default:
        return 'unknown';
    }
  }
}
