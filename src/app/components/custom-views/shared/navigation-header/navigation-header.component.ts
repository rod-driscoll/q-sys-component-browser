import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { QSysService } from '../../../../services/qsys.service';
import { environment } from '../../../../../environments/environment';

/**
 * Reusable navigation header for custom views
 * Displays view title, back button, and Q-SYS Core status
 */
@Component({
  selector: 'app-navigation-header',
  imports: [CommonModule, RouterModule],
  templateUrl: './navigation-header.component.html',
  styleUrl: './navigation-header.component.css'
})
export class NavigationHeaderComponent implements OnInit {
  /** Title to display in the header */
  @Input() title: string = '';

  // Q-SYS Core status information
  corePlatform = '';
  coreState = '';
  designName = '';

  constructor(
    private router: Router,
    protected qsysService: QSysService
  ) {}

  ngOnInit(): void {
    // Subscribe to connection status changes to update core info
    this.qsysService.getConnectionStatus().subscribe((connected) => {
      if (connected) {
        const status = this.qsysService.getCoreStatus();
        this.corePlatform = status.platform;
        this.coreState = status.state;
        this.designName = status.designName;
      }
    });

    // Get initial status if already connected
    if (this.qsysService.isConnected()) {
      const status = this.qsysService.getCoreStatus();
      this.corePlatform = status.platform;
      this.coreState = status.state;
      this.designName = status.designName;
    }
  }

  /**
   * Navigate back to menu
   */
  navigateToMenu(): void {
    this.router.navigate(['/']);
  }

  /**
   * Get connection status
   */
  get isConnected(): boolean {
    return this.qsysService.isConnected();
  }

  /**
   * Get connection status text
   */
  get connectionStatus(): string {
    return this.qsysService.isConnected() ? 'Connected' : 'Disconnected';
  }

  /**
   * Get Core IP address
   */
  get coreIp(): string {
    return environment.RUNTIME_CORE_IP || 'Not configured';
  }

  /**
   * Get Core port
   */
  get corePort(): number {
    return environment.RUNTIME_CORE_PORT || 0;
  }
}
