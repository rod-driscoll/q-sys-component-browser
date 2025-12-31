import { OnInit, OnDestroy, signal, Directive } from '@angular/core';
import { Subscription } from 'rxjs';
import { QSysService } from '../../../services/qsys.service';
import { QSysBrowserService, ControlInfo, ComponentInfo } from '../../../services/qsys-browser.service';
import { ControlSelectionConfig } from '../../../models/custom-view.model';

/**
 * Base class for custom views with control selection and real-time updates
 *
 * Extend this class and implement getControlSelectionConfig() to define
 * which controls should be displayed in your custom view.
 *
 * Example:
 * ```typescript
 * export class VolumeControlsComponent extends CustomViewBase {
 *   protected getControlSelectionConfig(): ControlSelectionConfig[] {
 *     return [{
 *       method: 'componentPattern',
 *       componentPattern: '.*Volume.*|.*Audio.*',
 *       controlPattern: 'Fader|Mute'
 *     }];
 *   }
 * }
 * ```
 */
@Directive()
export abstract class CustomViewBase implements OnInit, OnDestroy {
  /** Signal containing all controls for this view */
  protected controls = signal<ControlInfo[]>([]);

  /** Signal indicating if controls are being loaded */
  protected isLoading = signal<boolean>(false);

  /** Signal for error messages */
  protected error = signal<string | null>(null);

  private subscriptions: Subscription[] = [];

  constructor(
    protected qsysService: QSysService,
    protected browserService: QSysBrowserService
  ) {}

  ngOnInit(): void {
    // Wait for connection before loading controls
    if (this.qsysService.isConnected()) {
      // Already connected, load immediately
      this.loadControls();
    } else {
      // Wait for connection
      const connectionSub = this.qsysService.getConnectionStatus().subscribe((connected) => {
        if (connected) {
          this.loadControls();
          connectionSub.unsubscribe(); // Only load once when first connected
        }
      });
      this.subscriptions.push(connectionSub);
    }

    this.subscribeToUpdates();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  /**
   * Override this method to define which controls to display
   * @returns Array of control selection configurations
   */
  protected abstract getControlSelectionConfig(): ControlSelectionConfig[];

  /**
   * Load controls based on selection configuration
   */
  protected async loadControls(): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);

    try {
      const configs = this.getControlSelectionConfig();
      const allControls: ControlInfo[] = [];

      for (const config of configs) {
        const controls = await this.selectControls(config);
        allControls.push(...controls);
      }

      // Remove duplicates (same component + control name)
      const uniqueControls = this.removeDuplicateControls(allControls);

      this.controls.set(uniqueControls);
      console.log(`✓ Loaded ${uniqueControls.length} controls for custom view`);
    } catch (err: any) {
      console.error('Failed to load controls:', err);
      this.error.set(err.message || 'Failed to load controls');
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Select controls based on a single configuration
   */
  private async selectControls(config: ControlSelectionConfig): Promise<ControlInfo[]> {
    switch (config.method) {
      case 'componentPattern':
        return this.selectByComponentPattern(config);
      case 'controlType':
        return this.selectByControlType(config);
      case 'componentType':
        return this.selectByComponentType(config);
      case 'explicitList':
        return this.selectByExplicitList(config);
      default:
        console.warn(`Unknown selection method: ${(config as any).method}`);
        return [];
    }
  }

  /**
   * Select controls by component name pattern
   */
  private async selectByComponentPattern(config: ControlSelectionConfig): Promise<ControlInfo[]> {
    const components = this.browserService.components();
    const pattern = new RegExp(config.componentPattern!, 'i');
    const matchedComponents = components.filter(c => pattern.test(c.name));

    const allControls: ControlInfo[] = [];

    for (const component of matchedComponents) {
      try {
        const controls = await this.qsysService.getComponentControls(component.name);

        let filteredControls = controls;
        if (config.controlPattern) {
          const controlPattern = new RegExp(config.controlPattern, 'i');
          filteredControls = controls.filter(c => controlPattern.test(c.name));
        }

        // Add component name to each control
        filteredControls.forEach(c => c.componentName = component.name);
        allControls.push(...filteredControls);
      } catch (err) {
        console.error(`Failed to get controls for ${component.name}:`, err);
      }
    }

    return allControls;
  }

  /**
   * Select controls by control type across all components
   */
  private async selectByControlType(config: ControlSelectionConfig): Promise<ControlInfo[]> {
    const components = this.browserService.components();
    const allControls: ControlInfo[] = [];

    for (const component of components) {
      try {
        const controls = await this.qsysService.getComponentControls(component.name);
        const matchedControls = controls.filter(c => c.type === config.controlType);
        matchedControls.forEach(c => c.componentName = component.name);
        allControls.push(...matchedControls);
      } catch (err) {
        console.error(`Failed to get controls for ${component.name}:`, err);
      }
    }

    return allControls;
  }

  /**
   * Select controls by component type
   */
  private async selectByComponentType(config: ControlSelectionConfig): Promise<ControlInfo[]> {
    const components = this.browserService.components();
    const matchedComponents = components.filter(c => c.type === config.componentType);

    const allControls: ControlInfo[] = [];

    for (const component of matchedComponents) {
      try {
        const controls = await this.qsysService.getComponentControls(component.name);
        controls.forEach(c => c.componentName = component.name);
        allControls.push(...controls);
      } catch (err) {
        console.error(`Failed to get controls for ${component.name}:`, err);
      }
    }

    return allControls;
  }

  /**
   * Select controls by explicit list
   */
  private async selectByExplicitList(config: ControlSelectionConfig): Promise<ControlInfo[]> {
    const allControls: ControlInfo[] = [];

    if (!config.components) {
      console.warn('explicitList method requires components array');
      return [];
    }

    for (const item of config.components) {
      try {
        const controls = await this.qsysService.getComponentControls(item.component);

        let filteredControls = controls;
        if (item.controls && item.controls.length > 0) {
          filteredControls = controls.filter(c => item.controls!.includes(c.name));
        }

        filteredControls.forEach(c => c.componentName = item.component);
        allControls.push(...filteredControls);
      } catch (err) {
        console.error(`Failed to get controls for ${item.component}:`, err);
      }
    }

    return allControls;
  }

  /**
   * Remove duplicate controls (same component + control name)
   */
  private removeDuplicateControls(controls: ControlInfo[]): ControlInfo[] {
    const seen = new Set<string>();
    return controls.filter(control => {
      // Skip controls without names - they can't be identified uniquely
      if (!control.name) {
        console.warn('Skipping control without name:', control);
        return false;
      }

      const key = `${control.componentName}:${control.name}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  /**
   * Subscribe to real-time control updates
   */
  private subscribeToUpdates(): void {
    const sub = this.qsysService.getControlUpdates().subscribe(update => {
      const controls = this.controls();
      const controlToUpdate = controls.find(
        c => c.componentName === update.component && c.name === update.control
      );

      if (controlToUpdate) {
        // Update control properties
        if (update.value !== undefined) controlToUpdate.value = update.value;
        if (update.position !== undefined) controlToUpdate.position = update.position;
        if (update.string !== undefined) controlToUpdate.string = update.string;

        // Trigger signal update
        this.controls.set([...controls]);
      }
    });

    this.subscriptions.push(sub);
  }

  /**
   * Handle control value change
   * Override this if you need custom handling
   */
  protected async handleValueChange(control: ControlInfo, value: any): Promise<void> {
    if (!control.componentName) {
      console.error('Control missing componentName:', control);
      return;
    }

    try {
      await this.qsysService.setControl(control.componentName, control.name, value);
    } catch (err) {
      console.error(`Failed to set control ${control.componentName}.${control.name}:`, err);
    }
  }

  /**
   * Handle control position change (for knobs, sliders, etc.)
   * Override this if you need custom handling
   */
  protected async handlePositionChange(control: ControlInfo, position: number): Promise<void> {
    if (!control.componentName) {
      console.error('Control missing componentName:', control);
      return;
    }

    try {
      await this.qsysService.setControlPosition(control.componentName, control.name, position);
    } catch (err) {
      console.error(`Failed to set position ${control.componentName}.${control.name}:`, err);
    }
  }
}
