# Q-SYS MCP Server Setup Guide

This guide explains how to use the Q-SYS MCP server with this Angular project to discover and interact with Q-SYS components.

## What is the MCP Server?

The MCP (Model Context Protocol) server for Q-SYS provides two key tools that help you discover what's available on your Q-SYS Core:

1. **get_components** - Lists all components available on your Q-SYS Core
2. **get_controls** - Lists all controls for a specific component with their types and directions

## Using the MCP Server with Claude Code

### 1. List Available Components

Ask Claude Code:
> "What Q-SYS components are available?"

Or use the tool directly in your conversation. This will return something like:

```
Components on Q-SYS Core:
- Room Controls DEV (57 controls)
- Radio (62 controls)
- Interface_3 (167 controls)
- Occupancy-01 (40 controls)
- etc...
```

### 2. Explore Component Controls

Ask Claude Code:
> "What controls are available on the Room Controls DEV component?"

This will return detailed information:

```
Controls for "Room Controls DEV":

SystemPower
  - Type: Boolean
  - Direction: Read/Write

VolumeFader
  - Type: Float
  - Direction: Read/Write

VolumeMute
  - Type: Boolean
  - Direction: Read/Write

MotionMode
  - Type: Text
  - Direction: Read/Write

... etc
```

## Creating Components in Your Angular App

Once you've discovered the controls you need, you can use them in your Angular components:

### Step 1: Connect to Q-SYS Core

The service automatically appends the `/qrc-public-api/v0` path to the WebSocket URL.

```typescript
import { QSysService } from './services/qsys.service';

export class MyComponent implements OnInit {
  constructor(private qsysService: QSysService) {}

  ngOnInit(): void {
    // Simple connection - connects to ws://YOUR_IP/qrc-public-api/v0
    this.qsysService.connect('YOUR_QSYS_CORE_IP');
  }
}
```

### Step 2: Create a Component Wrapper

```typescript
import { QSysComponent } from './models/qsys-components';

private setupComponents(): void {
  // Use the component name from get_components
  const roomComponent = new QSysComponent(
    this.qsysService,
    'Room Controls DEV'
  );
}
```

### Step 3: Bind to Controls

Use the control names and types from get_controls:

```typescript
// Boolean controls
this.systemPower = roomComponent.useBoolean('SystemPower');
this.volumeMute = roomComponent.useBoolean('VolumeMute');

// Float/Knob controls
this.volumeFader = roomComponent.useKnob('VolumeFader');

// Text controls
this.motionMode = roomComponent.useText('MotionMode');

// Trigger controls
this.nextTrack = roomComponent.useTrigger('Next');
```

### Step 4: Use in Templates

All controls expose reactive signals:

```html
<!-- Boolean control -->
<button [class.active]="systemPower?.state()">
  {{ systemPower?.state() ? 'ON' : 'OFF' }}
</button>

<!-- Knob control -->
<input
  type="range"
  [value]="volumeFader?.position() * 100"
  (input)="setVolume($event)"
/>

<!-- Text control -->
<p>{{ motionMode?.string() }}</p>

<!-- Trigger control -->
<button (click)="nextTrack?.trigger()">Next</button>
```

## Control Type Reference

### Boolean Control
- **Properties**: `state()` - Boolean signal
- **Methods**: `setState(value)`, `toggle()`
- **Use case**: On/off switches, toggles

### Button Control (extends Boolean)
- **Properties**: `state()` - Boolean signal
- **Methods**: `press()`, `release()`, `toggle()`
- **Use case**: Momentary buttons, UI controls

### Text Control
- **Properties**: `string()` - String signal
- **Methods**: `setValue(value)`
- **Use case**: Labels, status displays, text input

### Knob/Float Control
- **Properties**:
  - `value()` - Numeric value signal
  - `position()` - Normalized 0-1 position signal
  - `string()` - Formatted string signal
- **Methods**: `setValue(value, ramp?)`, `setPosition(position, ramp?)`
- **Use case**: Volume, gain, sliders, faders

### Integer Control
- **Properties**: `value()` - Integer signal
- **Methods**: `setValue(value)`
- **Use case**: Counters, indices

### Trigger Control
- **Properties**: None (write-only)
- **Methods**: `trigger()`
- **Use case**: Execute actions, fire events

## Example Workflow

1. **Discover components** using `get_components`
2. **Inspect controls** for your chosen component using `get_controls`
3. **Create the component** in your Angular code
4. **Bind to controls** using the appropriate control type methods
5. **Use in templates** with Angular signals

## Tips

- Always check the **Direction** of controls (Read/Write, Read Only, Write Only)
- Use the **Type** information to choose the right control method (`useBoolean`, `useText`, `useKnob`, etc.)
- Control names are **case-sensitive** - use them exactly as shown by the MCP server
- Some controls have dots in their names (e.g., `Elapsed.Time`) - this is normal

## Current MCP Server Connection

Your MCP server is currently connected to a Q-SYS Core and showing these components:

- Motion Test Enable (1 control)
- Room Controls DEV (57 controls)
- UCI Text Helper (52 controls)
- Room 1 controller (61 controls)
- dev (18 controls)
- Occupancy-01 (40 controls)
- Snapshot_Controller_Overflow (51 controls)
- Radio (62 controls)
- TCC2 Call Sync (22 controls)
- Gain_BGM (9 controls)
- Mono Suimmer (13 controls)
- PGM (9 controls)
- Runtime changelog (1 control)
- Interface_2 (28 controls)
- UCI Script 03 (28 controls)
- Interface_3 (167 controls)

You can explore any of these by asking Claude Code about their controls!
