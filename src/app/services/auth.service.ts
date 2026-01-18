import { Injectable, signal } from '@angular/core';
import { environment } from '../../environments/environment';

/**
 * Authentication service for Q-SYS Core
 * Manages credentials and provides Bearer token authentication
 * Tokens are obtained via POST to /api/v0/logon and expire after 1 hour of inactivity
 */
@Injectable({
  providedIn: 'root'
})
export class AuthService {
  // Authentication state signals
  public username = signal<string>(environment.AUTH_USERNAME);
  public password = signal<string>(environment.AUTH_PASSWORD);
  public token = signal<string | null>(null);
  public isAuthenticated = signal<boolean>(false);
  public authError = signal<string | null>(null);

  private tokenExpiryTimeout: any = null;

  constructor() {
    this.loadCredentialsFromStorage();
  }

  /**
  * Load credentials and token from localStorage if available
   */
  private loadCredentialsFromStorage(): void {
    const storedCreds = localStorage.getItem('qsys-auth');
    if (storedCreds) {
      try {
        const { username, password } = JSON.parse(storedCreds);
        this.username.set(username);
        this.password.set(password);
        environment.setConnectionParams(undefined, undefined, username, password);
      } catch (error) {
        console.error('[AUTH] Failed to load credentials from storage:', error);
      }
    } else {
      // Initialize with environment defaults
      this.username.set(environment.AUTH_USERNAME);
      this.password.set(environment.AUTH_PASSWORD);

        // Load token if available
        const storedToken = localStorage.getItem('qsys-auth-token');
        if (storedToken) {
          try {
            const { token, expiresAt } = JSON.parse(storedToken);
            // Check if token is still valid (not expired)
            if (expiresAt && Date.now() < expiresAt) {
              this.token.set(token);
              this.isAuthenticated.set(true);
              this.scheduleTokenExpiry(expiresAt);
              console.log('[AUTH] Loaded valid token from storage');
            } else {
              localStorage.removeItem('qsys-auth-token');
              console.log('[AUTH] Stored token expired, removed');
            }
          } catch (error) {
            console.error('[AUTH] Failed to load token from storage:', error);
          }
        }
    }
  }

  /**
  * Login with username and password to obtain a Bearer token
  * @param username Q-SYS Core username
  * @param password Q-SYS Core password
  * @returns Promise that resolves when login is successful
   */
  async login(username: string, password: string): Promise<void> {
    this.username.set(username);
    this.password.set(password);
    this.authError.set(null);

    // Save credentials to localStorage
    localStorage.setItem('qsys-auth', JSON.stringify({ username, password }));
    environment.setConnectionParams(undefined, undefined, username, password);

    try {
      const coreIp = environment.RUNTIME_CORE_IP;
      const url = `/api/v0/logon`;
      
      console.log('[AUTH] Requesting bearer token from:', url);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Host': coreIp,
          'X-Qsys-Host': coreIp
        },
        body: JSON.stringify({ username, password })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Login failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      
      if (!data.token) {
        throw new Error('No token received in login response');
      }

      // Store token with expiry time (1 hour from now)
      const expiresAt = Date.now() + (60 * 60 * 1000); // 1 hour
      this.token.set(data.token);
      this.isAuthenticated.set(true);
      
      localStorage.setItem('qsys-auth-token', JSON.stringify({
        token: data.token,
        expiresAt
      }));

      this.scheduleTokenExpiry(expiresAt);
      
      console.log('[AUTH] Login successful, token obtained');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error('[AUTH] Login failed:', errorMsg);
      this.authError.set(errorMsg);
      this.isAuthenticated.set(false);
      this.token.set(null);
      throw error;
    }
  }

  /**
  * Schedule automatic token expiry
  * @param expiresAt Timestamp when token expires
   */
  private scheduleTokenExpiry(expiresAt: number): void {
    if (this.tokenExpiryTimeout) {
      clearTimeout(this.tokenExpiryTimeout);
    }

    const timeUntilExpiry = expiresAt - Date.now();
    if (timeUntilExpiry > 0) {
      this.tokenExpiryTimeout = setTimeout(() => {
        console.log('[AUTH] Token expired');
        this.logout();
      }, timeUntilExpiry);
    }
  }

  /**
  * Logout and revoke the current token
   */
  async logout(): Promise<void> {
    const currentToken = this.token();
    
    if (currentToken) {
      try {
        const coreIp = environment.RUNTIME_CORE_IP;
        await fetch(`/api/v0/logoff`, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${currentToken}`,
            'Host': coreIp,
            'X-Qsys-Host': coreIp
          }
        });
        console.log('[AUTH] Token revoked on server');
      } catch (error) {
        console.error('[AUTH] Failed to revoke token:', error);
      }
    }

    this.clearToken();
  }

  /**
   * Clear token without calling server
   */
  private clearToken(): void {
    if (this.tokenExpiryTimeout) {
      clearTimeout(this.tokenExpiryTimeout);
      this.tokenExpiryTimeout = null;
    }
    
    this.token.set(null);
    this.isAuthenticated.set(false);
    this.authError.set(null);
    localStorage.removeItem('qsys-auth-token');
  }

  /**
   * Get Authorization header with Bearer token
   * @returns Authorization header object or empty object if not authenticated
   */
  getAuthHeader(): Record<string, string> {
    const currentToken = this.token();
    if (currentToken) {
      return { Authorization: `Bearer ${currentToken}` };
    }
    return {};
  }

  /**
  * Check if user is authenticated (has valid token)
   */
  hasValidToken(): boolean {
    return this.isAuthenticated() && this.token() !== null;
  }

  /**
  * Update saved credentials without logging in
  * Use this when user wants to change credentials for next login
   */
  setCredentials(username: string, password: string): void {
    this.username.set(username);
    this.password.set(password);
    localStorage.setItem('qsys-auth', JSON.stringify({ username, password }));
    environment.setConnectionParams(undefined, undefined, username, password);
    console.log('[AUTH] Credentials saved');
  }

  /**
   * Reset credentials to defaults and clear token
   */
  resetToDefaults(): void {
    this.username.set(environment.AUTH_USERNAME);
    this.password.set(environment.AUTH_PASSWORD);
      this.clearToken();
      environment.resetConnectionParams();
    localStorage.removeItem('qsys-auth');
    console.log('[AUTH] Credentials reset to defaults');
  }
}
