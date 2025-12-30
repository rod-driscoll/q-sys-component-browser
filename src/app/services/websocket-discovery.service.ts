import { Injectable, signal } from '@angular/core';
import { environment } from '../../environments/environment';

export interface DiscoveryMessage {
  type: string;
  data?: any;
  message?: string;
}

export interface DiscoveryData {
  timestamp: string;
  totalComponents: number;
  components: Array<{
    name: string;
    type: string;
    controlCount: number;
    controls: Array<any>;
    properties?: Array<any>;
    error?: string;
  }>;
}

export interface ComponentUpdate {
  type: 'componentUpdate';
  componentName: string;
  controls: Array<any>;
}

@Injectable({
  providedIn: 'root'
})
export class WebSocketDiscoveryService {
  private ws: WebSocket | null = null;
  private updatesWs: WebSocket | null = null;

  // Use getters to always reference current runtime IP
  private get wsUrl(): string {
    return environment.QSYS_WS_DISCOVERY_URL;
  }

  private get updatesUrl(): string {
    return environment.QSYS_WS_UPDATES_URL;
  }

  // Signals for reactive state
  public isConnected = signal<boolean>(false);
  public discoveryData = signal<DiscoveryData | null>(null);
  public error = signal<string | null>(null);
  public componentUpdate = signal<ComponentUpdate | null>(null);
  public connectionFailed = signal<boolean>(false);
  public loadingStage = signal<string>('');

  constructor() {}

  /**
   * Connect to the WebSocket discovery endpoint
   * Automatically receives full component discovery data on connection
   */
  connect(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected');
      return;
    }

    console.log('Connecting to WebSocket discovery endpoint:', this.wsUrl);
    this.loadingStage.set('Connecting to WebSocket...');
    this.ws = new WebSocket(this.wsUrl);

    this.ws.onopen = () => {
      console.log('✓ Connected to WebSocket discovery endpoint');
      this.isConnected.set(true);
      this.error.set(null);
      this.connectionFailed.set(false);
      this.loadingStage.set('✓ WebSocket connected, waiting for data...');
    };

    this.ws.onmessage = (event) => {
      try {
        const message: DiscoveryMessage = JSON.parse(event.data);
        console.log('Received WebSocket message:', message.type);

        if (message.type === 'discovery' && message.data) {
          console.log(`Received discovery data: ${message.data.totalComponents} components`);
          this.loadingStage.set(`Received ${message.data.totalComponents} components`);
          this.discoveryData.set(message.data);
        } else if (message.type === 'connected') {
          console.log('WebSocket acknowledged:', message.message);
          this.loadingStage.set('WebSocket connection acknowledged');
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
        this.error.set('Failed to parse discovery data');
        this.loadingStage.set('');
      }
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket discovery error:', error);
      this.error.set('Failed to connect to WebSocket server. Please ensure the WebSocket server script is loaded in a Q-SYS component.');
      this.isConnected.set(false);
      this.connectionFailed.set(true);
      this.loadingStage.set('');
    };

    this.ws.onclose = (event) => {
      console.log('WebSocket discovery connection closed', event.code, event.reason);
      this.isConnected.set(false);
      this.ws = null;
      this.loadingStage.set('');

      // If closed without ever connecting successfully, mark as failed
      if (!this.discoveryData()) {
        this.connectionFailed.set(true);
      }
    };
  }

  /**
   * Connect to the WebSocket updates endpoint
   * Receives real-time component control updates
   */
  connectUpdates(): void {
    if (this.updatesWs && this.updatesWs.readyState === WebSocket.OPEN) {
      console.log('Updates WebSocket already connected');
      return;
    }

    console.log('Connecting to WebSocket updates endpoint:', this.updatesUrl);
    this.updatesWs = new WebSocket(this.updatesUrl);

    this.updatesWs.onopen = () => {
      console.log('✓ Connected to WebSocket updates endpoint');
    };

    this.updatesWs.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log('Received update message:', message.type, message.componentName || '');

        if (message.type === 'componentUpdate') {
          console.log(`Component update: ${message.componentName} - ${message.controls?.length || 0} controls`);
          this.componentUpdate.set(message);
        } else if (message.type === 'connected') {
          console.log('Updates WebSocket acknowledged:', message.message);
        } else
          console.warn('Unknown update message type:', message.type);
      } catch (error) {
        console.error('Error parsing update message:', error);
      }
    };

    this.updatesWs.onerror = (error) => {
      console.error('Updates WebSocket error:', error);
    };

    this.updatesWs.onclose = () => {
      console.log('Updates WebSocket connection closed');
      this.updatesWs = null;
    };
  }

  /**
   * Disconnect from the WebSocket
   */
  disconnect(): void {
    if (this.ws) {
      console.log('Disconnecting WebSocket');
      this.ws.close();
      this.ws = null;
      this.isConnected.set(false);
    }
    if (this.updatesWs) {
      console.log('Disconnecting Updates WebSocket');
      this.updatesWs.close();
      this.updatesWs = null;
    }
  }

  /**
   * Reconnect to the WebSocket
   */
  reconnect(): void {
    this.disconnect();
    setTimeout(() => this.connect(), 500);
  }

  /**
   * Get discovery data (non-reactive)
   */
  getDiscoveryData(): DiscoveryData | null {
    return this.discoveryData();
  }
}
