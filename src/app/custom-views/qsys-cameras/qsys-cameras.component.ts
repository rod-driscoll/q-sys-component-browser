import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationHeaderComponent } from '../../components/custom-views/shared/navigation-header/navigation-header.component';
import { QsysCamerasCard } from './qsys-cameras-card/qsys-cameras-card';
import { QrwcAdapterService } from '../room-controls/services/qrwc-adapter.service';
import { QSYS_CAMERAS_METADATA } from './qsys-cameras.metadata';

/**
 * Q-SYS ONVIF Cameras custom view
 * Automatically discovers and controls all ONVIF camera components (onvif_camera_operative type)
 */
@Component({
  selector: 'app-qsys-cameras',
  imports: [CommonModule, NavigationHeaderComponent, QsysCamerasCard],
  providers: [QrwcAdapterService],
  templateUrl: './qsys-cameras.component.html',
  styleUrl: './qsys-cameras.component.css',
})
export class QsysCamerasComponent {
  readonly metadata = QSYS_CAMERAS_METADATA;

  constructor() {}
}
