import { Injectable, signal, computed, inject, effect } from '@angular/core';
import { IControlState } from '@q-sys/qrwc';
import { QSysService } from '../../../services/qsys.service';

/**
 * Simple Component wrapper that mimics QRWC's Component interface
 * but uses direct RPC calls to fetch and update controls
 */
class ComponentWrapper {
  public controls: Record<string, ControlWrapper> = {};

  constructor(
    public name: string,
    private webSocketManager: any,
    private changeGroup: any
  ) {}

  async initialize(qsysService: QSysService): Promise<void> {
    try {
      console.log(`Fetching controls for component: ${this.name}`);

      // Use QSysService's existing method to fetch controls
      const controlsList = await qsysService.getComponentControls(this.name);

      if (!controlsList || controlsList.length === 0) {
        throw new Error(`No controls found for component: ${this.name}`);
      }

      console.log(`Retrieved ${controlsList.length} controls for ${this.name}`);

      // Create control wrappers for each control
      for (const controlData of controlsList) {
        const control = new ControlWrapper(
          controlData.name,
          this.name,
          controlData,
          this.webSocketManager,
          this.changeGroup
        );
        this.controls[controlData.name] = control;
      }

      // Register all controls with the ChangeGroup for automatic updates
      await this.registerWithChangeGroup();
      console.log(`Registered ${Object.keys(this.controls).length} controls with ChangeGroup for ${this.name}`);
    } catch (error) {
      console.error(`Failed to initialize component ${this.name}:`, error);
      throw error;
    }
  }

  private async registerWithChangeGroup(): Promise<void> {
    const controlsToRegister = Object.keys(this.controls).map(name => ({ Name: name }));

    await this.webSocketManager.sendRpc('ChangeGroup.AddComponentControl', {
      Id: this.changeGroup.id,
      Component: {
        Name: this.name,
        Controls: controlsToRegister
      }
    });
  }
}

/**
 * Simple Control wrapper that mimics QRWC's Control interface
 */
class ControlWrapper {
  public state: IControlState;
  private updateListeners: Array<(state: IControlState) => void> = [];

  constructor(
    public name: string,
    private componentName: string,
    initialState: any,
    private webSocketManager: any,
    private changeGroup: any
  ) {
    this.state = this.normalizeState(initialState);
    this.setupChangeGroupListener();
  }

  private normalizeState(rawState: any): IControlState {
    // Handle both QSysService format (lowercase) and RPC format (PascalCase)
    const value = rawState.value ?? rawState.Value;
    return {
      Name: rawState.name || rawState.Name || this.name,
      Type: rawState.type || rawState.Type || '',
      Direction: rawState.direction || rawState.Direction || 'Read/Write',
      String: rawState.string ?? rawState.String,
      Value: value,
      Position: rawState.position ?? rawState.Position,
      Choices: rawState.choices ?? rawState.Choices,
      Bool: value === 1 || value === true,
    };
  }

  private setupChangeGroupListener(): void {
    // Listen for updates from the ChangeGroup using QRWC's subscribe method
    const key = `${this.componentName}:${this.name}`;

    // QRWC's ChangeGroup has a 'register' Map for callbacks
    // We need to register our callback so it gets called during polling
    if (!this.changeGroup.register) {
      this.changeGroup.register = new Map();
    }

    // Register callback that will be invoked when this control changes
    this.changeGroup.register.set(key, (change: any) => {
      // Update our state
      this.state = this.normalizeState(change);
      // Notify all our listeners
      this.updateListeners.forEach(listener => listener(this.state));
    });
  }

  on(event: 'update', callback: (state: IControlState) => void): void {
    if (event === 'update') {
      this.updateListeners.push(callback);
    }
  }

  async set(value: any): Promise<void> {
    await this.webSocketManager.sendRpc('Component.Set', {
      Name: this.componentName,
      Controls: [{ Name: this.name, Value: value }]
    });
  }

  async setPosition(position: number): Promise<void> {
    await this.webSocketManager.sendRpc('Component.Set', {
      Name: this.componentName,
      Controls: [{ Name: this.name, Position: position }]
    });
  }

  // Alias for set() to match QRWC Control interface
  async update(value: any): Promise<void> {
    await this.set(value);
  }
}

/**
 * Adapter service that bridges the component browser's QsysService
 * with the interface expected by the room customisation components.
 *
 * This allows room components to work with the existing QsysService
 * instead of requiring a separate QrwcAngularService.
 */
@Injectable()
export class QrwcAdapterService {
  private qsysService = inject(QSysService);
  private loadedComponents = signal<Record<string, ComponentWrapper>>({});
  private availableComponentNames = signal<string[]>([]);
  private isLoading = false;
  private componentsReady = signal(false);

  // List of required Q-SYS components for the room controls
  public readonly requiredComponents = [
    'Room Controls',
    'UCI Text Helper',
  ];

  // List of optional components that enable features if present
  public readonly optionalComponents = [
    'HDMISourceSelect_1',
    'USB Video Bridge Core',
  ];

  // Signal to track if we're connected to Q-SYS and components are loaded
  public readonly initialised = computed(() => {
    return this.qsysService.isConnected() && this.componentsReady();
  });

  // Signal to store the current connection IP address
  public readonly connectionIpAddress = signal<string>('');

  // Components map (mimics QrwcAngularService interface)
  public readonly components = computed(() => {
    return this.loadedComponents();
  });

  // Computed signal that returns list of missing required components
  public readonly missingComponents = computed(() => {
    if (!this.initialised()) return [];

    const available = this.availableComponentNames();
    return this.requiredComponents.filter(name => !available.includes(name));
  });

  // Signal to check if video source selection is available
  public readonly hasVideoSourceSelection = computed(() => {
    const loaded = this.components();
    return loaded && !!loaded['HDMISourceSelect_1'];
  });

  // Signal to check if camera controls are available
  public readonly hasCameraControls = computed(() => {
    const loaded = this.components();
    return loaded && !!loaded['USB Video Bridge Core'];
  });

  constructor() {
    // Update connection IP address from QSysService
    effect(() => {
      const options = (this.qsysService as any).options;
      if (options?.coreIp) {
        this.connectionIpAddress.set(options.coreIp);
      }
    });

    // When connected, load the required components
    effect(() => {
      if (this.qsysService.isConnected() && !this.isLoading) {
        this.loadRequiredComponents();
      }
    });
  }

  /**
   * Load the required components from Q-SYS using ComponentWrapper
   */
  private async loadRequiredComponents(): Promise<void> {
    // Prevent multiple simultaneous loads
    if (this.isLoading) {
      console.log('Components already loading, skipping...');
      return;
    }

    this.isLoading = true;

    try {
      const qrwc = (this.qsysService as any).qrwc;
      if (!qrwc) {
        console.error('QRWC instance not available');
        this.isLoading = false;
        return;
      }

      // Ensure components are fetched - this populates the cache
      let cachedComponents = this.qsysService.getCachedComponents();
      if (cachedComponents.length === 0) {
        console.log('Fetching components from Q-SYS Core...');
        cachedComponents = await this.qsysService.getComponents();
      }

      const componentNames = cachedComponents.map(c => c.name);
      this.availableComponentNames.set(componentNames);

      console.log('Loading room control components...');
      const components: Record<string, ComponentWrapper> = {};

      // Access QRWC internals
      const webSocketManager = (qrwc as any).webSocketManager;
      const changeGroup = (qrwc as any).changeGroup;

      // Load required and optional components
      const allComponentsToLoad = [...this.requiredComponents, ...this.optionalComponents];

      for (const componentName of allComponentsToLoad) {
        const isRequired = this.requiredComponents.includes(componentName);

        if (componentNames.includes(componentName)) {
          try {
            // Create and initialize component wrapper
            const component = new ComponentWrapper(
              componentName,
              webSocketManager,
              changeGroup
            );
            await component.initialize(this.qsysService);

            components[componentName] = component;
            console.log(`✓ Loaded component: ${componentName}`);
          } catch (error) {
            if (isRequired) {
              console.warn(`Failed to load required component ${componentName}:`, error);
            } else {
              console.log(`Optional component ${componentName} not loaded:`, error);
            }
          }
        } else {
          if (isRequired) {
            console.warn(`Required component not found in Q-SYS design: ${componentName}`);
          } else {
            console.log(`Optional component not found in Q-SYS design: ${componentName}`);
          }
        }
      }

      this.loadedComponents.set(components);
      this.componentsReady.set(true);
      console.log(`Room controls: Loaded ${Object.keys(components).length} of ${this.requiredComponents.length} required components`);
    } catch (error) {
      console.error('Failed to load room control components:', error);
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Get a computed signal for a specific component by name.
   * Returns null if the component doesn't exist.
   */
  public getComputedComponent(componentName: string) {
    return computed(() => {
      if (!this.initialised()) {
        return null;
      }

      return this.components()[componentName] ?? null;
    });
  }
}
