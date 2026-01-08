import { Component, OnInit, signal, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { QSysService } from '../../services/qsys.service';
import { CustomViewRegistryService } from '../../services/custom-view-registry.service';
import { MenuCard } from '../../models/custom-view.model';
import { environment } from '../../../environments/environment';
import { SettingsDialogComponent } from '../settings-dialog/settings-dialog.component';

/**
 * Menu component - Home page with navigation cards
 * Displays connection status and navigation cards for:
 * - Component Browser (hardcoded)
 * - Custom Views (from registry)
 */
@Component({
  selector: 'app-menu',
  imports: [CommonModule, RouterModule, SettingsDialogComponent],
  templateUrl: './menu.component.html',
  styleUrl: './menu.component.css'
})
export class MenuComponent implements OnInit {
  menuCards = signal<MenuCard[]>([]);

  // Q-SYS Core status information
  corePlatform = '';
  coreState = '';
  designName = '';

  @ViewChild(SettingsDialogComponent) settingsDialog!: SettingsDialogComponent;

  constructor(
    private router: Router,
    protected qsysService: QSysService,
    private customViewRegistry: CustomViewRegistryService
  ) {}

  ngOnInit(): void {
    this.buildMenuCards();
    this.loadCoreStatus();
    this.subscribeToComponentsLoaded();
  }

  /**
   * Subscribe to components loaded event to rebuild menu when components are fetched
   */
  private subscribeToComponentsLoaded(): void {
    this.qsysService.getComponentsLoaded().subscribe((components) => {
      if (components.length > 0) {
        console.log(`Menu: Components loaded event received (${components.length} components), rebuilding menu...`);
        this.buildMenuCardsFromCache();
      }
    });
  }

  /**
   * Load Q-SYS Core status (connection is handled at app level)
   */
  private loadCoreStatus(): void {
    // Subscribe to connection status changes
    this.qsysService.getConnectionStatus().subscribe(async (connected) => {
      if (connected) {
        // Load Core status to get platform, state, and design name
        try {
          const status = this.qsysService.getCoreStatus();
          this.corePlatform = status.platform;
          this.coreState = status.state;
          this.designName = status.designName;
          console.log(`Menu: Core ${status.platform} (${status.state}) - Design: ${status.designName}`);

          // Try to build menu from cache if components already loaded
          const cached = this.qsysService.getCachedComponents();
          if (cached.length > 0) {
            console.log(`Menu: Using ${cached.length} cached components to build menu`);
            this.buildMenuCardsFromCache();
          }
        } catch (error) {
          console.error('Failed to load Core status:', error);
        }
      }
    });

    // If already connected, load status immediately
    if (this.qsysService.isConnected()) {
      const status = this.qsysService.getCoreStatus();
      this.corePlatform = status.platform;
      this.coreState = status.state;
      this.designName = status.designName;

      // Try to build menu from cache if components already loaded
      const cached = this.qsysService.getCachedComponents();
      if (cached.length > 0) {
        console.log(`Menu: Using ${cached.length} cached components to build menu`);
        this.buildMenuCardsFromCache();
      }
    }
  }

  /**
   * Build menu cards from static items and registry (synchronous - shows all views initially)
   */
  private buildMenuCards(): void {
    const cards: MenuCard[] = [
      // Hardcoded Component Browser card
      {
        title: 'Component Browser',
        description: 'Browse and control all Q-SYS components',
        icon: '🔍',
        route: 'browser'
      },
      // Dynamic custom view cards from registry (all views initially)
      ...this.customViewRegistry.registeredViews().map(view => ({
        title: view.title,
        description: view.description,
        icon: view.icon,
        route: view.route,
        badge: view.badge
      }))
    ];

    this.menuCards.set(cards);
  }

  /**
   * Build menu cards from cached components (called when components are loaded)
   */
  private buildMenuCardsFromCache(): void {
    const availableComponents = this.qsysService.getCachedComponents();
    const componentNames = new Set(availableComponents.map(c => c.name));

    console.log(`Menu: Building menu from ${componentNames.size} cached Q-SYS components`);

    // Filter custom views based on required components
    const filteredViews = this.customViewRegistry.registeredViews().filter(view => {
      // If no required components specified, always show the view
      if (!view.requiredComponents || view.requiredComponents.length === 0) {
        return true;
      }

      // Check if at least one required component exists
      const hasRequiredComponent = view.requiredComponents.some(reqComp =>
        componentNames.has(reqComp)
      );

      if (!hasRequiredComponent) {
        console.log(`Menu: Hiding "${view.title}" - required components not found:`, view.requiredComponents);
      }

      return hasRequiredComponent;
    });

    const cards: MenuCard[] = [
      // Hardcoded Component Browser card (always shown)
      {
        title: 'Component Browser',
        description: 'Browse and control all Q-SYS components',
        icon: '🔍',
        route: 'browser'
      },
      // Filtered custom view cards
      ...filteredViews.map(view => ({
        title: view.title,
        description: view.description,
        icon: view.icon,
        route: view.route,
        badge: view.badge
      }))
    ];

    this.menuCards.set(cards);
    console.log(`Menu: Showing ${filteredViews.length} custom views (${this.customViewRegistry.registeredViews().length - filteredViews.length} hidden)`);
  }

  /**
   * Navigate to a view
   * @param route Route path to navigate to
   */
  navigateToView(route: string): void {
    this.router.navigate([route]);
  }

  /**
   * Get connection status for display
   */
  get isConnected(): boolean {
    return this.qsysService.isConnected();
  }

  /**
   * Get connection status text
   */
  get connectionStatus(): string {
    return this.qsysService.isConnected() ? 'Core Connected' : 'Core Disconnected';
  }

  /**
   * Get Q-SYS Core IP address
   */
  get coreIp(): string {
    return environment.RUNTIME_CORE_IP;
  }

  /**
   * Get Q-SYS Core port
   */
  get corePort(): number {
    return environment.RUNTIME_CORE_PORT;
  }

  /**
   * Open settings dialog
   */
  openSettings(): void {
    this.settingsDialog.open();
  }
}
