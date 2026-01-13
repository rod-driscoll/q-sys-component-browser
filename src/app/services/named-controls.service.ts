import { Injectable, signal } from '@angular/core';
import { QSysService } from './qsys.service';
import { FileSystemService } from './file-system.service';

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
    private fileSystemService: FileSystemService
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
   * Read ExternalControls.xml using file-system service
   */
  private async readExternalControlsXml(): Promise<string> {
    return new Promise((resolve, reject) => {
      // Ensure file-system service is connected
      if (!this.fileSystemService.isConnected()) {
        this.fileSystemService.connect();
      }

      // Wait for connection
      const checkConnection = setInterval(() => {
        if (this.fileSystemService.isConnected()) {
          clearInterval(checkConnection);

          // Request the file
          this.fileSystemService.readFile('ExternalControls.xml');

          // Wait for file content
          const checkContent = setInterval(() => {
            const content = this.fileSystemService.fileContent();
            const contentType = this.fileSystemService.fileContentType();
            const error = this.fileSystemService.error();

            if (error) {
              clearInterval(checkContent);
              reject(new Error(error));
            } else if (content && contentType) {
              clearInterval(checkContent);
              // Close the file view
              this.fileSystemService.closeFile();
              resolve(content);
            }
          }, 100);

          // Timeout after 5 seconds
          setTimeout(() => {
            clearInterval(checkContent);
            reject(new Error('Timeout reading ExternalControls.xml'));
          }, 5000);
        }
      }, 100);

      // Timeout after 5 seconds for connection
      setTimeout(() => {
        clearInterval(checkConnection);
        reject(new Error('Timeout connecting to file system'));
      }, 5000);
    });
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
