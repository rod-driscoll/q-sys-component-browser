import { Component, OnInit, OnDestroy, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { QSysService } from '../../services/qsys.service';
import { QSysBrowserService, ComponentInfo, ControlInfo } from '../../services/qsys-browser.service';
import { LuaScriptService, LuaScript } from '../../services/lua-script.service';
import { WebSocketDiscoveryService } from '../../services/websocket-discovery.service';

@Component({
  selector: 'app-qsys-browser',
  imports: [CommonModule, FormsModule],
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

  // Track expanded controls
  expandedControls = new Set<string>();

  // Loading states
  isLoadingComponents = false;
  isLoadingControls = false;

  // Connection details
  coreIp = '192.168.104.227';
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
      if (discoveryData) {
        this.processWebSocketDiscoveryData(discoveryData);
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

  // Current view
  get currentView(): 'components' | 'controls' | 'editor' {
    if (this.browserService.selectedControl()) return 'editor';
    if (this.browserService.selectedComponent()) return 'controls';
    return 'components';
  }

  ngOnInit(): void {
    // Connect to Q-SYS Core
    this.qsysService.connect({
      coreIp: '192.168.104.227',
      secure: true,
      pollInterval: 35,
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

        // Only process log.history updates for the currently selected component
        if (selectedComponent &&
            update.component === selectedComponent.name &&
            update.control === 'log.history' &&
            update.string) {
          this.appendLogEntry(update.string);
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
  }

  // Process WebSocket discovery data
  private processWebSocketDiscoveryData(discoveryData: any): void {
    console.log('Processing WebSocket discovery data...');

    try {
      // Convert to ComponentInfo format
      const componentList: ComponentInfo[] = discoveryData.components.map((comp: any) => ({
        name: comp.name,
        type: comp.type,
        controlCount: comp.controlCount || 0
      }));

      this.browserService.setComponents(componentList);
      console.log(`✓ Loaded ${componentList.length} components via WebSocket`);

      this.isLoadingComponents = false;
    } catch (error) {
      console.error('Failed to process WebSocket discovery data:', error);
      this.isLoadingComponents = false;
    }
  }

  // Fetch controls via HTTP API (for WebSocket-discovered components)
  private async fetchControlsViaHTTP(componentName: string): Promise<any[]> {
    const url = `http://192.168.104.227:9091/api/components/${encodeURIComponent(componentName)}/controls`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data.controls || [];
  }

  // Select a component and load its controls from Q-SYS Core
  async selectComponent(component: ComponentInfo): Promise<void> {
    await this.browserService.selectComponent(component);
    this.controlSearchTerm = '';
    this.isLoadingControls = true;
    console.log('Loading controls for:', component.name);

    try {
      // Try to get controls via QRWC first, fallback to HTTP API if component not found
      let controls;
      try {
        controls = await this.qsysService.getComponentControls(component.name);
      } catch (error: any) {
        // If component not found in QRWC (e.g., discovered via WebSocket), fetch via HTTP API
        if (error.message?.includes('not found')) {
          console.log(`Component not in QRWC, fetching controls via HTTP API...`);
          controls = await this.fetchControlsViaHTTP(component.name);
        } else {
          throw error;
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
      }));

      this.browserService.setControls(controlList);
      console.log(`✓ Loaded ${controlList.length} controls for ${component.name}`);

      // Subscribe to component-level event listeners for live updates (only if using QRWC)
      // Skip subscription if controls were fetched via HTTP API
      try {
        this.qsysService.subscribeToComponent(component.name);
      } catch (error) {
        console.log('Skipping QRWC subscription (component not in QRWC)');
      }

      // Listen for control updates
      this.qsysService.getControlUpdates().subscribe((update) => {
        // Update the control in the browser service
        const currentControls = this.browserService.controls();
        const updatedControls = currentControls.map((ctrl) => {
          if (ctrl.name === update.control) {
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
            // For knobs, use value (in ValueMin-ValueMax range) and format to 1 decimal place
            this.editValue = update.value !== undefined ? Number(update.value.toFixed(1)) : '';
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

  // Handle control item click - only navigate to editor for 'code' controls
  onControlClick(control: ControlInfo, event: MouseEvent): void {
    // Only open the dedicated editor view for 'code' controls (Lua Script Management)
    if (control.name?.toLowerCase() === 'code') {
      this.selectControl(control);
    }
    // For all other controls, do nothing - let inline editing handle it
  }

  // Select a control for editing (opens dedicated editor view)
  selectControl(control: ControlInfo): void {
    this.browserService.selectControl(control);
    this.isDragging = false; // Reset drag state

    // If selecting the 'code' control, initialize log history from current log.history value
    if (control.name?.toLowerCase() === 'code') {
      this.initializeLogHistory();
    }

    // For combo boxes, use string value to match choices
    if (control.type === 'Combo box') {
      this.editValue = control.string ?? '';
    } else if (control.type === 'Text') {
      // For text controls, use string value
      this.editValue = control.string ?? '';
    } else if (control.type === 'Knob') {
      // For knobs, use value (in ValueMin-ValueMax range) and format to 1 decimal place
      this.editValue = control.value !== undefined ? Number(control.value.toFixed(1)) : (control.valueMin ?? 0);
    } else if (control.type === 'Time') {
      // For time controls, parse the value (in seconds) into hh:mm:ss segments
      const totalSeconds = control.value ?? 0;
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = Math.floor(totalSeconds % 60);

      this.timeHours = String(hours).padStart(2, '0');
      this.timeMinutes = String(minutes).padStart(2, '0');
      this.timeSeconds = String(seconds).padStart(2, '0');
      this.editValue = totalSeconds;
    } else {
      this.editValue = control.value ?? control.position ?? control.string ?? '';
    }
  }

  // Update the control value
  updateControl(): void {
    const control = this.browserService.selectedControl();
    if (!control) return;

    let value = this.editValue;

    // Convert value based on control type
    switch (control.type) {
      case 'Boolean':
        value = value ? 1 : 0;
        break;
      case 'Integer':
        value = Math.floor(Number(value));
        break;
      case 'Float':
        value = Number(value);
        break;
    }

    this.browserService.updateControlValue(value, undefined);
    console.log(`Updated ${control.name} to ${value}`);
  }

  // Set boolean value and update immediately
  setBooleanValue(value: boolean): void {
    this.editValue = value;
    this.updateControl();
  }

  // Trigger control (sends a trigger pulse)
  triggerControl(): void {
    const control = this.browserService.selectedControl();
    if (!control) return;

    // Triggers typically send value 1
    this.browserService.updateControlValue(1, undefined);
    console.log(`Triggered ${control.name}`);
  }

  // Get min value for slider (valueMin or 0)
  getSliderMin(): number {
    const control = this.browserService.selectedControl();
    return control?.valueMin ?? 0;
  }

  // Get max value for slider (valueMax or 1)
  getSliderMax(): number {
    const control = this.browserService.selectedControl();
    return control?.valueMax ?? 1;
  }

  // Get display value with 1 decimal place
  getDisplayValue(): string {
    if (typeof this.editValue === 'number') {
      return this.editValue.toFixed(1);
    }
    return String(this.editValue);
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

  // Get available values for State Trigger based on min/max range
  getStateTriggerValues(): number[] {
    const control = this.browserService.selectedControl();
    if (!control) return [0];

    // Check if control has choices (like combo box)
    if (control.choices && control.choices.length > 0) {
      return control.choices.map(c => Number(c));
    }

    // Use valueMin/valueMax if available, otherwise use current value to determine range
    let min = control.valueMin ?? 0;
    let max = control.valueMax ?? 1;

    // If current value is outside the min/max range, expand the range to include it
    if (control.value !== undefined) {
      const currentValue = Number(control.value);
      if (currentValue < min) min = currentValue;
      if (currentValue > max) max = currentValue;
    }

    const values: number[] = [];
    for (let i = min; i <= max; i++) {
      values.push(i);
    }

    return values;
  }

  // Slider drag start - prevent feedback updates
  onSliderDragStart(): void {
    this.isDragging = true;
  }

  // Slider drag end - allow feedback updates and send final value
  onSliderDragEnd(): void {
    this.isDragging = false;
    this.updateControl();
  }

  // Slider input - update value without sending to Q-SYS (for display only)
  onSliderInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.editValue = Number(Number(target.value).toFixed(1));
  }

  // Time control - handle segment changes
  onTimeChange(): void {
    // Pad segments to 2 digits
    const hours = this.timeHours.padStart(2, '0');
    const minutes = this.timeMinutes.padStart(2, '0');
    const seconds = this.timeSeconds.padStart(2, '0');

    // Combine into total seconds value
    const totalSeconds = (parseInt(hours) || 0) * 3600 + (parseInt(minutes) || 0) * 60 + (parseInt(seconds) || 0);

    this.editValue = totalSeconds;
    this.updateControl();
  }

  // Time control - select all text on focus
  onTimeSegmentFocus(event: Event): void {
    const input = event.target as HTMLInputElement;
    input.select();
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

  // Inline control editing methods
  toggleControlExpanded(control: ControlInfo): void {
    const key = `${this.browserService.selectedComponent()?.name}:${control.name}`;
    if (this.expandedControls.has(key)) {
      this.expandedControls.delete(key);
    } else {
      this.expandedControls.add(key);
    }
  }

  isControlExpanded(control: ControlInfo): boolean {
    const key = `${this.browserService.selectedComponent()?.name}:${control.name}`;
    return this.expandedControls.has(key);
  }

  setControlValue(control: ControlInfo, value: number): void {
    const componentName = this.browserService.selectedComponent()?.name;
    if (componentName) {
      this.qsysService.setControl(componentName, control.name, value);
    }
  }

  onInlineSliderInput(event: Event, control: ControlInfo): void {
    const input = event.target as HTMLInputElement;
    const position = parseFloat(input.value);
    const componentName = this.browserService.selectedComponent()?.name;
    if (componentName) {
      this.qsysService.setControl(componentName, control.name, position);
    }
  }

  onInlineValueChange(event: Event, control: ControlInfo): void {
    const input = event.target as HTMLInputElement | HTMLSelectElement;
    const value = parseFloat(input.value);
    const componentName = this.browserService.selectedComponent()?.name;
    if (componentName) {
      this.qsysService.setControl(componentName, control.name, value);
    }
  }

  onInlineComboChange(event: Event, control: ControlInfo): void {
    const select = event.target as HTMLSelectElement;
    const value = select.value;
    const componentName = this.browserService.selectedComponent()?.name;
    if (componentName) {
      this.qsysService.setControl(componentName, control.name, value);
    }
  }

  onInlineTextChange(event: Event, control: ControlInfo): void {
    const textarea = event.target as HTMLTextAreaElement;
    const value = textarea.value;
    const componentName = this.browserService.selectedComponent()?.name;
    if (componentName) {
      this.qsysService.setControl(componentName, control.name, value);
    }
  }

  onInlineTimeChange(event: Event, control: ControlInfo, segment: 'hours' | 'minutes' | 'seconds'): void {
    const input = event.target as HTMLInputElement;
    const value = input.value.padStart(2, '0');

    const hours = segment === 'hours' ? parseInt(value) || 0 : this.getTimeHours(control);
    const minutes = segment === 'minutes' ? parseInt(value) || 0 : this.getTimeMinutes(control);
    const seconds = segment === 'seconds' ? parseInt(value) || 0 : this.getTimeSeconds(control);

    const totalSeconds = (parseInt(String(hours)) || 0) * 3600 + (parseInt(String(minutes)) || 0) * 60 + (parseInt(String(seconds)) || 0);

    const componentName = this.browserService.selectedComponent()?.name;
    if (componentName) {
      this.qsysService.setControl(componentName, control.name, totalSeconds);
    }
  }

  onInlineTrigger(control: ControlInfo): void {
    const componentName = this.browserService.selectedComponent()?.name;
    if (componentName) {
      this.qsysService.setControl(componentName, control.name, 1);
    }
  }

  getTimeHours(control: ControlInfo): string {
    const totalSeconds = control.value ?? 0;
    return String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
  }

  getTimeMinutes(control: ControlInfo): string {
    const totalSeconds = control.value ?? 0;
    return String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
  }

  getTimeSeconds(control: ControlInfo): string {
    const totalSeconds = control.value ?? 0;
    return String(Math.floor(totalSeconds % 60)).padStart(2, '0');
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

  // Global search control interaction methods
  onGlobalSearchControlUpdate(event: Event, control: ControlInfo, value: number): void {
    event.stopPropagation();
    if (control.componentName) {
      this.qsysService.setControl(control.componentName, control.name, value);
    }
  }

  onGlobalSearchSliderInput(event: Event, control: ControlInfo): void {
    event.stopPropagation();
    const input = event.target as HTMLInputElement;
    const position = parseFloat(input.value);
    if (control.componentName) {
      this.qsysService.setControl(control.componentName, control.name, position);
    }
  }

  onGlobalSearchValueChange(event: Event, control: ControlInfo): void {
    event.stopPropagation();
    const input = event.target as HTMLInputElement | HTMLSelectElement;
    const value = parseFloat(input.value);
    if (control.componentName) {
      this.qsysService.setControl(control.componentName, control.name, value);
    }
  }

  onGlobalSearchComboChange(event: Event, control: ControlInfo): void {
    event.stopPropagation();
    const select = event.target as HTMLSelectElement;
    const value = select.value;
    if (control.componentName) {
      this.qsysService.setControl(control.componentName, control.name, value);
    }
  }

  onGlobalSearchTextChange(event: Event, control: ControlInfo): void {
    event.stopPropagation();
    const textarea = event.target as HTMLTextAreaElement;
    const value = textarea.value;
    if (control.componentName) {
      this.qsysService.setControl(control.componentName, control.name, value);
    }
  }

  onGlobalSearchTimeChange(event: Event, control: ControlInfo, segment: 'hours' | 'minutes' | 'seconds'): void {
    event.stopPropagation();
    const input = event.target as HTMLInputElement;
    const value = input.value.padStart(2, '0');

    const hours = segment === 'hours' ? parseInt(value) || 0 : this.getTimeHoursValue(control);
    const minutes = segment === 'minutes' ? parseInt(value) || 0 : this.getTimeMinutesValue(control);
    const seconds = segment === 'seconds' ? parseInt(value) || 0 : this.getTimeSecondsValue(control);

    const totalSeconds = hours * 3600 + minutes * 60 + seconds;

    if (control.componentName) {
      this.qsysService.setControl(control.componentName, control.name, totalSeconds);
    }
  }

  onGlobalSearchTrigger(event: Event, control: ControlInfo): void {
    event.stopPropagation();
    if (control.componentName) {
      this.qsysService.setControl(control.componentName, control.name, 1);
    }
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
    this.updateControl();
  }

  // Remove a Lua script
  removeLuaScript(scriptName: string): void {
    const currentCode = this.editValue || '';
    const newCode = this.luaScriptService.removeScript(currentCode, scriptName);
    this.editValue = newCode;
    this.updateControl();
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
      this.qsysService.setControl(componentName, controlName, 1);
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
