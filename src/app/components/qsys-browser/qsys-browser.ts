import { Component, OnInit, OnDestroy, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { QSysService } from '../../services/qsys.service';
import { QSysBrowserService, ComponentInfo, ControlInfo } from '../../services/qsys-browser.service';

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

  constructor(
    protected qsysService: QSysService,
    protected browserService: QSysBrowserService
  ) {}

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
  }

  ngOnDestroy(): void {
    this.qsysService.disconnect();
  }

  // Load all components from Q-SYS Core via QRWC
  async loadComponents(): Promise<void> {
    this.isLoadingComponents = true;
    try {
      console.log('Fetching component list from Q-SYS...');
      const components = await this.qsysService.getComponents();

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

  // Select a component and load its controls from Q-SYS Core
  async selectComponent(component: ComponentInfo): Promise<void> {
    await this.browserService.selectComponent(component);
    this.controlSearchTerm = '';
    this.isLoadingControls = true;
    console.log('Loading controls for:', component.name);

    try {
      const controls = await this.qsysService.getComponentControls(component.name);

      // Transform QRWC response to our ControlInfo format
      const controlList: ControlInfo[] = controls.map((ctrl: any) => ({
        name: ctrl.Name,
        type: ctrl.Type || 'Text',
        direction: ctrl.Direction || 'Read/Write',
        value: ctrl.Value,
        valueMin: ctrl.ValueMin,
        valueMax: ctrl.ValueMax,
        position: ctrl.Position,
        string: ctrl.String,
        choices: ctrl.Choices,
      }));

      this.browserService.setControls(controlList);
      console.log(`✓ Loaded ${controlList.length} controls for ${component.name}`);

      // Subscribe to component-level event listeners for live updates
      this.qsysService.subscribeToComponent(component.name);

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

  // Select a control for editing
  selectControl(control: ControlInfo): void {
    this.browserService.selectControl(control);
    this.isDragging = false; // Reset drag state
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
}
