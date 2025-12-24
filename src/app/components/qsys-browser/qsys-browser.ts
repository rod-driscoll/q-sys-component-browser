import { Component, OnInit, OnDestroy, computed, effect, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { QSysService } from '../../services/qsys.service';
import { QSysBrowserService, ComponentInfo, ControlInfo } from '../../services/qsys-browser.service';
import { LuaScriptService, LuaScript } from '../../services/lua-script.service';
import { WebSocketDiscoveryService } from '../../services/websocket-discovery.service';
import { environment } from '../../../environments/environment';
import { BooleanControl } from './controls/boolean-control/boolean-control';
import { KnobControl } from './controls/knob-control/knob-control';
import { NumericControl } from './controls/numeric-control/numeric-control';
import { ComboControl } from './controls/combo-control/combo-control';
import { TextControl } from './controls/text-control/text-control';
import { StatusControl } from './controls/status-control/status-control';
import { StateTriggerControl } from './controls/state-trigger-control/state-trigger-control';
import { TimeControl } from './controls/time-control/time-control';
import { TriggerControl } from './controls/trigger-control/trigger-control';

@Component({
  selector: 'app-qsys-browser',
  imports: [
    CommonModule,
    FormsModule,
    BooleanControl,
    KnobControl,
    NumericControl,
    ComboControl,
    TextControl,
    StatusControl,
    StateTriggerControl,
    TimeControl,
    TriggerControl,
  ],
  templateUrl: './qsys-browser.html',
  styleUrl: './qsys-browser.css',
})
export class QsysBrowser implements OnInit, OnDestroy {
  // Search/filter
  searchTerm = '';
  controlSearchTerm = '';
  selectedTypeFilter = 'all';
  selectedControlTypeFilter = 'all';
  globalSearchTerm = '';
  globalSearchTypeFilter = 'all';
  private searchTimeout: any;

  // For control editing
  editValue: any = null;

  // For Time control editing (segmented input)
  timeHours: string = '';
  timeMinutes: string = '';
  timeSeconds: string = '';

  // Track if user is dragging a slider to prevent feedback updates
  isDragging = false;
  draggingControlName: string | null = null;
  dragEndTimeout: any = null;

  // Track expanded controls
  expandedControls = new Set<string>();

  // Loading states
  isLoadingComponents = false;
  isLoadingControls = false;
  private lastProcessedDiscoveryTimestamp: string | null = null;

  // Connection details
  coreIp = environment.QSYS_CORE_IP;
  corePlatform = '';
  coreState = '';
  designName = '';

  // Log history tracking
  logHistory: string[] = [];
  private lastLogEntry: string = '';
  private controlUpdateSubscription: any;

  constructor(
    protected qsysService: QSysService,
    protected browserService: QSysBrowserService,
    protected luaScriptService: LuaScriptService,
    protected wsDiscoveryService: WebSocketDiscoveryService
  ) {
    // Watch for WebSocket discovery data and process it
    effect(() => {
      const discoveryData = this.wsDiscoveryService.discoveryData();
      if (discoveryData && discoveryData.timestamp !== this.lastProcessedDiscoveryTimestamp) {
        this.processWebSocketDiscoveryData(discoveryData);
        this.lastProcessedDiscoveryTimestamp = discoveryData.timestamp;
      }
    });

    // Watch for component updates and update controls
    effect(() => {
      const update = this.wsDiscoveryService.componentUpdate();
      if (update) {
        this.handleComponentUpdate(update);
      }
    });
  }

  // Connection state
  get isConnected() {
    return this.qsysService.isConnected;
  }

  // Helper method to test if a string matches a pattern (supports regex)
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

  // Get available component types
  get availableTypes(): string[] {
    const components = this.browserService.components();
    const types = new Set(components.map(c => c.type));
    const sortedTypes = Array.from(types).sort();

    // Add "plugins" option if there are any plugin components
    const hasPlugins = components.some(c => c.type.startsWith('%PLUGIN%'));
    if (hasPlugins) {
      return ['all', 'plugins', ...sortedTypes];
    }

    return ['all', ...sortedTypes];
  }

  // Get available control types
  get availableControlTypes(): string[] {
    const controls = this.browserService.controls();
    const types = new Set(controls.map(c => c.type));
    return ['all', ...Array.from(types).sort()];
  }

  // Filtered component list
  get filteredComponents(): ComponentInfo[] {
    let components = this.browserService.components();

    // Filter by type
    if (this.selectedTypeFilter !== 'all') {
      if (this.selectedTypeFilter === 'plugins') {
        // Show all plugin components
        components = components.filter(c => c.type.startsWith('%PLUGIN%'));
      } else {
        components = components.filter(c => c.type === this.selectedTypeFilter);
      }
    }

    // Filter by search term (supports regex)
    if (this.searchTerm) {
      components = components.filter((c) => this.matchesPattern(c.name, this.searchTerm));
    }

    return components;
  }

  // Filtered control list
  get filteredControls(): ControlInfo[] {
    let controls = this.browserService.controls();

    // Filter by type
    if (this.selectedControlTypeFilter !== 'all') {
      controls = controls.filter(c => c.type === this.selectedControlTypeFilter);
    }

    // Filter by search term (supports regex)
    if (this.controlSearchTerm) {
      controls = controls.filter((c) => this.matchesPattern(c.name, this.controlSearchTerm));
    }

    return controls;
  }

  // Certificate error notification
  showCertificateErrorNotification = signal<boolean>(false);
  certificateUrl = `https://${environment.QSYS_CORE_IP}`;

  showCertificateError(): void {
    this.showCertificateErrorNotification.set(true);
    console.error('SSL Certificate Error: Please accept the Q-SYS Core certificate');
  }

  dismissCertificateError(): void {
    this.showCertificateErrorNotification.set(false);
  }

  openCertificateUrl(): void {
    window.open(this.certificateUrl, '_blank');
  }

  // Current view
  get currentView(): 'components' | 'controls' | 'editor' {
    if (this.browserService.selectedControl()) return 'editor';
    if (this.browserService.selectedComponent()) return 'controls';
    return 'components';
  }

  ngOnInit(): void {
    // Connect to Q-SYS Core
    this.qsysService.connect({
      coreIp: environment.QSYS_CORE_IP,
      secure: true,
      pollInterval: 35,
    }).catch((error) => {
      // Check if this is a certificate error
      const isCertError = error?.message?.includes('certificate') ||
        error?.type === 'error' ||
        error?.toString().includes('ERR_CERT');

      if (isCertError) {
        this.showCertificateError();
      }
    });

    // Wait for connection before loading components
    this.qsysService.getConnectionStatus().subscribe(async (connected) => {
      if (connected) {
        // Don't enable polling yet - ChangeGroup doesn't exist until controls are added
        // Polling will be enabled when you select a component and add controls
        console.log('Connected - loading components from Q-SYS Core...');

        // Load Core status to get platform, state, and design name
        try {
          const status = this.qsysService.getCoreStatus();
          this.corePlatform = status.platform;
          this.coreState = status.state;
          this.designName = status.designName;
          console.log(`Core: ${status.platform} (${status.state}) - Design: ${status.designName}`);
        } catch (error) {
          console.error('Failed to load Core status:', error);
        }

        this.loadComponents();
      }
    });

    // Subscribe to control updates to track log.history for the currently selected component
    this.controlUpdateSubscription = this.qsysService.getControlUpdates()
      .subscribe((update) => {
        const selectedComponent = this.browserService.selectedComponent();
        const selectedControl = this.browserService.selectedControl();

        // Only process updates for the currently selected component
        if (selectedComponent && update.component === selectedComponent.name) {
          // Handle log.history updates
          if (update.control === 'log.history' && update.string) {
            this.appendLogEntry(update.string);
          }

          // Update the selected control's value in editor view
          if (selectedControl && update.control === selectedControl.name) {
            // Update the control object with new values
            selectedControl.value = update.value;
            selectedControl.position = update.position;
            selectedControl.string = update.string;

            // Trigger change detection by creating a new reference
            this.browserService.selectedControl.set({ ...selectedControl });
          }

          // Also update the control in the controls list
          const controls = this.browserService.controls();
          const controlIndex = controls.findIndex(c => c.name === update.control);
          if (controlIndex !== -1) {
            const updatedControls = [...controls];
            updatedControls[controlIndex] = {
              ...updatedControls[controlIndex],
              value: update.value,
              position: update.position,
              string: update.string
            };
            this.browserService.controls.set(updatedControls);
          }
        }
      });
  }

  ngOnDestroy(): void {
    if (this.controlUpdateSubscription) {
      this.controlUpdateSubscription.unsubscribe();
    }
    this.qsysService.disconnect();
    this.wsDiscoveryService.disconnect();
  }

  // Load all components from Q-SYS Core via QRWC
  async loadComponents(refresh: boolean = false): Promise<void> {
    this.isLoadingComponents = true;
    try {
      console.log(refresh ? 'Refreshing component list from Q-SYS...' : 'Fetching component list from Q-SYS...');

      // If refreshing, use the refreshComponentCounts method to give QRWC more time
      const components = refresh
        ? await this.qsysService.refreshComponentCounts()
        : await this.qsysService.getComponents();

      // Transform QRWC response to our ComponentInfo format
      // Now includes actual control counts from qrwc.components
      const componentList: ComponentInfo[] = components.map((comp: any) => ({
        name: comp.name,
        type: comp.type,
        controlCount: comp.controlCount,
        discoveryMethod: 'qrwc' as const,
      }));

      this.browserService.setComponents(componentList);
      console.log(`✓ Loaded ${componentList.length} components`);
    } catch (error) {
      console.error('Failed to load components:', error);
    } finally {
      this.isLoadingComponents = false;
    }
  }

  // Refresh component control counts
  async refreshComponents(): Promise<void> {
    await this.loadComponents(true);
  }

  // Load components via WebSocket discovery endpoint
  loadComponentsViaWebSocket(): void {
    console.log('Requesting component discovery via WebSocket...');
    this.isLoadingComponents = true;
    this.wsDiscoveryService.connect();
    this.wsDiscoveryService.connectUpdates();
  }

  // Process WebSocket discovery data
  private processWebSocketDiscoveryData(discoveryData: any): void {
    console.log('Processing WebSocket discovery data...');

    try {
      // Get existing components (from QRWC)
      const existingComponents = this.browserService.components();
      const existingComponentNames = new Set(existingComponents.map(c => c.name));

      // Convert WebSocket data to ComponentInfo format, but only for components not already in QRWC
      const wsComponents: ComponentInfo[] = discoveryData.components
        .filter((comp: any) => !existingComponentNames.has(comp.name))
        .map((comp: any) => ({
          name: comp.name,
          type: comp.type,
          controlCount: comp.controlCount || 0,
          discoveryMethod: 'websocket' as const,
        }));

      console.log(`Found ${discoveryData.components.length} components via WebSocket, ${wsComponents.length} are new (not in QRWC)`);

      // Merge QRWC components (priority) with new WebSocket-only components
      const mergedComponents = [...existingComponents, ...wsComponents];

      this.browserService.setComponents(mergedComponents);
      console.log(`✓ Total components: ${mergedComponents.length} (${existingComponents.length} QRWC + ${wsComponents.length} WebSocket)`);

      this.isLoadingComponents = false;
    } catch (error) {
      console.error('Failed to process WebSocket discovery data:', error);
      this.isLoadingComponents = false;
    }
  }

  // Handle component update from WebSocket
  private handleComponentUpdate(update: any): void {
    const selectedComponent = this.browserService.selectedComponent();

    // Only update if this is the currently selected component
    if (selectedComponent && selectedComponent.name === update.componentName) {
      console.log(`Updating controls for: ${update.componentName}`);
      this.browserService.setControls(update.controls);
    }
  }

  // Fetch controls via HTTP API (for WebSocket-discovered components)
  private async fetchControlsViaHTTP(componentName: string): Promise<any[]> {
    const url = `${environment.QSYS_HTTP_API_URL}/components/${encodeURIComponent(componentName)}/controls`;
    const response = await fetch(url);

    if (!response.ok) {
      // Try to get error details from response
      let errorDetails = `HTTP ${response.status}: ${response.statusText}`;
      try {
        const errorData = await response.json();
        if (errorData.error) {
          errorDetails += ` - ${errorData.error}`;
        }
      } catch (e) {
        // Response wasn't JSON, use status text
      }
      throw new Error(errorDetails);
    }

    const data = await response.json();

    // Debug: Check for DisplaysComponentID control
    const displayControl = data.controls?.find((c: any) => c.name === 'DisplaysComponentID');
    if (displayControl) {
      console.log('DisplaysComponentID control:', displayControl);
      console.log('  Type:', displayControl.type);
      console.log('  Choices:', displayControl.choices);
    }

    return data.controls || [];
  }

  // Select a component and load its controls from Q-SYS Core
  async selectComponent(component: ComponentInfo): Promise<void> {
    await this.browserService.selectComponent(component);
    this.controlSearchTerm = '';
    this.isLoadingControls = true;
    console.log('Loading controls for:', component.name);

    try {
      let controls;

      // If component was discovered via WebSocket, use HTTP API exclusively
      if (component.discoveryMethod === 'websocket') {
        console.log(`WebSocket-discovered component, fetching controls via HTTP API...`);
        controls = await this.fetchControlsViaHTTP(component.name);
      } else {
        // For QRWC-discovered components, try QRWC first
        try {
          controls = await this.qsysService.getComponentControls(component.name);
        } catch (error: any) {
          // Fallback to HTTP API if QRWC fails
          if (error.message?.includes('not found')) {
            console.log(`Component not in QRWC, fetching controls via HTTP API...`);
            controls = await this.fetchControlsViaHTTP(component.name);
          } else {
            throw error;
          }
        }
      }

      // Transform response to our ControlInfo format
      // Handle both QRWC (capitalized) and HTTP API (lowercase) property names
      const controlList: ControlInfo[] = controls.map((ctrl: any) => ({
        name: ctrl.Name || ctrl.name,
        type: ctrl.Type || ctrl.type || 'Text',
        direction: ctrl.Direction || ctrl.direction || 'Read/Write',
        value: ctrl.Value !== undefined ? ctrl.Value : ctrl.value,
        valueMin: ctrl.ValueMin !== undefined ? ctrl.ValueMin : ctrl.valueMin,
        valueMax: ctrl.ValueMax !== undefined ? ctrl.ValueMax : ctrl.valueMax,
        position: ctrl.Position !== undefined ? ctrl.Position : ctrl.position,
        string: ctrl.String !== undefined ? ctrl.String : ctrl.string,
        choices: ctrl.Choices || ctrl.choices,
        stringMin: ctrl.StringMin || ctrl.stringMin,
        stringMax: ctrl.StringMax || ctrl.stringMax,
      }));

      this.browserService.setControls(controlList);
      console.log(`✓ Loaded ${controlList.length} controls for ${component.name}`);

      // Subscribe to component-level event listeners for live updates (only for QRWC components)
      if (component.discoveryMethod === 'qrwc') {
        try {
          this.qsysService.subscribeToComponent(component.name);
        } catch (error) {
          console.log('Failed to subscribe to QRWC component updates:', error);
        }
      } else {
        console.log('Skipping QRWC subscription (WebSocket-discovered component)');
      }

      // Listen for control updates
      this.qsysService.getControlUpdates().subscribe((update) => {
        // Update the control in the browser service
        const currentControls = this.browserService.controls();
        const updatedControls = currentControls.map((ctrl) => {
          if (ctrl.name === update.control) {
            // If user is dragging this control, only update value/string but NOT position
            if (this.isDragging && this.draggingControlName === update.control) {
              return {
                ...ctrl,
                value: update.value,
                string: update.string,
                // Keep existing position (don't update slider while dragging)
              };
            }
            // Normal update: update everything
            return {
              ...ctrl,
              value: update.value,
              position: update.position,
              string: update.string,
            };
          }
          return ctrl;
        });
        this.browserService.setControls(updatedControls);

        // Also update global search results if they contain this control
        const globalResults = this.browserService.globalSearchResults();
        if (globalResults.length > 0) {
          const updatedGlobalResults = globalResults.map((ctrl) => {
            // Match by control name AND component name from the update
            if (ctrl.name === update.control && ctrl.componentName === update.component) {
              // If user is dragging this control, only update value/string but NOT position
              if (this.isDragging && this.draggingControlName === update.control) {
                return {
                  ...ctrl,
                  value: update.value,
                  string: update.string,
                  // Keep existing position (don't update slider while dragging)
                };
              }
              // Normal update: update everything
              return {
                ...ctrl,
                value: update.value,
                position: update.position,
                string: update.string,
              };
            }
            return ctrl;
          });
          this.browserService.globalSearchResults.set(updatedGlobalResults);
        }

        // If this is the currently selected control, update the edit value
        const selectedControl = this.browserService.selectedControl();
        if (selectedControl && selectedControl.name === update.control) {
          // Don't update editValue if user is currently dragging a slider
          if (this.isDragging) {
            return;
          }
          // For combo boxes, use string value to match choices
          if (selectedControl.type === 'Combo box') {
            this.editValue = update.string ?? '';
          } else if (selectedControl.type === 'Text') {
            // For text controls, use string value
            this.editValue = update.string ?? '';
          } else if (selectedControl.type === 'Knob') {
            // For knobs, use position (0-1) for slider control
            this.editValue = update.position ?? 0;
          } else if (selectedControl.type === 'Time') {
            // For time controls, parse the value (in seconds) into hh:mm:ss segments
            const totalSeconds = update.value ?? 0;
            const hours = Math.floor(totalSeconds / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            const seconds = Math.floor(totalSeconds % 60);

            this.timeHours = String(hours).padStart(2, '0');
            this.timeMinutes = String(minutes).padStart(2, '0');
            this.timeSeconds = String(seconds).padStart(2, '0');
            this.editValue = totalSeconds;
          } else {
            this.editValue = update.value ?? update.position ?? update.string ?? '';
          }
        }
      });
    } catch (error) {
      console.error('Failed to load controls:', error);
    } finally {
      this.isLoadingControls = false;
    }
  }

  // Handle control item click - navigate to editor
  onControlClick(control: ControlInfo, event: MouseEvent): void {
    //console.log('Control clicked:', control);
    this.selectControl(control);
  }

  // Select a control for editing (opens dedicated editor view)
  selectControl(control: ControlInfo): void {
    this.browserService.selectControl(control);
    this.isDragging = false; // Reset drag state

    // If selecting the 'code' control, initialize log history from current log.history value
    if (control.name?.toLowerCase() === 'code') {
      this.initializeLogHistory();
    }

    // For Lua script management (Text/Code controls), we still use editValue
    // For other controls (Knob, Time, Combo, etc.), components handle their own state
    if (control.type === 'Text' || control.name?.toLowerCase() === 'code') {
      this.editValue = control.string ?? '';
    } else {
      this.editValue = null;
    }

    // Reset time segments
    this.timeHours = '';
    this.timeMinutes = '';
    this.timeSeconds = '';
  }

  // Get status color class based on Q-SYS status value
  getStatusColorClass(): string {
    const value = this.editValue;
    switch (Number(value)) {
      case 0: return 'status-green';      // OK
      case 1: return 'status-orange';     // Compromised
      case 2: return 'status-red';        // Fault
      case 3: return 'status-grey';       // Not Present
      case 4: return 'status-red';        // Missing
      case 5: return 'status-blue';       // Initializing
      default: return 'status-grey';
    }
  }

  // Get status color class for a control in the control list
  getStatusColorClassForControl(control: ControlInfo): string {
    const value = control.value;
    switch (Number(value)) {
      case 0: return 'status-green';      // OK
      case 1: return 'status-orange';     // Compromised
      case 2: return 'status-red';        // Fault
      case 3: return 'status-grey';       // Not Present
      case 4: return 'status-red';        // Missing
      case 5: return 'status-blue';       // Initializing
      default: return 'status-grey';
    }
  }

  // Navigation
  backToComponents(): void {
    // Unsubscribe from component when navigating away
    this.qsysService.unsubscribeFromComponent();
    this.browserService.backToComponents();
    this.searchTerm = '';
  }

  backToControls(): void {
    this.browserService.backToControls();
  }

  // Unified Control Interaction Methods
  // These methods work for all views: global search, control list, and editor

  /**
   * Unified method to handle value changes for any control
   * Automatically determines the correct component and discovery method
   */
  async handleControlValueChange(control: ControlInfo, value: any): Promise<void> {
    console.log('handleControlValueChange called with:', control, value);
    const componentName = control.componentName || this.browserService.selectedComponent()?.name;
    if (!componentName) {
      console.error('Cannot update control: no component name available');
      return;
    }

    // Find the component to check discovery method
    const component = control.componentName
      ? this.browserService.components().find(c => c.name === componentName)
      : this.browserService.selectedComponent();

    console.log(`Control value change: ${componentName}.${control.name} = ${value}`);

    try {
      if (component?.discoveryMethod === 'websocket') {
        await this.qsysService.setControlViaHTTP(componentName, control.name, value);
      } else {
        await this.qsysService.setControl(componentName, control.name, value);
      }
    } catch (error) {
      console.error('Failed to set control:', error);
    }
  }

  /**
   * Unified method to handle position changes for slider controls
   * Handles both Knob controls (use position API) and Float/Integer controls (convert to value)
   */
  async handleControlPositionChange(control: ControlInfo, position: number): Promise<void> {
    const componentName = control.componentName || this.browserService.selectedComponent()?.name;
    if (!componentName) {
      console.error('Cannot update control: no component name available');
      return;
    }

    // Find the component to check discovery method
    const component = control.componentName
      ? this.browserService.components().find(c => c.name === componentName)
      : this.browserService.selectedComponent();

    // For Float/Integer controls, convert position (0-1) to value in range
    if (control.type === 'Float' || control.type === 'Integer') {
      const valueMin = control.valueMin ?? 0;
      const valueMax = control.valueMax ?? 1;
      const value = valueMin + (position * (valueMax - valueMin));

      console.log(`Control position change (${control.type}): ${componentName}.${control.name} position=${position} -> value=${value}`);

      // Use value-based API for Float/Integer
      await this.handleControlValueChange(control, value);
      return;
    }

    // For Knob controls, use position-based API
    console.log(`Control position change (Knob): ${componentName}.${control.name} = ${position}`);

    try {
      if (component?.discoveryMethod === 'websocket') {
        console.warn("Position updates via HTTP not implemented yet");
      } else {
        await this.qsysService.setControlPosition(componentName, control.name, position);
      }
    } catch (error) {
      console.error('Failed to set control position:', error);
    }
  }

  /**
   * Unified method to handle trigger controls
   */
  async handleControlTrigger(control: ControlInfo): Promise<void> {
    await this.handleControlValueChange(control, 1);
  }

  // Drag state management for sliders
  onInlineSliderDragStart(control: ControlInfo): void {
    // Clear any pending drag end timeout
    if (this.dragEndTimeout) {
      clearTimeout(this.dragEndTimeout);
      this.dragEndTimeout = null;
    }
    console.log('Inline slider drag start:', control);
    this.isDragging = true;
    this.draggingControlName = control.name;
  }

  onInlineSliderDragEnd(): void {
    // Add a small delay before resuming feedback to allow in-flight updates to settle
    console.log('Inline slider drag end:');
    this.dragEndTimeout = setTimeout(() => {
      this.isDragging = false;
      this.draggingControlName = null;
      this.dragEndTimeout = null;
      console.log('Inline slider dragEndTimeout');
    }, 500); // 500ms delay
  }

  // Global search methods
  onGlobalSearchChange(): void {
    // Clear existing timeout
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }

    // Debounce search - wait 300ms after user stops typing
    this.searchTimeout = setTimeout(() => {
      this.performGlobalSearch();
    }, 300);
  }

  async performGlobalSearch(): Promise<void> {
    if (!this.globalSearchTerm || this.globalSearchTerm.trim() === '') {
      this.browserService.clearGlobalSearch();
      return;
    }

    this.isLoadingComponents = true;
    try {
      await this.browserService.searchGlobalControls(this.globalSearchTerm);
    } catch (error) {
      console.error('Global search failed:', error);
    } finally {
      this.isLoadingComponents = false;
    }
  }

  clearGlobalSearch(): void {
    this.globalSearchTerm = '';
    this.browserService.clearGlobalSearch();
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
  }

  // Get global search results
  get globalSearchResults(): ControlInfo[] {
    return this.browserService.globalSearchResults();
  }

  // Get available control types from global search results
  get globalSearchAvailableTypes(): string[] {
    const results = this.browserService.globalSearchResults();
    const types = new Set(results.map(c => c.type));
    return ['all', ...Array.from(types).sort()];
  }

  // Get filtered global search results based on type filter
  get filteredGlobalSearchResults(): ControlInfo[] {
    let results = this.browserService.globalSearchResults();

    if (this.globalSearchTypeFilter !== 'all') {
      results = results.filter(c => c.type === this.globalSearchTypeFilter);
    }

    return results;
  }

  // Check if we're in global search mode
  get isGlobalSearchActive(): boolean {
    return this.browserService.isGlobalSearch();
  }

  // Select a control from global search
  selectControlFromGlobalSearch(control: ControlInfo): void {
    this.browserService.selectControlFromGlobalSearch(control);
  }

  // Helper methods to get time segment values
  private getTimeHoursValue(control: ControlInfo): number {
    const totalSeconds = control.value ?? 0;
    return Math.floor(totalSeconds / 3600);
  }

  private getTimeMinutesValue(control: ControlInfo): number {
    const totalSeconds = control.value ?? 0;
    return Math.floor((totalSeconds % 3600) / 60);
  }

  private getTimeSecondsValue(control: ControlInfo): number {
    const totalSeconds = control.value ?? 0;
    return Math.floor(totalSeconds % 60);
  }

  // Format component type for display (truncate plugin types after 2nd underscore)
  formatComponentType(type: string): string {
    if (!type.startsWith('%PLUGIN%')) {
      return type;
    }

    // Find the second underscore
    const firstUnderscoreIndex = type.indexOf('_');
    if (firstUnderscoreIndex === -1) return type;

    const secondUnderscoreIndex = type.indexOf('_', firstUnderscoreIndex + 1);
    if (secondUnderscoreIndex === -1) return type;

    // Return everything up to (but not including) the second underscore
    return type.substring(0, secondUnderscoreIndex);
  }

  // Lua Script Management Methods

  // Check if the current control is a code control
  isCodeControl(): boolean {
    const control = this.browserService.selectedControl();
    return control?.name?.toLowerCase() === 'code';
  }

  // Get available Lua scripts
  getAvailableLuaScripts(): LuaScript[] {
    return this.luaScriptService.getAvailableScripts();
  }

  // Check if a script is present in the current code
  isScriptPresent(scriptName: string): boolean {
    const codeValue = this.editValue || '';
    return this.luaScriptService.isScriptPresent(codeValue, scriptName);
  }

  // Insert or update a Lua script
  insertLuaScript(script: LuaScript): void {
    const currentCode = this.editValue || '';
    const newCode = this.luaScriptService.insertScript(currentCode, script);
    this.editValue = newCode;
    this.browserService.updateControlValue(newCode, undefined);
  }

  // Remove a Lua script
  removeLuaScript(scriptName: string): void {
    const currentCode = this.editValue || '';
    const newCode = this.luaScriptService.removeScript(currentCode, scriptName);
    this.editValue = newCode;
    this.browserService.updateControlValue(newCode, undefined);
  }

  // Handle text control value change (immediately update editValue for Lua)
  onTextControlValueChange(value: string): void {
    this.editValue = value;
    this.browserService.updateControlValue(value, undefined);
  }

  // Log History Methods

  // Initialize log history from current log.history control value
  private initializeLogHistory(): void {
    const controls = this.browserService.controls();
    const logHistoryControl = controls.find(c => c.name === 'log.history');

    if (logHistoryControl && logHistoryControl.string) {
      // Add the current log.history value if it's not already in the history
      this.appendLogEntry(logHistoryControl.string);
    }
  }

  // Append a new log entry to the history
  private appendLogEntry(entry: string): void {
    if (entry && entry !== this.lastLogEntry) {
      const timestamp = new Date().toLocaleTimeString();
      this.logHistory.push(`[${timestamp}] ${entry}`);
      this.lastLogEntry = entry;
      console.log(`Added log entry: ${entry.substring(0, 100)}${entry.length > 100 ? '...' : ''}`);
    } else if (entry === this.lastLogEntry) {
      console.log(`Skipped duplicate log entry: ${entry.substring(0, 100)}${entry.length > 100 ? '...' : ''}`);
    }
  }

  // Clear log history
  clearLogHistory(): void {
    this.logHistory = [];
    this.lastLogEntry = '';
  }

  // Get log history for display
  getLogHistory(): string[] {
    return this.logHistory;
  }

  // Parse Discovery Results
  parseDiscoveryResults(): void {
    // Look for JSON in log history entries
    for (const entry of this.logHistory) {
      try {
        // Extract JSON from log entry (remove timestamp prefix)
        const jsonMatch = entry.match(/\{[\s\S]*\}/);
        if (!jsonMatch) continue;

        const jsonStr = jsonMatch[0];
        const discoveryData = JSON.parse(jsonStr);

        // Validate this is discovery data
        if (discoveryData.components && Array.isArray(discoveryData.components)) {
          this.processDiscoveryData(discoveryData);
          console.log('Discovery data processed successfully');
          return;
        }
      } catch (error) {
        // Not valid JSON, continue to next entry
        continue;
      }
    }

    console.warn('No valid discovery data found in log history');
  }

  // Process discovery data and add missing components
  private processDiscoveryData(discoveryData: any): void {
    const currentComponents = this.browserService.components();
    const currentComponentNames = new Set(currentComponents.map(c => c.name));

    let addedCount = 0;
    const newComponents = [];

    for (const comp of discoveryData.components) {
      if (!currentComponentNames.has(comp.name)) {
        // This is a new component
        newComponents.push({
          name: comp.name,
          type: comp.type,
          controlCount: comp.controlCount || 0
        });
        addedCount++;
      }
    }

    if (addedCount > 0) {
      // Add new components to the existing list
      const updatedComponents = [...currentComponents, ...newComponents];
      this.browserService.setComponents(updatedComponents);
      console.log(`Added ${addedCount} new components from discovery`);

      // Show success message in log
      const message = `Discovery Complete: Found ${discoveryData.totalComponents} total components, added ${addedCount} new components`;
      this.appendLogEntry(message);
    } else {
      console.log('No new components to add - all discovered components already exist');
      this.appendLogEntry('Discovery Complete: All components already exist in browser');
    }
  }

  // Script Control Methods

  // Trigger a script control (like log.clear)
  triggerScriptControl(controlName: string): void {
    const componentName = this.browserService.selectedComponent()?.name;
    if (componentName) {
      const component = this.browserService.selectedComponent();
      if (component?.discoveryMethod === 'websocket') {
        this.qsysService.setControlViaHTTP(componentName, controlName, 1);
      } else {
        this.qsysService.setControl(componentName, controlName, 1);
      }
      console.log(`Triggered ${controlName}`);
    }
  }

  // Get the value of a script control
  getScriptControlValue(controlName: string): string {
    const controls = this.browserService.controls();
    const control = controls.find(c => c.name === controlName);

    if (!control) {
      return '';
    }

    // Return string value if available, otherwise value
    return control.string || (control.value !== undefined ? String(control.value) : '');
  }

  // Get CSS class for script status
  getScriptStatusClass(): string {
    const controls = this.browserService.controls();
    const statusControl = controls.find(c => c.name === 'script.status');

    if (!statusControl || statusControl.value === undefined) {
      return 'status-grey';
    }

    // Map status values to color classes
    switch (Number(statusControl.value)) {
      case 0: return 'status-green';      // OK
      case 1: return 'status-orange';     // Compromised
      case 2: return 'status-red';        // Fault
      case 3: return 'status-grey';       // Not Present
      case 4: return 'status-red';        // Missing
      case 5: return 'status-blue';       // Initializing
      default: return 'status-grey';
    }
  }
}
