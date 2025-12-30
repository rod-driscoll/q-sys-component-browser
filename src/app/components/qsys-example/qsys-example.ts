import { Component, OnInit, OnDestroy, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { QSysService } from '../../services/qsys.service';
import {
  QSysComponent,
  TextControl,
  ButtonControl,
  BooleanControl,
  KnobControl,
} from '../../models/qsys-components';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-qsys-example',
  imports: [CommonModule],
  templateUrl: './qsys-example.html',
  styleUrl: './qsys-example.css',
})
export class QsysExample implements OnInit, OnDestroy {
  // Example: Room Controls component
  private roomComponent?: QSysComponent;

  // Example controls
  systemPower?: BooleanControl;
  volumeFader?: KnobControl;
  volumeMute?: BooleanControl;
  motionMode?: TextControl;

  // Volume slider debounce
  private volumeDebounceTimer: any;

  // Computed values
  volumePercent = computed(() => {
    const val = this.volumeFader?.value();
    return val !== undefined ? Math.round(val) : 0;
  });

  constructor(protected qsysService: QSysService) { }

  // Connection state - access via getter for template
  get isConnected() {
    return this.qsysService.isConnected;
  }

  ngOnInit(): void {
    // Connect to Q-SYS Core
    // Uses runtime IP which can be overridden via URL parameters
    this.qsysService.connect({
      coreIp: environment.RUNTIME_CORE_IP,
      secure: false, // Use ws:// for local connections
      pollInterval: 35
    });

    // Wait for connection before setting up components
    this.qsysService.getConnectionStatus().subscribe((connected) => {
      if (connected) {
        this.setupComponents();
        // Enable continuous polling to receive updates from Q-SYS
        console.log("NOT Enabling continuous polling");
        //this.qsysService.enableContinuousPolling();
      }
    });
  }

  ngOnDestroy(): void {
    this.qsysService.disconnect();
  }

  private setupComponents(): void {
    // Example: Setup Room Controls component
    // Use the MCP server tools to discover available components:
    // - get_components: List all available components
    // - get_controls: List controls for a specific component

    this.roomComponent = new QSysComponent(this.qsysService, 'Room Controls DEV');

    // Setup controls (discovered via MCP server)
    this.systemPower = this.roomComponent.useBoolean('SystemOnOff');
    this.volumeFader = this.roomComponent.useKnob('VolumeFader');
    this.volumeMute = this.roomComponent.useBoolean('VolumeMute');
    this.motionMode = this.roomComponent.useText('MotionMode');
  }

  // Control actions
  togglePower(): void {
    this.systemPower?.toggle();
  }

  toggleMute(): void {
    this.volumeMute?.toggle();
  }

  setVolume(event: Event): void {
    const value = (event.target as HTMLInputElement).valueAsNumber;

    // Clear existing timer
    if (this.volumeDebounceTimer) {
      clearTimeout(this.volumeDebounceTimer);
    }

    // Debounce: only send value after user stops moving slider for 150ms
    this.volumeDebounceTimer = setTimeout(() => {
      this.volumeFader?.setValue(value);
    }, 150);
  }

  volumeUp(): void {
    const current = this.volumeFader?.value() || 0;
    this.volumeFader?.setValue(Math.min(100, current + 5));
  }

  volumeDown(): void {
    const current = this.volumeFader?.value() || 0;
    this.volumeFader?.setValue(Math.max(0, current - 5));
  }
}
