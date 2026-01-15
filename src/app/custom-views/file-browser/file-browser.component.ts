import { Component, OnInit, OnDestroy, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationHeaderComponent } from '../../components/custom-views/shared/navigation-header/navigation-header.component';
import { FILE_BROWSER_METADATA } from './file-browser.metadata';
import { FileSystemService, FileEntry } from '../../services/file-system.service';

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
    // App-level initialization has already completed at this point
    // Discovery service is ready, Lua scripts are loaded
    // Just connect to file system
    console.log('[FILE-BROWSER] Connecting to file system (app init complete)');
    this.fileSystemService.connect();
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
