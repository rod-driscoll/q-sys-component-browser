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

// Import custom view components
import { VolumeControlsComponent } from './volume-controls/volume-controls.component';
import { DisplayControlsComponent } from './display-controls/display-controls.component';
import { LightingControlsComponent } from './lighting-controls/lighting-controls.component';

// Import custom view metadata
import { VOLUME_CONTROLS_METADATA } from './volume-controls/volume-controls.metadata';
import { DISPLAY_CONTROLS_METADATA } from './display-controls/display-controls.metadata';
import { LIGHTING_CONTROLS_METADATA } from './lighting-controls/lighting-controls.metadata';

/**
 * Array of all custom view metadata
 * Used by CustomViewRegistryService to populate the menu
 */
export const CUSTOM_VIEW_METADATA = [
  VOLUME_CONTROLS_METADATA,
  DISPLAY_CONTROLS_METADATA,
  LIGHTING_CONTROLS_METADATA,
];

/**
 * Routes for all custom views
 * Used in app.routes.ts to configure routing
 */
export const CUSTOM_VIEW_ROUTES: Routes = [
  {
    path: VOLUME_CONTROLS_METADATA.route,
    component: VolumeControlsComponent,
    title: VOLUME_CONTROLS_METADATA.title
  },
  {
    path: DISPLAY_CONTROLS_METADATA.route,
    component: DisplayControlsComponent,
    title: DISPLAY_CONTROLS_METADATA.title
  },
  {
    path: LIGHTING_CONTROLS_METADATA.route,
    component: LightingControlsComponent,
    title: LIGHTING_CONTROLS_METADATA.title
  },
];
