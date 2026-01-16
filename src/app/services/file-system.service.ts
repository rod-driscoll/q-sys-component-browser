import { Injectable, signal } from '@angular/core';
import { environment } from '../../environments/environment';
import { SecureTunnelDiscoveryService } from './secure-tunnel-discovery.service';

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
  contentType?: string;
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
  public fileContent = signal<string | null>(null);
  public fileContentType = signal<string | null>(null);
  public viewingFile = signal<string | null>(null);

  constructor(private secureTunnelService: SecureTunnelDiscoveryService) {}

  /**
   * Connect to the file system endpoint
   * Attempts to use secure control-based communication if available,
   * falls back to Lua WebSocket if not
   */
  connect(): void {
    // Check if control-based communication is available (preferred, more secure)
    if (this.secureTunnelService.useControlBasedCommunication()) {
      console.log('[FILE-SYSTEM] Using secure control-based communication for file operations');
      this.connectViaSecureTunnel();
    } else {
      console.log('[FILE-SYSTEM] Using Lua WebSocket fallback for file operations');
      this.connectViaLuaWebSocket();
    }
  }

  /**
   * Connect via secure control-based communication tunnel
   * TODO: Implement file system operations via json_input/json_output controls
   */
  private connectViaSecureTunnel(): void {
    console.warn('[FILE-SYSTEM] Secure tunnel not yet implemented, falling back to Lua WebSocket');
    this.connectViaLuaWebSocket();
  }

  /**
   * Connect to the Lua WebSocket file system endpoint
   * This is the fallback for environments without control-based communication
   */
  private connectViaLuaWebSocket(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('[FILE-SYSTEM] Lua WebSocket already connected');
      return;
    }

    console.log('[FILE-SYSTEM] Connecting to file system WebSocket:', this.wsUrl);
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
      this.error.set('Failed to connect to file system. Ensure TunnelDiscovery.lua is loaded.');
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
          // Clear file view when navigating
          this.fileContent.set(null);
          this.fileContentType.set(null);
          this.viewingFile.set(null);
        }
        break;

      case 'read':
        console.log('Received file content, type:', message.contentType);
        if (message.content !== undefined) {
          this.fileContent.set(message.content);
          this.fileContentType.set(message.contentType || 'text/plain');
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

  /**
   * Read a file's content
   */
  readFile(fileName: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('Cannot read file - WebSocket not ready');
      this.error.set('Not connected to file system');
      return;
    }

    const path = this.currentPath();
    const filePath = path ? `${path}${fileName}` : fileName;

    console.log('Sending file read request for:', filePath);
    this.isLoading.set(true);
    this.error.set(null);
    this.viewingFile.set(fileName);

    const message = {
      type: 'read',
      path: filePath
    };

    console.log('Sending WebSocket message:', message);
    this.ws.send(JSON.stringify(message));
  }

  /**
   * Close file view and return to directory listing
   */
  closeFile(): void {
    this.fileContent.set(null);
    this.fileContentType.set(null);
    this.viewingFile.set(null);
  }
}
