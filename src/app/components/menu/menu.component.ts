import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { QSysService } from '../../services/qsys.service';
import { CustomViewRegistryService } from '../../services/custom-view-registry.service';
import { MenuCard } from '../../models/custom-view.model';
import { environment } from '../../../environments/environment';

/**
 * Menu component - Home page with navigation cards
 * Displays connection status and navigation cards for:
 * - Component Browser (hardcoded)
 * - Custom Views (from registry)
 */
@Component({
  selector: 'app-menu',
  imports: [CommonModule, RouterModule],
  templateUrl: './menu.component.html',
  styleUrl: './menu.component.css'
})
export class MenuComponent implements OnInit {
  menuCards = signal<MenuCard[]>([]);

  // Q-SYS Core status information
  corePlatform = '';
  coreState = '';
  designName = '';

  constructor(
    private router: Router,
    protected qsysService: QSysService,
    private customViewRegistry: CustomViewRegistryService
  ) {}

  ngOnInit(): void {
    this.buildMenuCards();
    this.loadCoreStatus();
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
    }
  }

  /**
   * Build menu cards from static items and registry
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
      // Dynamic custom view cards from registry
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
}
