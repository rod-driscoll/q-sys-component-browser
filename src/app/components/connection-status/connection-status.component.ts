import { Component, ChangeDetectionStrategy, inject, computed, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { QSysService } from '../../services/qsys.service';
import { ConnectionStatusService } from './connection-status.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-connection-status',
  imports: [CommonModule, FormsModule],
  templateUrl: './connection-status.component.html',
  styleUrl: './connection-status.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ConnectionStatusComponent implements OnInit, OnDestroy {
  private qsysService = inject(QSysService);
  protected connectionService = inject(ConnectionStatusService);

  // Connection state from Q-SYS service
  protected isConnected = this.qsysService.isConnected;

  // Show banner when not connected
  protected showBanner = computed(() => !this.isConnected());

  // Latency monitoring
  private latencyUpdateInterval: ReturnType<typeof setInterval> | null = null;
  protected latency = signal(0);
  protected pollInterval = signal(350);

  // Dragging state
  protected isDragging = signal(false);
  protected position = signal({ x: 0, y: 10 }); // Top right by default (x: 0 means right-aligned)
  private dragStartPos = { x: 0, y: 0 };
  private elementStartPos = { x: 0, y: 0 };

  // Latency quality indicator (green/yellow/orange/red)
  protected latencyQuality = computed(() => {
    const lat = this.latency();
    if (lat === 0) return 'unknown';
    if (lat < 100) return 'excellent';
    if (lat < 300) return 'good';
    if (lat < 500) return 'moderate';
    return 'poor';
  });

  // Show latency indicator when connected
  protected showLatencyIndicator = computed(() => this.isConnected() && this.latency() > 0);

  // Connection info for display
  protected connectionInfo = computed(() => this.connectionService.getConnectionInfo());

  // Dialog state
  protected showDialog = this.connectionService.showSettingsDialog;

  // Form fields
  protected formIp = signal(environment.RUNTIME_CORE_IP);
  protected formUsername = signal(environment.RUNTIME_USERNAME);
  protected formPassword = signal(environment.RUNTIME_PASSWORD);

  openSettings(): void {
    // Reset form to current values when opening
    this.formIp.set(environment.RUNTIME_CORE_IP);
    this.formUsername.set(environment.RUNTIME_USERNAME);
    this.formPassword.set(environment.RUNTIME_PASSWORD);
    this.connectionService.openSettings();
  }

  closeSettings(): void {
    this.connectionService.closeSettings();
  }

  applySettings(): void {
    this.connectionService.applySettings(
      this.formIp(),
      this.formUsername(),
      this.formPassword()
    );
  }

  updateIp(event: Event): void {
    this.formIp.set((event.target as HTMLInputElement).value);
  }

  updateUsername(event: Event): void {
    this.formUsername.set((event.target as HTMLInputElement).value);
  }

  updatePassword(event: Event): void {
    this.formPassword.set((event.target as HTMLInputElement).value);
  }

  // Drag handlers
  onDragStart(event: MouseEvent): void {
    this.isDragging.set(true);
    this.dragStartPos = { x: event.clientX, y: event.clientY };
    this.elementStartPos = { ...this.position() };
    event.preventDefault();
  }

  onDragMove(event: MouseEvent): void {
    if (!this.isDragging()) return;

    const deltaX = this.dragStartPos.x - event.clientX;
    const deltaY = event.clientY - this.dragStartPos.y;

    this.position.set({
      x: Math.max(0, this.elementStartPos.x + deltaX),
      y: Math.max(0, this.elementStartPos.y + deltaY)
    });
  }

  onDragEnd(): void {
    this.isDragging.set(false);
  }

  ngOnInit(): void {
    // Update latency display every 2 seconds
    this.latencyUpdateInterval = setInterval(() => {
      this.latency.set(Math.round(this.qsysService.getAverageLatency()));
      this.pollInterval.set(this.qsysService.getCurrentPollInterval());
    }, 2000);

    // Add global mouse listeners for dragging
    document.addEventListener('mousemove', this.handleGlobalMouseMove);
    document.addEventListener('mouseup', this.handleGlobalMouseUp);
  }

  ngOnDestroy(): void {
    if (this.latencyUpdateInterval) {
      clearInterval(this.latencyUpdateInterval);
      this.latencyUpdateInterval = null;
    }
    // Remove global mouse listeners
    document.removeEventListener('mousemove', this.handleGlobalMouseMove);
    document.removeEventListener('mouseup', this.handleGlobalMouseUp);
  }

  private handleGlobalMouseMove = (event: MouseEvent) => {
    this.onDragMove(event);
  };

  private handleGlobalMouseUp = () => {
    this.onDragEnd();
  };
}
