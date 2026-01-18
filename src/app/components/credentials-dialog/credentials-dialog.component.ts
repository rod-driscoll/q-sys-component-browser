import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-credentials-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './credentials-dialog.component.html',
  styleUrl: './credentials-dialog.component.css'
})
export class CredentialsDialogComponent implements OnInit {
  private authService = inject(AuthService);

  isOpen = false;
    isLoggingIn = false;
    loginError = '';
  username = '';
  password = '';
  tempUsername = '';
  tempPassword = '';
  showPassword = false;

  ngOnInit(): void {
    // Get current credentials from service
    this.username = this.authService.username();
    this.password = this.authService.password();
  }

  /**
   * Open the credentials dialog
   */
  openDialog(): void {
    this.tempUsername = this.username;
    this.tempPassword = this.password;
      this.loginError = '';
    this.isOpen = true;
  }

  /**
   * Close the dialog without saving
   */
  closeDialog(): void {
    this.isOpen = false;
    this.showPassword = false;
    this.loginError = '';
    this.isLoggingIn = false;
  }

  /**
  * Save credentials and login
   */
  async saveCredentials(): Promise<void> {
    if (this.tempUsername.trim() && this.tempPassword.trim()) {
      this.isLoggingIn = true;
      this.loginError = '';

      try {
        await this.authService.login(this.tempUsername, this.tempPassword);
        this.username = this.tempUsername;
        this.password = this.tempPassword;
        this.closeDialog();
      } catch (error) {
        this.loginError = error instanceof Error ? error.message : 'Login failed';
        console.error('[CREDENTIALS] Login failed:', error);
      } finally {
        this.isLoggingIn = false;
      }
    }
  }

  /**
   * Reset to defaults
   */
  resetToDefaults(): void {
    if (confirm('Reset authentication to defaults?')) {
      this.authService.resetToDefaults();
        this.loginError = '';
      this.username = this.authService.username();
      this.password = this.authService.password();
      this.tempUsername = this.username;
      this.tempPassword = this.password;
    }
  }

  /**
   * Toggle password visibility
   */
  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  /**
   * Get authentication status for display
   */
  authStatus(): string {
    if (this.authService.isAuthenticated()) {
      return '✓ Authenticated';
    }
    if (this.authService.authError()) {
      return '✗ Authentication required';
    }
    return '○ Not authenticated';
  }

  /**
   * Check if authenticated
   */
  isAuthenticated(): boolean {
    return this.authService.isAuthenticated();
  }
}
