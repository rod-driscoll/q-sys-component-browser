import { Injectable, signal } from '@angular/core';

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

@Injectable({
  providedIn: 'root'
})
export class WebSocketDiscoveryService {
  private ws: WebSocket | null = null;
  private readonly wsUrl = 'ws://192.168.104.227:9091/ws/discovery';

  // Signals for reactive state
  public isConnected = signal<boolean>(false);
  public discoveryData = signal<DiscoveryData | null>(null);
  public error = signal<string | null>(null);

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
    this.ws = new WebSocket(this.wsUrl);

    this.ws.onopen = () => {
      console.log('✓ Connected to WebSocket discovery endpoint');
      this.isConnected.set(true);
      this.error.set(null);
    };

    this.ws.onmessage = (event) => {
      try {
        const message: DiscoveryMessage = JSON.parse(event.data);
        console.log('Received WebSocket message:', message.type);

        if (message.type === 'discovery' && message.data) {
          console.log(`Received discovery data: ${message.data.totalComponents} components`);
          this.discoveryData.set(message.data);
        } else if (message.type === 'connected') {
          console.log('WebSocket acknowledged:', message.message);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
        this.error.set('Failed to parse discovery data');
      }
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.error.set('WebSocket connection error');
      this.isConnected.set(false);
    };

    this.ws.onclose = () => {
      console.log('WebSocket connection closed');
      this.isConnected.set(false);
      this.ws = null;
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
