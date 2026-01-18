import { Injectable, signal } from '@angular/core';
import { environment } from '../../environments/environment';
import { SecureTunnelDiscoveryService } from './secure-tunnel-discovery.service';
import { AuthService } from './auth.service';

/**
 * File or Directory entry from Q-SYS Core
 */
export interface FileEntry {
  name: string;
  path?: string; // Full path from API (e.g., "media/ui/file.png")
  ext?: string; // File extension (e.g., "png")
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
  private useMediaApi = false;  // Flag to use Media API instead of WebSocket

  // Get WebSocket URL from environment (uses runtime overrides if set)
  private get wsUrl(): string {
    const coreIp = environment.RUNTIME_CORE_IP;
    const port = environment.RUNTIME_CORE_PORT;
    return `ws://${coreIp}:${port}/ws/file-system`;
  }

  // Get Media API base URL
  // Q-SYS Media API: /api/v0/cores/self/media/
  // In development: Uses proxy to avoid CORS (configured in proxy.conf.js)
  // In production: Direct access to Core's web server on port 443 (HTTPS)
  private get mediaApiUrl(): string {
    const hostname = window.location.hostname;
    console.log('[FILE-SYSTEM] Current hostname:', hostname);
    
    // Check if running in dev mode (localhost)
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      // Use relative URL - proxy will forward to Core
      console.log('[FILE-SYSTEM] Using proxy URL: /api/v0/cores/self/media');
      return '/api/v0/cores/self/media';
    }
    
    // Production: Direct access to Core (HTTPS on port 443)
    const coreIp = environment.RUNTIME_CORE_IP;
    console.log('[FILE-SYSTEM] Using direct URL:', `https://${coreIp}/api/v0/cores/self/media`);
    return `https://${coreIp}/api/v0/cores/self/media`;
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

  constructor(
    private secureTunnelService: SecureTunnelDiscoveryService,
    private authService: AuthService
  ) {}

  /**
   * Connect to the file system endpoint
   * Priority:
   * 1. Secure control-based communication (most secure)
   * 2. Lua WebSocket (if TunnelDiscovery.lua is loaded)
   * 3. Media API HTTP fallback (read-only access to media directory)
   */
  connect(): void {
    // Check if control-based communication is available (preferred, most secure)
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
      console.warn('[FILE-SYSTEM] WebSocket unavailable, falling back to Media API (media directory only)');
      this.ws = null;
      this.useMediaApi = true;
      this.isConnected.set(true);
      this.error.set('Using Media API - only media directory is accessible');
      // Show only media directory when using API
      setTimeout(() => {
        this.listDirectory('media');
      }, 100);
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
   * Show root-level directories (media and design, or just media if using API)
   */
  private showRootDirectories(): void {
    console.log('Showing root-level directories');
    this.currentPath.set('');
    
    // If using Media API, show media as a directory option at root
    if (this.useMediaApi) {
      this.entries.set([
        { name: 'media', path: 'media', type: 'directory' }
      ]);
      this.error.set(null);
    } else {
      this.entries.set([
        { name: 'design', type: 'directory' },
        { name: 'media', type: 'directory' }
      ]);
      this.error.set(null);
    }
    
    this.isLoading.set(false);
  }

  /**
   * Request directory listing from Q-SYS Core
   * Uses WebSocket if available, otherwise falls back to Media API
   */
  listDirectory(path: string): void {
    // Handle root level - show design and media directories (or just media if using API)
    if (!path || path === '' || path === '/') {
      this.showRootDirectories();
      return;
    }

    // If using Media API, delegate to HTTP method
    if (this.useMediaApi) {
      this.listDirectoryViaMediaApi(path);
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
   * List directory using Media API (HTTP)
   * Only works for media directory
   */
  private async listDirectoryViaMediaApi(path: string): Promise<void> {
    // Media API only supports media directory - allow 'media' as root
    if (path && !path.startsWith('media')) {
      console.error('[FILE-SYSTEM] Invalid path for Media API:', path);
      this.error.set('Media API only supports media directory');
      this.entries.set([]);
      return;
    }

    this.isLoading.set(true);
    this.error.set(null);

    try {
      // Remove 'media/' prefix for API call
      const apiPath = path.replace(/^media\/?/, '');
      // Build URL - GET on directory should return listing
      const url = apiPath ? `${this.mediaApiUrl}/${apiPath}` : `${this.mediaApiUrl}/`;

      console.log('[FILE-SYSTEM] Media API list request:', url);

      const headers: HeadersInit = {
        'Accept': 'application/json',
        ...this.authService.getAuthHeader()
      };

      // In dev mode, add host header for dynamic proxy target
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        headers['X-Qsys-Host'] = environment.RUNTIME_CORE_IP;
      }

      console.log('[FILE-SYSTEM] Media API list fetch options:', { method: 'GET', url, headers });

      const doFetch = async () => fetch(url, { method: 'GET', headers });
      let response = await doFetch();

      // If unauthorized, attempt to login (protected mode) and retry once
      if (response.status === 401) {
        try {
          console.warn('[FILE-SYSTEM] 401 Unauthorized. Attempting login and retry...');
          await this.authService.login(this.authService.username(), this.authService.password());
          // Merge new auth header
          Object.assign(headers, this.authService.getAuthHeader());
          response = await doFetch();
        } catch (e) {
          console.error('[FILE-SYSTEM] Login attempt failed:', e);
        }
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('[FILE-SYSTEM] Media API response meta:', {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries())
      });
      console.log('[FILE-SYSTEM] Media API response body:', data);
      console.log('[FILE-SYSTEM] Response type:', Array.isArray(data) ? 'Array' : typeof data);
      if (Array.isArray(data) && data.length > 0) {
        console.log('[FILE-SYSTEM] First item sample:', data[0]);
      }

      const entries: FileEntry[] = [];

      // Handle array format from Core (direct list with type field)
      if (Array.isArray(data)) {
        console.log('[FILE-SYSTEM] Parsing array response with', data.length, 'items');
        data.forEach((item: any, idx: number) => {
          if (item && typeof item === 'object') {
            // Entries with name and type
            if (item.name && item.type) {
              console.log(`[FILE-SYSTEM] Item ${idx}:`, { name: item.name, type: item.type, typeOf: typeof item.type });
              // Normalize type: Core might return 'dir' or other variations
              let normalizedType: 'file' | 'directory' = 'file';
              if (item.type === 'directory' || item.type === 'dir' || item.type === 'folder') {
                normalizedType = 'directory';
              }
              // Use the path from API if available, otherwise construct from name
              const fullPath = item.path || item.name;
              entries.push({ 
                name: item.name, 
                path: fullPath, 
                ext: item.ext,
                type: normalizedType, 
                size: item.size, 
                modified: item.modified 
              });
            } else {
              console.warn('[FILE-SYSTEM] Item missing name/type:', item);
            }
          }
        });
      } else if (data && typeof data === 'object') {
        // Handle object format: { "files": [...], "directories": [...] }
        console.log('[FILE-SYSTEM] Parsing object response format');
        // Add directories
        if (data.directories && Array.isArray(data.directories)) {
          data.directories.forEach((name: string) => {
            entries.push({ name, type: 'directory' });
          });
        }

        // Add files
        if (data.files && Array.isArray(data.files)) {
          data.files.forEach((name: string) => {
            entries.push({ name, type: 'file' });
          });
        }
      }

      // Sort: directories first, then files, alphabetically
      const sorted = entries.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === 'directory' ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });

      console.log('[FILE-SYSTEM] Parsed entries:', sorted);
      this.entries.set(sorted);
      this.currentPath.set(path);
      this.error.set(null);
      this.fileContent.set(null);
      this.fileContentType.set(null);
      this.viewingFile.set(null);

      console.log(`[FILE-SYSTEM] Media API returned ${sorted.length} entries`);
    } catch (error: any) {
      console.error('[FILE-SYSTEM] Media API error:', error);
      this.error.set(`Failed to list directory: ${error.message}`);
      this.entries.set([]);
    } finally {
      this.isLoading.set(false);
    }
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
   * Uses WebSocket if available, otherwise Media API for media files
   * @param filePath - Full path to the file (e.g., "media/zapper_lineup.json")
   */
  readFile(filePath: string): void {
    // If using Media API, delegate to HTTP method
    if (this.useMediaApi) {
      this.readFileViaMediaApi(filePath);
      return;
    }

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('Cannot read file - WebSocket not ready');
      this.error.set('Not connected to file system');
      return;
    }

    console.log('Sending file read request for:', filePath);
    this.isLoading.set(true);
    this.error.set(null);
    this.viewingFile.set(filePath.split('/').pop() || '');

    const message = {
      type: 'read',
      path: filePath
    };

    console.log('Sending WebSocket message:', message);
    this.ws.send(JSON.stringify(message));
  }

  /**
   * Read file content using Media API (HTTP)
   * Only works for media directory files
   */
  private async readFileViaMediaApi(filePath: string): Promise<void> {
    // Ensure path is relative to media directory
    // API returns paths like "zapper_lineup.json" or "ui/filename.ext"
    // We need to prepend 'media/' if not already present
    let fullPath = filePath;
    if (!fullPath.startsWith('media')) {
      fullPath = 'media/' + fullPath;
    }

    console.log('[FILE-SYSTEM] Media API: Normalized file path:', { input: filePath, normalized: fullPath });

    this.isLoading.set(true);
    this.error.set(null);
    this.viewingFile.set(filePath.split('/').pop() || '');

    try {
      // Remove 'media/' prefix for API call (handle both 'media/...' and '/media/...')
      const apiPath = fullPath.replace(/^\/?media\/?/, '');
      const url = `${this.mediaApiUrl}/${apiPath}`;

      console.log('[FILE-SYSTEM] Media API file request:', { url });

      const headers: HeadersInit = {
        ...this.authService.getAuthHeader()
      };

      // In dev mode, add host header for dynamic proxy target
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        headers['X-Qsys-Host'] = environment.RUNTIME_CORE_IP;
      }

      console.log('[FILE-SYSTEM] Media API file fetch options:', { url, headers });

      const doFetch = async () => fetch(url, { headers });
      let response = await doFetch();

      // If unauthorized, attempt to login (protected mode) and retry once
      if (response.status === 401) {
        try {
          console.warn('[FILE-SYSTEM] 401 Unauthorized. Attempting login and retry...');
          await this.authService.login(this.authService.username(), this.authService.password());
          Object.assign(headers, this.authService.getAuthHeader());
          response = await doFetch();
        } catch (e) {
          console.error('[FILE-SYSTEM] Login attempt failed:', e);
        }
      }
      console.log('[FILE-SYSTEM] Media API file response meta:', {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries())
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Get content type from response header (remove charset if present)
      const contentTypeHeader = response.headers.get('content-type') || 'application/octet-stream';
      const contentType = contentTypeHeader.split(';')[0].trim();

      // For text files, get content as text
      if (contentType.startsWith('text/') || contentType === 'application/json' || contentType === 'application/xml') {
        console.log('[FILE-SYSTEM] Reading as text:', contentType);
        const content = await response.text();
        this.fileContent.set(content);
        this.fileContentType.set(contentType);
      } 
      // For images, audio, and video - read as blob and convert to data URL
      else if (contentType.startsWith('image/') || contentType.startsWith('audio/') || contentType.startsWith('video/')) {
        console.log('[FILE-SYSTEM] Reading as binary (media):', contentType);
        const blob = await response.blob();
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result as string;
          // Extract base64 data (remove the data:...;base64, prefix)
          const base64Data = base64.split(',')[1];
          this.fileContent.set(base64Data);
          this.fileContentType.set(contentType);
          this.isLoading.set(false);
        };
        reader.onerror = () => {
          throw new Error('Failed to read file as blob');
        };
        reader.readAsDataURL(blob);
        return; // Exit early since FileReader is async
      } 
      else {
        // For other file types, show download link
        console.log('[FILE-SYSTEM] Unknown file type, showing download link:', contentType);
        this.fileContent.set(`Binary file: ${filePath}\n\nDownload URL: ${url}`);
        this.fileContentType.set('text/plain');
      }

      this.error.set(null);
      console.log('[FILE-SYSTEM] Media API file read successful');
    } catch (error: any) {
      console.error('[FILE-SYSTEM] Media API file read error:', error);
      this.error.set(`Failed to read file: ${error.message}`);
      this.fileContent.set(null);
    } finally {
      this.isLoading.set(false);
    }
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
