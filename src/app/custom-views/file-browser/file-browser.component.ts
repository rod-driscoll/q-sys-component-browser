import { Component, OnInit, OnDestroy, computed } from '@angular/core';
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

  constructor(private fileSystemService: FileSystemService) {}

  // Use service signals via getters
  get currentPath() { return this.fileSystemService.currentPath; }
  get entries() { return this.fileSystemService.entries; }
  get isLoading() { return this.fileSystemService.isLoading; }
  get errorMessage() { return this.fileSystemService.error; }
  get isConnected() { return this.fileSystemService.isConnected; }

  // Path breadcrumbs for navigation
  pathParts = computed(() => {
    const path = this.currentPath();
    if (!path || path === '' || path === '/') return [];
    return path.split('/').filter(p => p.length > 0);
  });

  ngOnInit(): void {
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
      // Could implement file download/preview here
      console.log('File selected:', entry.name);
    }
  }

  /**
   * Refresh current directory
   */
  refresh(): void {
    this.fileSystemService.listDirectory(this.currentPath());
  }
}
