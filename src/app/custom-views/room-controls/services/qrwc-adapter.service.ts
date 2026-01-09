import { Injectable, signal, computed, inject, effect } from '@angular/core';
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
  private loadedComponents = signal<Record<string, Component<string>>>({});
  private availableComponentNames = signal<string[]>([]);

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
    return this.loadedComponents();
  });

  // Computed signal that returns list of missing required components
  public readonly missingComponents = computed(() => {
    if (!this.initialised()) return [];

    const available = this.availableComponentNames();
    return this.requiredComponents.filter(name => !available.includes(name));
  });

  constructor() {
    // When connected, load the required components
    effect(() => {
      if (this.initialised()) {
        this.loadRequiredComponents();
      }
    });
  }

  /**
   * Load the required components from Q-SYS using QRWC's getComponent method
   */
  private async loadRequiredComponents(): Promise<void> {
    try {
      const qrwc = (this.qsysService as any).qrwc;
      if (!qrwc) {
        console.error('QRWC instance not available');
        return;
      }

      // First, get the list of available components
      const cachedComponents = this.qsysService.getCachedComponents();
      const componentNames = cachedComponents.map(c => c.name);
      this.availableComponentNames.set(componentNames);

      console.log('Loading room control components...');
      const components: Record<string, Component<string>> = {};

      // Load each required component
      for (const componentName of this.requiredComponents) {
        if (componentNames.includes(componentName)) {
          try {
            // Use QRWC's getComponent method to load the component with its controls
            const component = await qrwc.getComponent(componentName);
            components[componentName] = component;
            console.log(`✓ Loaded component: ${componentName}`);
          } catch (error) {
            console.warn(`Failed to load component ${componentName}:`, error);
          }
        } else {
          console.warn(`Component not found in Q-SYS design: ${componentName}`);
        }
      }

      this.loadedComponents.set(components);
      console.log(`Room controls: Loaded ${Object.keys(components).length} of ${this.requiredComponents.length} required components`);
    } catch (error) {
      console.error('Failed to load room control components:', error);
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
