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
  componentName?: string; // Added for global search results
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
            this.matchesPattern(control.Name, term) ||
            this.matchesPattern(control.Type, term)
          )
          .map(control => ({
            name: control.Name,
            type: control.Type,
            direction: control.Direction,
            value: control.Value,
            valueMin: control.ValueMin,
            valueMax: control.ValueMax,
            position: control.Position,
            string: control.String,
            choices: control.Choices,
            componentName: component.name // Include component name for display
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
        name: c.Name,
        type: c.Type,
        direction: c.Direction,
        value: c.Value,
        valueMin: c.ValueMin,
        valueMax: c.ValueMax,
        position: c.Position,
        string: c.String,
        choices: c.Choices
      }));

      this.controls.set(controlInfos);
      this.selectedControl.set(control);
      this.isGlobalSearch.set(false);
    } catch (error) {
      console.error('Error loading component controls:', error);
    }
  }
}
