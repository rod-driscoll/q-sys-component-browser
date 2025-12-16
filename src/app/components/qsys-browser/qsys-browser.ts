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

  // For control editing
  editValue: any = null;
  editRamp: number = 0;

  // Track if user is dragging a slider to prevent feedback updates
  isDragging = false;

  // Loading states
  isLoadingComponents = false;
  isLoadingControls = false;

  constructor(
    protected qsysService: QSysService,
    protected browserService: QSysBrowserService
  ) {}

  // Connection state
  get isConnected() {
    return this.qsysService.isConnected;
  }

  // Filtered component list
  get filteredComponents(): ComponentInfo[] {
    const components = this.browserService.components();
    if (!this.searchTerm) return components;

    const search = this.searchTerm.toLowerCase();
    return components.filter((c) => c.name.toLowerCase().includes(search));
  }

  // Filtered control list
  get filteredControls(): ControlInfo[] {
    const controls = this.browserService.controls();
    if (!this.controlSearchTerm) return controls;

    const search = this.controlSearchTerm.toLowerCase();
    return controls.filter((c) => c.name.toLowerCase().includes(search));
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
    this.qsysService.getConnectionStatus().subscribe((connected) => {
      if (connected) {
        // Don't enable polling yet - ChangeGroup doesn't exist until controls are added
        // Polling will be enabled when you select a component and add controls
        console.log('Connected - loading components from Q-SYS Core...');
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
          } else if (selectedControl.type === 'Knob') {
            // For knobs, use value (in ValueMin-ValueMax range) and format to 1 decimal place
            this.editValue = update.value !== undefined ? Number(update.value.toFixed(1)) : '';
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
    } else if (control.type === 'Knob') {
      // For knobs, use value (in ValueMin-ValueMax range) and format to 1 decimal place
      this.editValue = control.value !== undefined ? Number(control.value.toFixed(1)) : (control.valueMin ?? 0);
    } else {
      this.editValue = control.value ?? control.position ?? control.string ?? '';
    }
    this.editRamp = 0;
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

    this.browserService.updateControlValue(value, this.editRamp > 0 ? this.editRamp : undefined);
    console.log(`Updated ${control.name} to ${value}`);
  }

  // Set boolean value and update immediately
  setBooleanValue(value: boolean): void {
    this.editValue = value;
    this.updateControl();
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
}
