import { Component, OnInit, OnDestroy, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationHeaderComponent } from '../../components/custom-views/shared/navigation-header/navigation-header.component';
import { FILE_BROWSER_METADATA } from './file-browser.metadata';
import { FileSystemService, FileEntry } from '../../services/file-system.service';
import { LuaScriptService } from '../../services/lua-script.service';
import { QSysService } from '../../services/qsys.service';
import { WebSocketDiscoveryService } from '../../services/websocket-discovery.service';

@Component({
  selector: 'app-file-browser',
  standalone: true,
  imports: [CommonModule, NavigationHeaderComponent],
  templateUrl: './file-browser.component.html',
  styleUrl: './file-browser.component.css'
})
export class FileBrowserComponent implements OnInit, OnDestroy {
  /** View title from metadata */
  readonly title = FILE_BROWSER_METADATA.title;

  private fileSystemService = inject(FileSystemService);
  private luaScriptService = inject(LuaScriptService);
  private qsysService = inject(QSysService);
  private wsDiscoveryService = inject(WebSocketDiscoveryService);

  constructor() {}

  // Use service signals via getters
  get currentPath() { return this.fileSystemService.currentPath; }
  get entries() { return this.fileSystemService.entries; }
  get isLoading() { return this.fileSystemService.isLoading; }
  get errorMessage() { return this.fileSystemService.error; }
  get isConnected() { return this.fileSystemService.isConnected; }
  get fileContent() { return this.fileSystemService.fileContent; }
  get fileContentType() { return this.fileSystemService.fileContentType; }
  get viewingFile() { return this.fileSystemService.viewingFile; }

  // Path breadcrumbs for navigation
  pathParts = computed(() => {
    const path = this.currentPath();
    if (!path || path === '' || path === '/') return [];
    return path.split('/').filter(p => p.length > 0);
  });

  ngOnInit(): void {
    // Initialize file browser with proper dependency sequencing
    this.initializeFileBrowser();
  }

  /**
   * Initialize file browser with proper dependency sequencing
   * Similar pattern to named-controls component
   */
  private async initializeFileBrowser(): Promise<void> {
    try {
      // 1. Ensure QRWC connection is ready
      console.log('[FILE-BROWSER] Waiting for QRWC connection...');
      await this.waitForQRWCConnection();

      // 2. Ensure WebSocket discovery completes (establishes secure tunnel)
      console.log('[FILE-BROWSER] Waiting for WebSocket discovery to complete...');
      await this.ensureDiscoveryComplete();

      // 3. Load Lua scripts (required for WebSocket file system endpoint)
      console.log('[FILE-BROWSER] Loading Lua scripts...');
      await this.loadLuaScripts();

      // 4. Connect to file system
      console.log('[FILE-BROWSER] Connecting to file system...');
      this.fileSystemService.connect();
    } catch (error) {
      console.error('[FILE-BROWSER] Initialization failed:', error);
    }
  }

  /**
   * Wait for QRWC connection to be established
   */
  private waitForQRWCConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('QRWC connection timeout (10s)'));
      }, 10000);

      const checkConnection = setInterval(() => {
        if (this.qsysService.status() === 'connected') {
          clearInterval(checkConnection);
          clearTimeout(timeout);
          resolve();
        }
      }, 100);
    });
  }

  /**
   * Wait for WebSocket discovery to complete
   */
  private ensureDiscoveryComplete(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('WebSocket discovery timeout (10s)'));
      }, 10000);

      const checkDiscovery = setInterval(() => {
        if (this.wsDiscoveryService.isConnected()) {
          clearInterval(checkDiscovery);
          clearTimeout(timeout);
          resolve();
        }
      }, 100);
    });
  }

  /**
   * Load Lua scripts required for file system access
   */
  private loadLuaScripts(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Lua script loading timeout (10s)'));
      }, 10000);

      try {
        this.luaScriptService.loadScripts();
        // Give Lua scripts time to load
        setTimeout(() => {
          clearTimeout(timeout);
          resolve();
        }, 500);
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  }

  ngOnDestroy(): void {
    this.fileSystemService.disconnect();
  }

  /**
   * Navigate to a subdirectory
   */
  openDirectory(entry: FileEntry): void {
    if (entry.type !== 'directory') return;
    this.fileSystemService.navigateToDirectory(entry.name);
  }

  /**
   * Navigate up to parent directory
   */
  navigateUp(): void {
    this.fileSystemService.navigateUp();
  }

  /**
   * Navigate to a specific path part (breadcrumb navigation)
   */
  navigateToPathPart(index: number): void {
    this.fileSystemService.navigateToPathPart(index);
  }

  /**
   * Format file size for display
   */
  formatFileSize(size: number | undefined): string {
    if (!size) return '-';

    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
    return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }

  /**
   * Get icon for file entry
   */
  getEntryIcon(entry: FileEntry): string {
    if (entry.type === 'directory') return '📁';

    // File type icons based on extension
    const ext = entry.name.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'wav':
      case 'mp3':
      case 'aac':
      case 'flac':
        return '🎵';
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
      case 'bmp':
        return '🖼️';
      case 'mp4':
      case 'avi':
      case 'mov':
      case 'mkv':
        return '🎬';
      case 'txt':
      case 'log':
        return '📄';
      case 'lua':
      case 'js':
      case 'py':
        return '📝';
      case 'zip':
      case 'rar':
      case '7z':
        return '📦';
      default:
        return '📄';
    }
  }

  /**
   * Handle double-click on entry
   */
  onEntryDoubleClick(entry: FileEntry): void {
    if (entry.type === 'directory') {
      this.openDirectory(entry);
    } else {
      this.openFile(entry);
    }
  }

  /**
   * Open a file for viewing
   */
  openFile(entry: FileEntry): void {
    if (entry.type !== 'file') return;
    this.fileSystemService.readFile(entry.name);
  }

  /**
   * Close file view
   */
  closeFileView(): void {
    this.fileSystemService.closeFile();
  }

  /**
   * Check if content type is text-based
   */
  isTextContent(contentType: string | null): boolean {
    if (!contentType) return false;
    return contentType.startsWith('text/') ||
           contentType === 'application/json' ||
           contentType === 'application/xml';
  }

  /**
   * Check if content type is an image
   */
  isImageContent(contentType: string | null): boolean {
    if (!contentType) return false;
    return contentType.startsWith('image/');
  }

  /**
   * Check if content type is audio
   */
  isAudioContent(contentType: string | null): boolean {
    if (!contentType) return false;
    return contentType.startsWith('audio/');
  }

  /**
   * Check if content type is video
   */
  isVideoContent(contentType: string | null): boolean {
    if (!contentType) return false;
    return contentType.startsWith('video/');
  }

  /**
   * Get data URL for media content
   */
  getMediaDataUrl(): string {
    const content = this.fileContent();
    const contentType = this.fileContentType();
    if (!content || !contentType) return '';
    return `data:${contentType};base64,${content}`;
  }

  /**
   * Refresh current directory
   */
  refresh(): void {
    this.fileSystemService.listDirectory(this.currentPath());
  }

  /**
   * Load Lua scripts asynchronously
   * Required for WebSocket file system endpoint functionality
   */
  private async loadLuaScripts(): Promise<void> {
    try {
      await this.luaScriptService.loadScripts();
      console.log('✓ Lua scripts loaded for file-browser');
    } catch (error) {
      console.error('Failed to load Lua scripts:', error);
      // Continue anyway - the error will be caught when connecting to file system
    }
  }
}
