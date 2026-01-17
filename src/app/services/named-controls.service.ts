import { Injectable, signal } from '@angular/core';
import { QSysService } from './qsys.service';
import { SecureTunnelDiscoveryService } from './secure-tunnel-discovery.service';

/**
 * Named control from ExternalControls.xml
 */
export interface NamedControl {
  id: string;
  controlId: string;
  controlName: string;
  componentId: string;
  componentName: string;
  componentLabel: string;
  type: 'Float' | 'Integer' | 'String' | 'Boolean' | 'Trigger';
  mode: 'R' | 'W' | 'RW';
  size: number;
  minimumValue?: number;
  maximumValue?: number;
  value?: number | string | boolean;
  stringValue?: string;
  position?: number;
}

@Injectable({
  providedIn: 'root'
})
export class NamedControlsService {
  // Signals for reactive state
  public namedControls = signal<NamedControl[]>([]);
  public isLoading = signal<boolean>(false);
  public error = signal<string | null>(null);

  // Get QRWC connection status from QSysService
  get isConnected() {
    return this.qsysService.isConnected;
  }

  constructor(
    private qsysService: QSysService,
    private secureTunnelService: SecureTunnelDiscoveryService
  ) {}

  /**
   * Load named controls from ExternalControls.xml
   */
  async loadNamedControls(): Promise<void> {
    console.log('Loading named controls from ExternalControls.xml');
    this.isLoading.set(true);
    this.error.set(null);

    try {
      // Read ExternalControls.xml using the file-system service
      const xmlContent = await this.readExternalControlsXml();

      // Parse XML to extract Control elements
      const controls = this.parseExternalControlsXml(xmlContent);

      // Get current values for all controls using QRWC Control.Get
      await this.loadControlValues(controls);

      this.namedControls.set(controls);
      console.log(`Loaded ${controls.length} named controls`);
    } catch (err: any) {
      console.error('Failed to load named controls:', err);
      this.error.set(err.message || 'Failed to load named controls');
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Read ExternalControls.xml from the design directory on Q-SYS Core
   * Uses the secure tunnel file operations to read from /design/ExternalControls.xml
   */
  private async readExternalControlsXml(): Promise<string> {
    try {
      console.log('[NAMED-CONTROLS] Reading ExternalControls.xml from design directory via secure tunnel');
      
      // Request file read via secure tunnel (json_input control)
      const result = await this.secureTunnelService.readFile('/design/ExternalControls.xml');
      
      if (!result || !result.content) {
        throw new Error('ExternalControls.xml not found in design directory or file is empty');
      }
      
      console.log('[NAMED-CONTROLS] Successfully read ExternalControls.xml from Core');
      return result.content;
    } catch (error) {
      console.error('[NAMED-CONTROLS] Error reading ExternalControls.xml from Core:', error);
      throw new Error(
        'Failed to read ExternalControls.xml from design directory. ' +
        'Make sure the file exists in the Q-SYS design and the secure tunnel is connected.'
      );
    }
  }

  /**
   * Parse ExternalControls.xml to extract Control elements
   */
  private parseExternalControlsXml(xmlContent: string): NamedControl[] {
    const controls: NamedControl[] = [];

    // Simple XML parsing for Control elements
    // Match: <Control Id="..." ControlId="..." ControlName="..." ComponentId="..." ComponentName="..." ComponentLabel="..." Type="..." Mode="..." Size="..." [MinimumValue="..."] [MaximumValue="..."] />
    const controlRegex = /<Control\s+([^>]+)\/>/g;
    let match;

    while ((match = controlRegex.exec(xmlContent)) !== null) {
      const controlAttrs = match[1];
      const control: any = {};

      // Extract all attributes
      const attrRegex = /(\w+)="([^"]*)"/g;
      let attrMatch;

      while ((attrMatch = attrRegex.exec(controlAttrs)) !== null) {
        const attrName = attrMatch[1];
        const attrValue = attrMatch[2];
        control[attrName] = attrValue;
      }

      // Convert to NamedControl interface
      const namedControl: NamedControl = {
        id: control.Id || '',
        controlId: control.ControlId || '',
        controlName: control.ControlName || control.Id || '',
        componentId: control.ComponentId || '',
        componentName: control.ComponentName || '',
        componentLabel: control.ComponentLabel || '',
        type: control.Type || 'String',
        mode: control.Mode || 'RW',
        size: parseInt(control.Size) || 1,
        minimumValue: control.MinimumValue ? parseFloat(control.MinimumValue) : undefined,
        maximumValue: control.MaximumValue ? parseFloat(control.MaximumValue) : undefined
      };

      controls.push(namedControl);
    }

    return controls;
  }

  /**
   * Load current values for all controls using QRWC Control.Get
   */
  private async loadControlValues(controls: NamedControl[]): Promise<void> {
    const promises = controls.map(async (control) => {
      try {
        const value = await this.getControlValue(control.id);
        control.value = value.Value;
        control.stringValue = value.String;
        control.position = value.Position;
      } catch (err) {
        console.warn(`Failed to get value for control ${control.id}:`, err);
        // Keep control even if we can't get its value
      }
    });

    await Promise.all(promises);
  }

  /**
   * Get control value using QRWC Control.Get RPC
   */
  private async getControlValue(controlId: string): Promise<any> {
    const qrwc = (this.qsysService as any).qrwc;
    if (!qrwc) {
      throw new Error('Not connected to Q-SYS Core');
    }

    const webSocketManager = qrwc.webSocketManager;
    const result = await webSocketManager.sendRpc('Control.Get', {
      Name: controlId
    });

    return result;
  }

  /**
   * Set a named control value using QRWC Control.Set RPC
   */
  async setControlValue(controlId: string, value: number | string | boolean): Promise<void> {
    const qrwc = (this.qsysService as any).qrwc;
    if (!qrwc) {
      throw new Error('Not connected to Q-SYS Core');
    }

    try {
      console.log(`Setting control ${controlId} to ${value}`);

      const webSocketManager = qrwc.webSocketManager;
      await webSocketManager.sendRpc('Control.Set', {
        Name: controlId,
        Value: value
      });

      // Get updated value
      const updatedValue = await this.getControlValue(controlId);

      // Update the control in our list
      const controls = this.namedControls();
      const controlIndex = controls.findIndex(c => c.id === controlId);
      if (controlIndex >= 0) {
        const updatedControls = [...controls];
        updatedControls[controlIndex] = {
          ...updatedControls[controlIndex],
          value: updatedValue.Value,
          stringValue: updatedValue.String,
          position: updatedValue.Position
        };
        this.namedControls.set(updatedControls);
      }

      console.log(`Successfully set control ${controlId}`);
    } catch (err) {
      console.error(`Failed to set control ${controlId}:`, err);
      throw err;
    }
  }

  /**
   * Trigger a named control (for trigger type controls)
   */
  async triggerControl(controlId: string): Promise<void> {
    await this.setControlValue(controlId, true);
  }

  /**
   * Refresh named controls list
   */
  async refresh(): Promise<void> {
    await this.loadNamedControls();
  }
}
