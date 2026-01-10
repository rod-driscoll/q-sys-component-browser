import { Injectable, signal, computed, inject, effect } from '@angular/core';
import { IControlState } from '@q-sys/qrwc';
import { QSysService } from '../../../services/qsys.service';

/**
 * Simple Component wrapper that mimics QRWC's Component interface
 * but uses direct RPC calls to fetch and update controls
 */
class ComponentWrapper {
  public controls: Record<string, ControlWrapper> = {};
  private qsysService?: QSysService;

  constructor(
    public name: string,
    private webSocketManager: any,
    private changeGroup: any
  ) {}

  async initialize(qsysService: QSysService): Promise<void> {
    try {
      this.qsysService = qsysService;
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
          qsysService
        );
        this.controls[controlData.name] = control;
      }

      // Register all controls with the ChangeGroup for automatic updates
      await this.registerWithChangeGroup();

      // Ensure ChangeGroup polling is started (needed for control updates)
      await this.ensureChangeGroupPolling();

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

  /**
   * Re-register this component's controls with the ChangeGroup
   * Called after reconnection when a new ChangeGroup is created
   */
  async reregisterWithChangeGroup(newWebSocketManager: any, newChangeGroup: any): Promise<void> {
    console.log(`Re-registering component ${this.name} with new ChangeGroup ${newChangeGroup.id}`);

    // Update references to new WebSocket manager and ChangeGroup
    this.webSocketManager = newWebSocketManager;
    this.changeGroup = newChangeGroup;

    // Re-register all controls with the new ChangeGroup
    await this.registerWithChangeGroup();

    // Update all control wrappers with new WebSocket manager
    for (const controlName in this.controls) {
      const control = this.controls[controlName];
      (control as any).webSocketManager = newWebSocketManager;
    }

    console.log(`Re-registered ${Object.keys(this.controls).length} controls for ${this.name}`);
  }

  private async ensureChangeGroupPolling(): Promise<void> {
    if (!this.qsysService) {
      console.warn('Cannot ensure ChangeGroup polling - no QSysService reference');
      return;
    }

    // Use QSysService's method to ensure polling is started and intercepted
    await (this.qsysService as any).ensureChangeGroupPollingAndInterception();
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
    private qsysService: QSysService
  ) {
    this.state = this.normalizeState(initialState);
    this.setupControlUpdateListener();
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

  private setupControlUpdateListener(): void {
    // Subscribe to QSysService's control updates observable
    // This receives updates from the ChangeGroup polling that QSysService intercepts
    this.qsysService.getControlUpdates().subscribe(update => {
      // Check if this update is for our control
      if (update.component === this.componentName && update.control === this.name) {
        // Update our state with the new values
        this.state = {
          ...this.state,
          Value: update.value,
          Position: update.position ?? this.state.Position,
          String: update.string ?? this.state.String,
          Bool: update.Bool ?? (update.value === 1 || update.value === true),
        };
        // Notify all our listeners
        this.updateListeners.forEach(listener => listener(this.state));
      }
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
    'CameraRouter',
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

  // Signal to check if ONVIF cameras are available
  public readonly hasOnvifCameras = computed(() => {
    const loaded = this.components();
    if (!loaded) {
      console.log('[QrwcAdapterService] hasOnvifCameras: No components loaded yet');
      return false;
    }

    console.log('[QrwcAdapterService] Checking for ONVIF cameras...', {
      componentCount: Object.keys(loaded).length,
      componentNames: Object.keys(loaded)
    });

    // Check if any component has type 'onvif_camera_operative'
    for (const componentName in loaded) {
      const component = loaded[componentName];
      const componentType = (component as any).type;
      console.log(`[QrwcAdapterService] Component: ${componentName}, type: ${componentType}`);
      if (componentType === 'onvif_camera_operative') {
        console.log(`[QrwcAdapterService] ✓ Found ONVIF camera: ${componentName}`);
        return true;
      }
    }
    console.log('[QrwcAdapterService] No ONVIF cameras found');
    return false;
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

    // Register callback for ChangeGroup changes
    // This is more reliable than using an effect because it's called synchronously
    this.qsysService.onChangeGroupChanged(async () => {
      const reconnectionCount = this.qsysService.reconnectionCount();
      console.log(`Detected reconnection #${reconnectionCount}, re-registering all components...`);
      await this.reregisterAllComponents();
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

      // Also discover and load all ONVIF camera components
      console.log('Discovering ONVIF camera components...');
      for (const cachedComponent of cachedComponents) {
        if (cachedComponent.type === 'onvif_camera_operative' && !components[cachedComponent.name]) {
          try {
            console.log(`Found ONVIF camera: ${cachedComponent.name}, loading...`);
            const component = new ComponentWrapper(
              cachedComponent.name,
              webSocketManager,
              changeGroup
            );
            await component.initialize(this.qsysService);
            components[cachedComponent.name] = component;
            console.log(`✓ Loaded ONVIF camera: ${cachedComponent.name}`);
          } catch (error) {
            console.warn(`Failed to load ONVIF camera ${cachedComponent.name}:`, error);
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
   * Re-register all loaded components with the new ChangeGroup after reconnection
   */
  private async reregisterAllComponents(): Promise<void> {
    try {
      const qrwc = (this.qsysService as any).qrwc;
      if (!qrwc) {
        console.error('QRWC instance not available for re-registration');
        return;
      }

      const webSocketManager = (qrwc as any).webSocketManager;
      const changeGroup = (qrwc as any).changeGroup;

      const components = this.loadedComponents();
      const componentNames = Object.keys(components);

      if (componentNames.length === 0) {
        console.log('No components to re-register');
        return;
      }

      console.log(`Re-registering ${componentNames.length} components with new ChangeGroup ${changeGroup.id}...`);

      // Re-register each component with the new ChangeGroup
      for (const componentName of componentNames) {
        const component = components[componentName];
        try {
          await component.reregisterWithChangeGroup(webSocketManager, changeGroup);
        } catch (error) {
          console.error(`Failed to re-register component ${componentName}:`, error);
        }
      }

      // Ensure poll interceptor is set up for the new ChangeGroup
      await (this.qsysService as any).ensureChangeGroupPollingAndInterception();

      console.log('✓ All components re-registered with new ChangeGroup');
    } catch (error) {
      console.error('Failed to re-register components:', error);
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
