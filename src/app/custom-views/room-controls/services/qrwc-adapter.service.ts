import { Injectable, signal, computed, inject } from '@angular/core';
import { Component } from '@q-sys/qrwc';
import { QSysService } from '../../../services/qsys.service';

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

  // List of required Q-SYS components for the room controls
  public readonly requiredComponents = [
    'Room Controls',
    'UCI Text Helper',
    'USB Video Bridge Core',
    'HDMISourceSelect_1',
  ];

  // Signal to track if we're connected to Q-SYS
  public readonly initialised = computed(() => {
    return this.qsysService.isConnected();
  });

  // Signal to store the current connection IP address
  public readonly connectionIpAddress = signal<string>('');

  // Components map (mimics QrwcAngularService interface)
  public readonly components = computed(() => {
    if (!this.initialised()) {
      return {};
    }

    // Build a components map from the QsysService
    const componentsMap: Record<string, Component<string> | undefined> = {};

    // Get the QRWC instance from QsysService to access components
    const qrwc = (this.qsysService as any).qrwc;
    if (qrwc && qrwc.components) {
      return qrwc.components as Record<string, Component<string> | undefined>;
    }

    return componentsMap;
  });

  // Computed signal that returns list of missing required components
  public readonly missingComponents = computed(() => {
    if (!this.initialised()) return [];

    const available = this.components();
    return this.requiredComponents.filter(name => !available[name]);
  });

  constructor() {
    // Subscribe to connection status to extract IP address
    this.qsysService.getConnectionStatus();
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
