import { Injectable, signal } from '@angular/core';
import { QSysService } from './qsys.service';

export interface ComponentInfo {
  name: string;
  type: string;
  controlCount: number;
}

export interface ControlInfo {
  name: string;
  type: string;
  direction: string;
  value?: any;
  valueMin?: number;
  valueMax?: number;
  position?: number;
  string?: string;
  choices?: string[];
}

@Injectable({
  providedIn: 'root',
})
export class QSysBrowserService {
  // Available components (from MCP server)
  public components = signal<ComponentInfo[]>([]);

  // Currently selected component
  public selectedComponent = signal<ComponentInfo | null>(null);

  // Controls for selected component
  public controls = signal<ControlInfo[]>([]);

  // Currently selected control
  public selectedControl = signal<ControlInfo | null>(null);

  constructor(private qsysService: QSysService) {}

  /**
   * Load all components from Q-SYS design
   * This should be called via MCP tools externally, then the result passed here
   */
  setComponents(components: ComponentInfo[]): void {
    this.components.set(components);
  }

  /**
   * Select a component and load its controls
   */
  async selectComponent(component: ComponentInfo): Promise<void> {
    this.selectedComponent.set(component);
    this.selectedControl.set(null);
    // Controls will be loaded via MCP tools externally
  }

  /**
   * Set controls for the currently selected component
   */
  setControls(controls: ControlInfo[]): void {
    this.controls.set(controls);
  }

  /**
   * Select a control for editing
   */
  selectControl(control: ControlInfo): void {
    this.selectedControl.set(control);
  }

  /**
   * Update a control value
   */
  updateControlValue(value: any, ramp?: number): void {
    const component = this.selectedComponent();
    const control = this.selectedControl();

    if (component && control) {
      this.qsysService.setControl(component.name, control.name, value, ramp);
    }
  }

  /**
   * Go back to component list
   */
  backToComponents(): void {
    this.selectedComponent.set(null);
    this.controls.set([]);
    this.selectedControl.set(null);
  }

  /**
   * Go back to control list
   */
  backToControls(): void {
    this.selectedControl.set(null);
  }
}
