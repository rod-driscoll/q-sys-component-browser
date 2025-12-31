# Custom Views Development Guide

This guide explains how to create custom views for the Q-SYS Angular Components application.

## What are Custom Views?

Custom views are specialized pages that display a curated selection of Q-SYS controls. Unlike the Component Browser which shows all components and controls, custom views filter and organize controls for specific use cases.

**Example Use Cases:**
- Volume Controls - All audio level and mute controls
- Display Controls - All monitor/screen controls
- Lighting Controls - All lighting and DMX controls
- Zone Controls - Controls for a specific room or zone

## Quick Start

To create a new custom view:

1. **Create a folder** in `src/app/custom-views/[view-name]/`
2. **Create component files** (TypeScript, HTML, CSS)
3. **Create metadata file** to define the view
4. **Register in index.ts** to make it available

## Step-by-Step Example

Let's create a "Zone Controls" view that displays all controls for components matching "Zone*":

### Step 1: Create Metadata File

**File:** `src/app/custom-views/zone-controls/zone-controls.metadata.ts`

```typescript
import { CustomViewMetadata } from '../../models/custom-view.model';

export const ZONE_CONTROLS_METADATA: CustomViewMetadata = {
  title: 'Zone Controls',
  description: 'Control all zone audio and settings',
  icon: '🎛️',
  route: 'zone-controls',
  order: 10
};
```

### Step 2: Create Component TypeScript

**File:** `src/app/custom-views/zone-controls/zone-controls.component.ts`

```typescript
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CustomViewBase } from '../../components/custom-views/base/custom-view-base.component';
import { NavigationHeaderComponent } from '../../components/custom-views/shared/navigation-header/navigation-header.component';
import { ControlCardComponent } from '../../components/custom-views/shared/control-card/control-card.component';
import { ControlSelectionConfig } from '../../models/custom-view.model';
import { ControlInfo } from '../../services/qsys-browser.service';
import { ZONE_CONTROLS_METADATA } from './zone-controls.metadata';

@Component({
  selector: 'app-zone-controls',
  imports: [CommonModule, NavigationHeaderComponent, ControlCardComponent],
  templateUrl: './zone-controls.component.html',
  styleUrl: './zone-controls.component.css'
})
export class ZoneControlsComponent extends CustomViewBase {
  readonly title = ZONE_CONTROLS_METADATA.title;

  protected getControlSelectionConfig(): ControlSelectionConfig[] {
    return [
      {
        method: 'componentPattern',
        componentPattern: 'Zone.*'
      }
    ];
  }

  async onValueChange(control: ControlInfo, value: any): Promise<void> {
    await this.handleValueChange(control, value);
  }

  async onPositionChange(control: ControlInfo, position: number): Promise<void> {
    await this.handlePositionChange(control, position);
  }
}
```

### Step 3: Create HTML Template

**File:** `src/app/custom-views/zone-controls/zone-controls.component.html`

```html
<div class="view-container">
  <app-navigation-header [title]="title" />

  <main class="view-content">
    @if (isLoading()) {
      <div class="loading-state">
        <div class="spinner"></div>
        <p>Loading zone controls...</p>
      </div>
    }
    @else if (error()) {
      <div class="error-state">
        <div class="error-icon">⚠️</div>
        <h2>Failed to load controls</h2>
        <p>{{ error() }}</p>
      </div>
    }
    @else if (controls().length === 0) {
      <div class="empty-state">
        <div class="empty-icon">🎛️</div>
        <h2>No zone controls found</h2>
        <p>No components matching zone patterns were found.</p>
      </div>
    }
    @else {
      <div class="controls-header">
        <h2>{{ controls().length }} Control{{ controls().length === 1 ? '' : 's' }}</h2>
      </div>

      <div class="controls-grid">
        @for (control of controls(); track control.componentName + ':' + control.name) {
          <app-control-card
            [control]="control"
            [showComponentName]="true"
            (valueChange)="onValueChange(control, $event)"
            (positionChange)="onPositionChange(control, $event)"
          />
        }
      </div>
    }
  </main>
</div>
```

### Step 4: Create CSS Styles

**File:** `src/app/custom-views/zone-controls/zone-controls.component.css`

You can copy the CSS from any existing custom view (e.g., `volume-controls.component.css`) as they all share the same structure.

### Step 5: Register in Index

**File:** `src/app/custom-views/index.ts`

Add your imports:
```typescript
import { ZoneControlsComponent } from './zone-controls/zone-controls.component';
import { ZONE_CONTROLS_METADATA } from './zone-controls/zone-controls.metadata';
```

Add to metadata array:
```typescript
export const CUSTOM_VIEW_METADATA = [
  // ... existing views
  ZONE_CONTROLS_METADATA,
];
```

Add to routes array:
```typescript
export const CUSTOM_VIEW_ROUTES: Routes = [
  // ... existing routes
  {
    path: ZONE_CONTROLS_METADATA.route,
    component: ZoneControlsComponent,
    title: ZONE_CONTROLS_METADATA.title
  },
];
```

That's it! Your custom view will now appear on the menu page.

## Control Selection Methods

The `getControlSelectionConfig()` method determines which controls appear in your view. You can use multiple selection methods:

### 1. Component Pattern Matching

Match components by name using regex patterns:

```typescript
{
  method: 'componentPattern',
  componentPattern: '.*Volume.*|.*Audio.*',  // Match Volume OR Audio
  controlPattern: 'Fader|Mute'               // Only Fader and Mute controls
}
```

### 2. Control Type Filtering

Select all controls of a specific type across all components:

```typescript
{
  method: 'controlType',
  controlType: 'Knob'  // All knob controls
}
```

Control types include: `Knob`, `Boolean`, `Float`, `Integer`, `Text`, `Combo box`, `Trigger`, etc.

### 3. Component Type Filtering

Select all controls from components of a specific type:

```typescript
{
  method: 'componentType',
  componentType: 'gain'  // All gain component controls
}
```

### 4. Explicit Component/Control Lists

Specify exact components and optionally specific controls:

```typescript
{
  method: 'explicitList',
  components: [
    { component: 'Zone1', controls: ['Volume', 'Mute'] },
    { component: 'Zone2' }  // All controls from Zone2
  ]
}
```

### Combining Methods

You can use multiple selection methods in a single view. They will be combined (union):

```typescript
protected getControlSelectionConfig(): ControlSelectionConfig[] {
  return [
    {
      method: 'componentPattern',
      componentPattern: 'Zone.*'
    },
    {
      method: 'explicitList',
      components: [
        { component: 'MasterVolume', controls: ['Fader'] }
      ]
    }
  ];
}
```

## Customizing Your View

### Custom Logic

Override methods in your component for custom behavior:

```typescript
export class MyCustomView extends CustomViewBase {
  // Override to add filtering logic
  protected async loadControls(): Promise<void> {
    await super.loadControls();

    // Filter or sort controls after loading
    const filtered = this.controls().filter(c => c.type === 'Knob');
    this.controls.set(filtered);
  }

  // Custom value change handling
  protected async handleValueChange(control: ControlInfo, value: any): Promise<void> {
    console.log(`Custom logic: ${control.name} = ${value}`);
    await super.handleValueChange(control, value);
  }
}
```

### Grouped Display

Organize controls by component:

```html
@for (component of groupedControls(); track component.name) {
  <div class="component-group">
    <h3>{{ component.name }}</h3>
    <div class="controls-grid">
      @for (control of component.controls; track control.name) {
        <app-control-card [control]="control" />
      }
    </div>
  </div>
}
```

## Best Practices

1. **Use Specific Patterns**: Narrow your component patterns to only include relevant controls
2. **Test Patterns**: Use the Component Browser to see what components exist before writing patterns
3. **Order Matters**: Set the `order` property in metadata to control menu positioning
4. **Reuse Styles**: Copy CSS from existing views for consistency
5. **Handle Empty State**: Always handle the case where no controls are found
6. **Descriptive Names**: Use clear, user-friendly titles and descriptions

## Available Control Types

Your custom views can display these control types:

- **Knob** - Rotary fader/slider with position and value
- **Boolean** - On/off toggle button
- **Float** - Floating point numeric input
- **Integer** - Integer numeric input
- **Text** - Text input field
- **Combo box** - Dropdown selection
- **Trigger** - Momentary push button
- **State Trigger** - Toggle button with state
- **Time** - Time value control
- **Status** - Read-only status display

## Architecture

```
custom-views/
├── index.ts                    # Central registration
├── README.md                   # This file
├── volume-controls/
│   ├── volume-controls.component.ts
│   ├── volume-controls.component.html
│   ├── volume-controls.component.css
│   └── volume-controls.metadata.ts
├── display-controls/
└── lighting-controls/
```

**Shared Components** (used by all views):
- `CustomViewBase` - Base class with control selection logic
- `NavigationHeaderComponent` - Header with back button and connection status
- `ControlCardComponent` - Card wrapper for individual controls

**Models**:
- `CustomViewMetadata` - View registration metadata
- `ControlSelectionConfig` - Control selection strategy
- `ControlInfo` - Control data structure (from QSysBrowserService)

## Troubleshooting

**Controls not appearing?**
- Check your component pattern is correct
- Verify components exist using the Component Browser
- Check the browser console for errors
- Ensure the component name is spelled correctly

**View not in menu?**
- Verify metadata is added to `CUSTOM_VIEW_METADATA` in `index.ts`
- Check that `order` property is set
- Verify the registry is initialized in `app.config.ts`

**Navigation not working?**
- Ensure route is added to `CUSTOM_VIEW_ROUTES` in `index.ts`
- Check route path matches metadata route
- Verify `app.routes.ts` imports and spreads `CUSTOM_VIEW_ROUTES`

**Real-time updates not working?**
- Base class automatically subscribes to updates
- Verify Q-SYS connection is active
- Check that `componentName` is set on controls
