import { Injectable, signal } from '@angular/core';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export interface MediaPlaylistItem {
  id: string;
  name: string;
  type?: string;
  duration?: number;
  [key: string]: unknown;
}

export interface MediaPlaylist {
  id: string;
  name: string;
  description?: string;
  items?: MediaPlaylistItem[];
  [key: string]: unknown;
}

@Injectable({
  providedIn: 'root'
})
export class MediaPlaylistsService {
  playlists = signal<MediaPlaylist[]>([]);
  selectedPlaylist = signal<MediaPlaylist | null>(null);
  isLoading = signal(false);
  error = signal<string | null>(null);

  constructor(private authService: AuthService) {}

  private get baseUrl(): string {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return '/api/v0/cores/self/media_playlists';
    }
    return `https://${environment.RUNTIME_CORE_IP}/api/v0/cores/self/media_playlists`;
  }

  private buildHeaders(): HeadersInit {
    const headers: HeadersInit = {
      Accept: 'application/json',
      ...this.authService.getAuthHeader()
    };

    // Add Host headers in dev so proxy can target the Core
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      headers['X-Qsys-Host'] = environment.RUNTIME_CORE_IP;
    }

    return headers;
  }

  private async fetchJson(path: string): Promise<any> {
    const url = path ? `${this.baseUrl}/${path}` : `${this.baseUrl}`;
    const headers = this.buildHeaders();

    const doFetch = async () => fetch(url, { method: 'GET', headers });

    let response = await doFetch();

    // Attempt login + retry once on 401
    if (response.status === 401) {
      try {
        await this.authService.login(this.authService.username(), this.authService.password());
        Object.assign(headers, this.authService.getAuthHeader());
        response = await doFetch();
      } catch (error) {
        console.error('[MEDIA-PLAYLISTS] Login retry failed:', error);
      }
    }

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HTTP ${response.status}: ${response.statusText} - ${text}`);
    }

    return response.json();
  }

  async loadPlaylists(): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);

    try {
      const data = await this.fetchJson('');
      // API returns either an array or an object with a data/playlists property depending on version
      const playlists: MediaPlaylist[] = Array.isArray(data)
        ? data as MediaPlaylist[]
        : (data?.playlists || data?.data || []);

      this.playlists.set(playlists || []);
      if (playlists && playlists.length > 0) {
        this.selectedPlaylist.set(playlists[0]);
      } else {
        this.selectedPlaylist.set(null);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load playlists';
      console.error('[MEDIA-PLAYLISTS] Load playlists failed:', message);
      this.error.set(message);
    } finally {
      this.isLoading.set(false);
    }
  }

  async loadPlaylistDetails(playlistId: string): Promise<void> {
    if (!playlistId) return;

    this.isLoading.set(true);
    this.error.set(null);

    try {
      const data = await this.fetchJson(playlistId);
      this.selectedPlaylist.set(data as MediaPlaylist);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load playlist details';
      console.error('[MEDIA-PLAYLISTS] Load playlist failed:', message);
      this.error.set(message);
    } finally {
      this.isLoading.set(false);
    }
  }
}
