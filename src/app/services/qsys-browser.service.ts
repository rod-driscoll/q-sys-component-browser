import { Injectable, signal } from '@angular/core';
import { QSysService } from './qsys.service';

export interface ComponentInfo {
  name: string;
  type: string;
  controlCount: number;
  discoveryMethod?: 'qrwc' | 'websocket'; // Track how component was discovered
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
  stringMin?: string;
  stringMax?: string;
  componentName?: string; // Added for global search results
  // Inferred properties (not directly from Q-SYS API)
  units?: string; // Hz, Float, Integer, Meter (dB), Percent, Pan, Seconds
  pushAction?: string; // State Trigger, Trigger
  indicatorType?: string; // Combo Box (for Text controls that are actually combo boxes)
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

  // Global control search results
  public globalSearchResults = signal<ControlInfo[]>([]);
  public isGlobalSearch = signal<boolean>(false);

  constructor(private qsysService: QSysService) { }

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
  async updateControlValue(value: any, ramp?: number): Promise<void> {
    const component = this.selectedComponent();
    const control = this.selectedControl();

    if (!component || !control) return;
    console.log('updateControlValue', component, control);
    try {
      if (component.discoveryMethod === 'websocket') {
        await this.qsysService.setControlViaHTTP(component.name, control.name, value);
      } else {
        await this.qsysService.setControl(component.name, control.name, value, ramp);
      }
    } catch (error) {
      console.error(`Failed to update control value:`, error);
    }
  }

  /**
   * Update a control position (0-1)
   */
  async updateControlPosition(position: number): Promise<void> {
    const component = this.selectedComponent();
    const control = this.selectedControl();

    if (!component || !control) return;

    try {
      if (component.discoveryMethod === 'websocket') {
        // Websocket components might not support position via HTTP API easily?
        // Fallback to value calculation or ignore?
        // Actually, let's assume HTTP API takes { "Position": x }?
        // Since I don't know, I will just log warning or try to calculate value locally?
        // Or just TRY to send it?
        // Let's defer HTTP impl details. User is using QRWC (setControl).
        console.warn('Position updates not fully supported for HTTP components yet.');
      } else {
        await this.qsysService.setControlPosition(component.name, control.name, position);
      }
    } catch (error) {
      console.error(`Failed to update control position:`, error);
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

  /**
   * Helper method to test if a string matches a pattern (supports regex)
   */
  private matchesPattern(text: string, pattern: string): boolean {
    if (!pattern) return true;

    try {
      // Try to create a regex pattern (case-insensitive)
      const regex = new RegExp(pattern, 'i');
      return regex.test(text);
    } catch (e) {
      // If regex is invalid, fall back to plain text search (case-insensitive)
      return text.toLowerCase().includes(pattern.toLowerCase());
    }
  }

  /**
   * Search for controls across all components (supports regex)
   */
  async searchGlobalControls(searchTerm: string): Promise<void> {
    if (!searchTerm || searchTerm.trim() === '') {
      this.globalSearchResults.set([]);
      this.isGlobalSearch.set(false);
      return;
    }

    const term = searchTerm.trim();
    const allControls: ControlInfo[] = [];

    // Search through all components
    for (const component of this.components()) {
      try {
        const controls = await this.qsysService.getComponentControls(component.name);

        // Filter controls that match the search term (supports regex)
        const matchingControls = controls
          .filter(control =>
            this.matchesPattern(control.name, term) ||
            this.matchesPattern(control.type, term)
          )
          .map(control => ({
            name: control.name,
            type: control.type,
            direction: control.direction,
            value: control.value,
            valueMin: control.valueMin,
            valueMax: control.valueMax,
            position: control.position,
            string: control.string,
            choices: control.choices,
            stringMin: control.stringMin,
            stringMax: control.stringMax,
            componentName: component.name, // Include component name for display
            units: control.units,
            pushAction: control.pushAction,
            indicatorType: control.indicatorType
          }));

        allControls.push(...matchingControls);
      } catch (error) {
        console.error(`Error searching component ${component.name}:`, error);
      }
    }

    this.globalSearchResults.set(allControls);
    this.isGlobalSearch.set(true);
  }

  /**
   * Clear global search and return to normal view
   */
  clearGlobalSearch(): void {
    this.globalSearchResults.set([]);
    this.isGlobalSearch.set(false);
  }

  /**
   * Select a control from global search results
   */
  async selectControlFromGlobalSearch(control: ControlInfo): Promise<void> {
    if (!control.componentName) return;

    // Find the component
    const component = this.components().find(c => c.name === control.componentName);
    if (!component) return;

    // Select the component and load its controls
    this.selectedComponent.set(component);

    try {
      const controls = await this.qsysService.getComponentControls(component.name);
      const controlInfos = controls.map(c => ({
        name: c.name,
        type: c.type,
        direction: c.direction,
        value: c.value,
        valueMin: c.valueMin,
        valueMax: c.valueMax,
        position: c.position,
        string: c.string,
        choices: c.choices,
        stringMin: c.stringMin,
        stringMax: c.stringMax,
        units: c.units,
        pushAction: c.pushAction,
        indicatorType: c.indicatorType
      }));

      this.controls.set(controlInfos);
      this.selectedControl.set(control);
      this.isGlobalSearch.set(false);
    } catch (error) {
      console.error('Error loading component controls:', error);
    }
  }
}
