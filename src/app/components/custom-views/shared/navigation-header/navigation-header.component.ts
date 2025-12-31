import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { QSysService } from '../../../../services/qsys.service';

/**
 * Reusable navigation header for custom views
 * Displays view title, back button, and connection status
 */
@Component({
  selector: 'app-navigation-header',
  imports: [CommonModule, RouterModule],
  templateUrl: './navigation-header.component.html',
  styleUrl: './navigation-header.component.css'
})
export class NavigationHeaderComponent {
  /** Title to display in the header */
  @Input() title: string = '';

  constructor(
    private router: Router,
    protected qsysService: QSysService
  ) {}

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
}
