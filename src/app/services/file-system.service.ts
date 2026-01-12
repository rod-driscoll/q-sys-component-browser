import { Injectable, signal } from '@angular/core';
import { environment } from '../../environments/environment';

/**
 * File or Directory entry from Q-SYS Core
 */
export interface FileEntry {
  name: string;
  type: 'file' | 'directory';
  size?: number;
  modified?: string;
}

/**
 * WebSocket message types for file operations
 */
interface FileSystemMessage {
  type: 'list' | 'read' | 'error' | 'connected';
  path?: string;
  entries?: FileEntry[];
  content?: string;
  error?: string;
  message?: string;
}

@Injectable({
  providedIn: 'root'
})
export class FileSystemService {
  private ws: WebSocket | null = null;

  // Get WebSocket URL from environment (uses runtime overrides if set)
  private get wsUrl(): string {
    const coreIp = environment.RUNTIME_CORE_IP;
    const port = environment.RUNTIME_CORE_PORT;
    return `ws://${coreIp}:${port}/ws/file-system`;
  }

  // Signals for reactive state
  public isConnected = signal<boolean>(false);
  public currentPath = signal<string>('');
  public entries = signal<FileEntry[]>([]);
  public isLoading = signal<boolean>(false);
  public error = signal<string | null>(null);

  constructor() {}

  /**
   * Connect to the WebSocket file system endpoint
   */
  connect(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('File system WebSocket already connected');
      return;
    }

    console.log('Connecting to file system WebSocket:', this.wsUrl);
    this.ws = new WebSocket(this.wsUrl);

    this.ws.onopen = () => {
      console.log('✓ Connected to file system WebSocket');
      this.isConnected.set(true);
      this.error.set(null);
      // Request initial directory listing after a brief delay to ensure WebSocket is fully ready
      setTimeout(() => {
        console.log('Requesting initial directory listing for:', this.currentPath());
        this.showRootDirectories();
      }, 100);
    };

    this.ws.onmessage = (event) => {
      try {
        const message: FileSystemMessage = JSON.parse(event.data);
        this.handleMessage(message);
      } catch (error) {
        console.error('Error parsing file system message:', error);
        this.error.set('Failed to parse server response');
        this.isLoading.set(false);
      }
    };

    this.ws.onerror = (error) => {
      console.error('File system WebSocket error:', error);
      this.error.set('Failed to connect to file system. Ensure WebSocketComponentDiscovery.lua is loaded.');
      this.isConnected.set(false);
      this.isLoading.set(false);
    };

    this.ws.onclose = () => {
      console.log('File system WebSocket closed');
      this.isConnected.set(false);
      this.isLoading.set(false);
    };
  }

  /**
   * Disconnect from WebSocket
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected.set(false);
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(message: FileSystemMessage): void {
    console.log('Received file system message:', message);
    this.isLoading.set(false);

    switch (message.type) {
      case 'connected':
        console.log('File system connection acknowledged:', message.message);
        break;

      case 'list':
        console.log('Received directory listing:', message.entries?.length, 'entries');
        if (message.entries && message.path) {
          // Sort: directories first, then files, alphabetically
          const sorted = message.entries.sort((a, b) => {
            if (a.type !== b.type) {
              return a.type === 'directory' ? -1 : 1;
            }
            return a.name.localeCompare(b.name);
          });
          this.entries.set(sorted);
          this.currentPath.set(message.path);
          this.error.set(null);
        }
        break;

      case 'error':
        console.error('File system error:', message.error);
        this.error.set(message.error || 'Unknown error');
        break;

      default:
        console.warn('Unknown message type:', message.type);
    }
  }

  /**
   * Show root-level directories (media and design)
   */
  private showRootDirectories(): void {
    console.log('Showing root-level directories');
    this.currentPath.set('');
    this.entries.set([
      { name: 'design', type: 'directory' },
      { name: 'media', type: 'directory' }
    ]);
    this.isLoading.set(false);
    this.error.set(null);
  }

  /**
   * Request directory listing from Q-SYS Core
   */
  listDirectory(path: string): void {
    // Handle root level - show design and media directories
    if (!path || path === '' || path === '/') {
      this.showRootDirectories();
      return;
    }

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('Cannot list directory - WebSocket not ready:', {
        ws: !!this.ws,
        readyState: this.ws?.readyState,
        expectedState: WebSocket.OPEN
      });
      this.error.set('Not connected to file system');
      return;
    }

    console.log('Sending directory list request for path:', path);
    this.isLoading.set(true);
    this.error.set(null);

    const message = {
      type: 'list',
      path: path
    };

    console.log('Sending WebSocket message:', message);
    this.ws.send(JSON.stringify(message));
  }

  /**
   * Navigate to a subdirectory
   */
  navigateToDirectory(directoryName: string): void {
    const newPath = this.currentPath()
      ? `${this.currentPath()}/${directoryName}`
      : directoryName;
    this.listDirectory(newPath);
  }

  /**
   * Navigate up to parent directory
   */
  navigateUp(): void {
    const path = this.currentPath();

    // If at root, do nothing
    if (!path || path === '' || path === '/') {
      return;
    }

    const parts = this.getPathParts();

    // If at top level (design/ or media/), go to root
    if (parts.length <= 1) {
      this.showRootDirectories();
      return;
    }

    // Otherwise go up one level
    const parentPath = parts.slice(0, -1).join('/') + '/';
    this.listDirectory(parentPath);
  }

  /**
   * Navigate to a specific path part (breadcrumb navigation)
   */
  navigateToPathPart(index: number): void {
    // If clicking root (index -1 or 0 when at root), show root directories
    if (index < 0) {
      this.showRootDirectories();
      return;
    }

    const parts = this.getPathParts();
    const newPath = parts.slice(0, index + 1).join('/') + '/';
    this.listDirectory(newPath);
  }

  /**
   * Get path parts for breadcrumb navigation
   */
  getPathParts(): string[] {
    const path = this.currentPath();
    if (!path || path === '' || path === '/') return [];
    return path.split('/').filter(p => p.length > 0);
  }

  /**
   * Refresh current directory
   */
  refresh(): void {
    this.listDirectory(this.currentPath());
  }
}
