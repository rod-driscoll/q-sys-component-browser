/**
 * Custom Views Index
 *
 * This file is the central registration point for all custom views.
 * To add a new custom view:
 * 1. Create the view component and metadata in a new folder under custom-views/
 * 2. Import the component and metadata here
 * 3. Add the metadata to CUSTOM_VIEW_METADATA array
 * 4. Add the route to CUSTOM_VIEW_ROUTES array
 */

import { Routes } from '@angular/router';

// Import custom view metadata (metadata files are small, keep eagerly loaded)
import { VOLUME_CONTROLS_METADATA } from './volume-controls/volume-controls.metadata';
import { DISPLAY_CONTROLS_METADATA } from './display-controls/display-controls.metadata';
import { LIGHTING_CONTROLS_METADATA } from './lighting-controls/lighting-controls.metadata';
import { CAMERA_CONTROLS_METADATA } from './camera-controls/camera-controls.metadata';
import { QSYS_CAMERAS_METADATA } from './qsys-cameras/qsys-cameras.metadata';
import { ROOM_CONTROLS_METADATA } from './room-controls/room-controls.metadata';

/**
 * Array of all custom view metadata
 * Used by CustomViewRegistryService to populate the menu
 */
export const CUSTOM_VIEW_METADATA = [
  VOLUME_CONTROLS_METADATA,
  DISPLAY_CONTROLS_METADATA,
  LIGHTING_CONTROLS_METADATA,
  CAMERA_CONTROLS_METADATA,
  QSYS_CAMERAS_METADATA,
  ROOM_CONTROLS_METADATA,
];

/**
 * Routes for all custom views with lazy loading
 * Components are loaded on-demand to reduce initial bundle size
 */
export const CUSTOM_VIEW_ROUTES: Routes = [
  {
    path: VOLUME_CONTROLS_METADATA.route,
    loadComponent: () => import('./volume-controls/volume-controls.component').then(m => m.VolumeControlsComponent),
    title: VOLUME_CONTROLS_METADATA.title
  },
  {
    path: DISPLAY_CONTROLS_METADATA.route,
    loadComponent: () => import('./display-controls/display-controls.component').then(m => m.DisplayControlsComponent),
    title: DISPLAY_CONTROLS_METADATA.title
  },
  {
    path: LIGHTING_CONTROLS_METADATA.route,
    loadComponent: () => import('./lighting-controls/lighting-controls.component').then(m => m.LightingControlsComponent),
    title: LIGHTING_CONTROLS_METADATA.title
  },
  {
    path: CAMERA_CONTROLS_METADATA.route,
    loadComponent: () => import('./camera-controls/camera-controls.component').then(m => m.CameraControlsComponent),
    title: CAMERA_CONTROLS_METADATA.title
  },
  {
    path: QSYS_CAMERAS_METADATA.route,
    loadComponent: () => import('./qsys-cameras/qsys-cameras.component').then(m => m.QsysCamerasComponent),
    title: QSYS_CAMERAS_METADATA.title
  },
  {
    path: ROOM_CONTROLS_METADATA.route,
    loadComponent: () => import('./room-controls/room-controls.component').then(m => m.RoomControlsComponent),
    title: ROOM_CONTROLS_METADATA.title
  },
];
