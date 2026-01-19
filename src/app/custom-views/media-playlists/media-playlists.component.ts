import { Component, OnInit, OnDestroy, inject, signal, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationHeaderComponent } from '../../components/custom-views/shared/navigation-header/navigation-header.component';
import { MEDIA_PLAYLISTS_METADATA } from './media-playlists.metadata';
import { QSysService } from '../../services/qsys.service';
import { AppInitializationService } from '../../services/app-initialization.service';
import { MediaPlaylistsService } from '../../services/media-playlists.service';

@Component({
  selector: 'app-media-playlists',
  standalone: true,
  imports: [CommonModule, NavigationHeaderComponent],
  templateUrl: './media-playlists.component.html',
  styleUrl: './media-playlists.component.css'
})
export class MediaPlaylistsComponent implements OnInit, OnDestroy {
  readonly title = MEDIA_PLAYLISTS_METADATA.title;

  private qsysService = inject(QSysService);
  private appInit = inject(AppInitializationService);
  private cdr = inject(ChangeDetectorRef);
  private playlistsService = inject(MediaPlaylistsService);

  // Audio player component
  private audioPlayerComponent: any = null;
  hasAudioPlayer = signal(false);

  // Expose service signals for template
  playlists = this.playlistsService.playlists;
  selectedPlaylist = this.playlistsService.selectedPlaylist;
  isLoading = this.playlistsService.isLoading;
  error = this.playlistsService.error;

  constructor() {}

  ngOnInit(): void {
    console.log('[MEDIA-PLAYLISTS] Waiting for app initialization...');
    
    this.waitForAppInit().then(() => {
      console.log('[MEDIA-PLAYLISTS] App initialization complete, loading data');
      this.discoverAudioPlayer();
      this.playlistsService.loadPlaylists();
    }).catch((error) => {
      console.error('[MEDIA-PLAYLISTS] App initialization failed:', error);
    });
  }

  /**
   * Wait for app-level initialization to complete
   */
  private waitForAppInit(): Promise<void> {
    return new Promise((resolve) => {
      if (this.appInit.initializationComplete()) {
        resolve();
        return;
      }

      const checkInterval = setInterval(() => {
        if (this.appInit.initializationComplete()) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
    });
  }

  ngOnDestroy(): void {
    // ComponentWrapper cleanup is handled automatically by ChangeGroup system
    console.log('[MEDIA-PLAYLISTS] Component destroyed');
  }

  private async discoverAudioPlayer(): Promise<void> {
    const components = this.qsysService.getCachedComponents();
    const audioPlayerComponent = components.find(c => c.type === 'audio_file_player');
    
    if (audioPlayerComponent) {
      console.log('[MEDIA-PLAYLISTS] Found audio_file_player:', audioPlayerComponent.name);
      this.hasAudioPlayer.set(true);
      await this.setupAudioPlayer(audioPlayerComponent.name);
    } else {
      console.log('[MEDIA-PLAYLISTS] No audio_file_player component found');
      this.hasAudioPlayer.set(false);
    }
  }

  private async setupAudioPlayer(componentName: string): Promise<void> {
    try {
      // Get QRWC internals
      const qrwc = (this.qsysService as any).qrwc;
      if (!qrwc) {
        console.error('[MEDIA-PLAYLISTS] QRWC not available');
        return;
      }

      const webSocketManager = (qrwc as any).webSocketManager;
      const changeGroup = (qrwc as any).changeGroup;

      // Import ComponentWrapper dynamically
      const { ComponentWrapper } = await import('../room-controls/services/qrwc-adapter.service');
      
      // Create ComponentWrapper for audio player
      this.audioPlayerComponent = new (ComponentWrapper as any)(componentName, webSocketManager, changeGroup);
      await this.audioPlayerComponent.initialize(this.qsysService);

      // Subscribe to control updates to trigger change detection
      this.qsysService.getControlUpdates().subscribe(update => {
        if (update.component === componentName && (update.control === 'filename' || update.control === 'root' || update.control === 'directory')) {
          console.log(`[MEDIA-PLAYLISTS] Triggering change detection for ${update.control}`);
          this.cdr.detectChanges();
        }
      });

      console.log('[MEDIA-PLAYLISTS] ✓ Audio player component initialized with ComponentWrapper');
    } catch (error) {
      console.error('[MEDIA-PLAYLISTS] Failed to setup audio player:', error);
    }
  }

  // Getters that directly access control signals for reactive display
  get timeDisplay() {
    const control = this.audioPlayerComponent?.controls?.['progress'];
    if (!control) return '00:00:00';
    // Use String property from Q-SYS if available
    return control.state.String || this.timeMsToString(control.state.Value || 0);
  }
  
  get remainingDisplay() {
    const control = this.audioPlayerComponent?.controls?.['remaining'];
    if (!control) return '00:00:00';
    // Use String property from Q-SYS if available
    return control.state.String || this.timeMsToString(control.state.Value || 0);
  }
  
  get statusDisplay() {
    const control = this.audioPlayerComponent?.controls?.['status'];
    return control?.state.String || '';
  }
  
  get rootDisplay() {
    const control = this.audioPlayerComponent?.controls?.['root'];
    return control?.state.String || '';
  }
  
  get directoryDisplay() {
    const control = this.audioPlayerComponent?.controls?.['directory'];
    return control?.state.String || '';
  }
  
  get fileDisplay() {
    const control = this.audioPlayerComponent?.controls?.['filename'];
    return control?.state.String || '';
  }
  
  get isPlaying() {
    const control = this.audioPlayerComponent?.controls?.['playing'];
    return control?.state.Bool || false;
  }
  
  get isStopped() {
    const control = this.audioPlayerComponent?.controls?.['stopped'];
    return control?.state.Bool || false;
  }
  
  get isPaused() {
    const control = this.audioPlayerComponent?.controls?.['paused'];
    return control?.state.Bool || false;
  }
  
  get autoPlay() {
    const control = this.audioPlayerComponent?.controls?.['play.on.startup'];
    return control?.state.Bool || false;
  }
  
  get volume() {
    const control = this.audioPlayerComponent?.controls?.['gain'];
    return control?.state.Value || 0;
  }
  
  get isMuted() {
    const control = this.audioPlayerComponent?.controls?.['mute'];
    // Q-SYS mute control: 0 = muted, 1 = unmuted, so invert the Bool
    return !control?.state.Bool || false;
  }
  
  get isLooping() {
    const control = this.audioPlayerComponent?.controls?.['loop'];
    return control?.state.Bool || false;
  }

  // Time formatting and progress bar helpers
  private timeMsToString(ms: number): string {
    if (!ms || ms < 0) return '00:00:00';
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  get progressPercent(): number {
    const timeControl = this.audioPlayerComponent?.controls?.['progress'];
    const remainingControl = this.audioPlayerComponent?.controls?.['remaining'];
    const time = timeControl?.state.Value || 0;
    const remaining = remainingControl?.state.Value || 0;
    const total = time + remaining;
    if (total === 0) return 0;
    return (time / total) * 100;
  }

  get remainingPercent(): number {
    const timeControl = this.audioPlayerComponent?.controls?.['progress'];
    const remainingControl = this.audioPlayerComponent?.controls?.['remaining'];
    const time = timeControl?.state.Value || 0;
    const remaining = remainingControl?.state.Value || 0;
    const total = time + remaining;
    if (total === 0) return 0;
    return (remaining / total) * 100;
  }

  // Combo box option getters - use Choices from control state
  // Return new array each time to ensure Angular detects changes
  // Include current value if it's not in choices to prevent showing wrong value
  get rootOptions(): string[] {
    const control = this.audioPlayerComponent?.controls?.['root'];
    const choices = control?.state.Choices || [];
    const currentValue = control?.state.String || '';
    
    // If current value exists and is not in choices, add it to the list
    if (currentValue && !choices.includes(currentValue)) {
      return [currentValue, ...choices];
    }
    return [...choices];
  }

  get directoryOptions(): string[] {
    const control = this.audioPlayerComponent?.controls?.['directory'];
    const choices = control?.state.Choices || [];
    const currentValue = control?.state.String || '';
    
    // If current value exists and is not in choices, add it to the list
    if (currentValue && !choices.includes(currentValue)) {
      return [currentValue, ...choices];
    }
    return [...choices];
  }

  get fileOptions(): string[] {
    const control = this.audioPlayerComponent?.controls?.['filename'];
    const choices = control?.state.Choices || [];
    const currentValue = control?.state.String || '';
    
    // If current value exists and is not in choices, add it to the list
    if (currentValue && !choices.includes(currentValue)) {
      return [currentValue, ...choices];
    }
    return [...choices];
  }

  get playlistDisplay() {
    const control = this.audioPlayerComponent?.controls?.['playlist.file'];
    return control?.state.String || '';
  }

  get playlistOptions(): string[] {
    const control = this.audioPlayerComponent?.controls?.['playlist.file'];
    const choices = control?.state.Choices || [];
    const currentValue = control?.state.String || '';
    
    // If current value exists and is not in choices, add it to the list
    if (currentValue && !choices.includes(currentValue)) {
      return [currentValue, ...choices];
    }
    return [...choices];
  }

  get isShuffleOn() {
    const control = this.audioPlayerComponent?.controls?.['playlist.shuffle'];
    return control?.state.Bool || false;
  }

  get isRepeatOn() {
    const control = this.audioPlayerComponent?.controls?.['playlist.repeat'];
    return control?.state.Bool || false;
  }

  get isPlaylistActive(): boolean {
    const playlistValue = this.playlistDisplay;
    return playlistValue !== '' && playlistValue !== '<None>';
  }

  onRootChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const control = this.audioPlayerComponent?.controls?.['root'];
    if (control && target.value) {
      console.log(`[ROOT-CHANGE] Setting root to: "${target.value}"`);
      control.set(target.value);
      
      // Refresh choices for directory and filename after root change
      setTimeout(async () => {
        if (this.audioPlayerComponent) {
          await this.audioPlayerComponent.refreshControlChoices(['directory', 'filename']);
          
          // Force multiple change detection cycles
          this.cdr.detectChanges();
          await Promise.resolve(); // Allow micro-task to complete
          this.cdr.detectChanges();
        }
        
        // Log after a micro-task to ensure state is updated
        setTimeout(() => {
          const fileControl = this.audioPlayerComponent?.controls?.['filename'];
          const statusControl = this.audioPlayerComponent?.controls?.['status'];
          console.log(`[ROOT-CHANGE] File control state:`, {
            displayValue: this.fileDisplay,
            stateString: fileControl?.state.String,
            stateValue: fileControl?.state.Value,
            choices: fileControl?.state.Choices,
            status: statusControl?.state.String
          });
        }, 0);
      }, 300);
    }
  }

  onDirectoryChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const control = this.audioPlayerComponent?.controls?.['directory'];
    if (control && target.value) {
      console.log(`[DIR-CHANGE] Setting directory to: "${target.value}"`);
      control.set(target.value);
      
      // Refresh choices for filename after directory change
      setTimeout(async () => {
        if (this.audioPlayerComponent) {
          await this.audioPlayerComponent.refreshControlChoices(['filename']);
          
          // Force multiple change detection cycles
          this.cdr.detectChanges();
          await Promise.resolve(); // Allow micro-task to complete
          this.cdr.detectChanges();
        }
        
        // Log after a micro-task to ensure state is updated
        setTimeout(() => {
          const fileControl = this.audioPlayerComponent?.controls?.['filename'];
          const statusControl = this.audioPlayerComponent?.controls?.['status'];
          console.log(`[DIR-CHANGE] File control state:`, {
            displayValue: this.fileDisplay,
            stateString: fileControl?.state.String,
            stateValue: fileControl?.state.Value,
            choices: fileControl?.state.Choices,
            status: statusControl?.state.String
          });
        }, 0);
      }, 300);
    }
  }

  onFileChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const control = this.audioPlayerComponent?.controls?.['filename'];
    if (control && target.value) {
      console.log(`[FILE-CHANGE] Setting file to: "${target.value}"`);
      control.set(target.value);
    }
  }

  onPlaylistChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const control = this.audioPlayerComponent?.controls?.['playlist.file'];
    if (control && target.value) {
      console.log(`[PLAYLIST-CHANGE] Setting playlist to: "${target.value}"`);
      control.set(target.value);
    }
  }

  // Playback control methods
  play(): void {
    this.audioPlayerComponent?.controls?.['play']?.trigger();
  }

  pause(): void {
    this.audioPlayerComponent?.controls?.['pause']?.trigger();
  }

  stop(): void {
    this.audioPlayerComponent?.controls?.['stop']?.trigger();
  }

  // Momentary rewind control - press and hold to rewind
  rewindPress(): void {
    this.audioPlayerComponent?.controls?.['rewind']?.set(1);
  }

  rewindRelease(): void {
    this.audioPlayerComponent?.controls?.['rewind']?.set(0);
  }

  // Momentary fast forward control - press and hold to fast forward
  fastForwardPress(): void {
    this.audioPlayerComponent?.controls?.['fast.forward']?.set(1);
  }

  fastForwardRelease(): void {
    this.audioPlayerComponent?.controls?.['fast.forward']?.set(0);
  }

  // Playlist control methods
  playlistFirst(): void {
    this.audioPlayerComponent?.controls?.['playlist.first']?.trigger();
  }

  playlistPrev(): void {
    this.audioPlayerComponent?.controls?.['playlist.prev']?.trigger();
  }

  playlistNext(): void {
    this.audioPlayerComponent?.controls?.['playlist.next']?.trigger();
  }

  toggleShuffle(): void {
    const control = this.audioPlayerComponent?.controls?.['playlist.shuffle'];
    if (control) {
      control.set(control.state.Bool ? 0 : 1);
    }
  }

  toggleRepeat(): void {
    const control = this.audioPlayerComponent?.controls?.['playlist.repeat'];
    if (control) {
      control.set(control.state.Bool ? 0 : 1);
    }
  }

  toggleAutoPlay(): void {
    const control = this.audioPlayerComponent?.controls?.['play.on.startup'];
    if (control) {
      control.set(control.state.Bool ? 0 : 1);
    }
  }

  toggleMute(): void {
    const control = this.audioPlayerComponent?.controls?.['mute'];
    if (control) {
      // Q-SYS mute control: 0 = muted, 1 = unmuted, so invert toggle
      control.set(control.state.Bool ? 0 : 1);
    }
  }

  toggleLoop(): void {
    const control = this.audioPlayerComponent?.controls?.['loop'];
    if (control) {
      control.set(control.state.Bool ? 0 : 1);
    }
  }

  // Playlist browsing methods
  refresh(): void {
    this.playlistsService.loadPlaylists();
  }

  selectPlaylist(playlist: any): void {
    this.playlistsService.selectedPlaylist.set(playlist);
    if (playlist?.id) {
      this.playlistsService.loadPlaylistDetails(playlist.id);
    }
  }

  // Helper to format duration from seconds to MM:SS or HH:MM:SS
  formatDuration(seconds: number): string {
    if (!seconds || seconds < 0) return '0:00';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${minutes}:${String(secs).padStart(2, '0')}`;
  }
}
