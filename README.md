# Q-SYS Angular Components

Angular 20 components for building Q-SYS control interfaces using the QRWC (Q-SYS Remote WebSocket Control) protocol.

## Features

- 🔌 WebSocket-based connection to Q-SYS Core
- 🔄 Reactive control bindings using Angular signals
- 🎛️ Support for all Q-SYS control types (Text, Boolean, Trigger, Knob/Float, Integer)
- 🔍 MCP server integration for component/control discovery
- ⚡ Real-time control updates with configurable polling

## Prerequisites

Before using this library, ensure:

1. **Q-SYS Designer 10.0 or later** is installed
2. **Q-SYS Hardware or V-Core** is available (QRWC not supported in emulation mode)
3. **Script Access** is configured: All components must have `Script Access` property set to `All` or `External` in Q-SYS Designer
4. **QRWC Service** is enabled on the core: Core Manager > Network > Services > Management > Q-SYS Remote WebSocket Control

## Quick Start

### 1. Installation

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 20.3.8.

```bash
npm install
```

### 2. Configure Q-SYS Connection

Update the Q-SYS Core IP address in [src/app/components/qsys-example/qsys-example.ts](src/app/components/qsys-example/qsys-example.ts:42):

```typescript
this.qsysService.connect('YOUR_QSYS_CORE_IP');
```

### 3. Development Server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Using the MCP Server for Component Discovery

This project integrates with the `qrwc-svelte` MCP server to help you discover available Q-SYS components and controls. You can use Claude Code with the MCP server enabled to:

### List Available Components

Ask Claude: "What Q-SYS components are available?" or use the `get_components` MCP tool.

This will show you all components on your Q-SYS Core, for example:
- **Room Controls DEV** (57 controls)
- **Radio** (62 controls)
- **Interface_3** (167 controls)

### List Component Controls

Ask Claude: "What controls are available on the Room Controls DEV component?" or use the `get_controls` MCP tool with the component name.

This will show you all controls with their types and directions:
- **SystemPower** - Boolean (Read/Write)
- **VolumeFader** - Float (Read/Write)
- **VolumeMute** - Boolean (Read/Write)
- **MotionMode** - Text (Read/Write)

## Usage Guide

### Basic Setup

1. **Import the QSysService** in your component:

```typescript
import { QSysService } from './services/qsys.service';
import { QSysComponent } from './models/qsys-components';
```

2. **Connect to your Q-SYS Core**:

The service automatically appends `/qrc-public-api/v0` to the WebSocket URL.

```typescript
export class MyComponent implements OnInit {
  constructor(private qsysService: QSysService) {}

  ngOnInit(): void {
    // Simple connection with IP (connects to ws://192.168.1.100/qrc-public-api/v0)
    this.qsysService.connect('192.168.1.100');

    // Or with options
    this.qsysService.connect({
      coreIp: '192.168.1.100',
      redundantCoreIp: '192.168.1.101', // Optional
      secure: false, // true for wss://, false for ws://
      pollInterval: 35 // Polling interval in ms
    });
  }
}
```

3. **Access components and controls**:

```typescript
private setupComponents(): void {
  // Create component wrapper
  const roomComponent = new QSysComponent(this.qsysService, 'Room Controls');

  // Get controls (use MCP server to discover available controls)
  this.systemPower = roomComponent.useBoolean('SystemPower');
  this.volumeFader = roomComponent.useKnob('VolumeFader');
  this.volumeMute = roomComponent.useBoolean('VolumeMute');
  this.trackName = roomComponent.useText('Track');
}
```

### Control Types

#### Text Controls
```typescript
const trackName = component.useText('Track');
console.log(trackName.string()); // Access text value
trackName.setValue('New Track'); // Set text value
```

#### Boolean Controls
```typescript
const mute = component.useBoolean('Mute');
console.log(mute.state()); // Access boolean state
mute.setState(true); // Set state
mute.toggle(); // Toggle state
```

#### Button Controls
```typescript
const playButton = component.useButton('Play');
console.log(playButton.state()); // Access state
playButton.toggle(); // Toggle
playButton.press(); // Press button
playButton.release(); // Release button
```

#### Trigger Controls
```typescript
const next = component.useTrigger('Next');
next.trigger(); // Fire the trigger
```

#### Knob/Float Controls
```typescript
const volume = component.useKnob('Volume');
console.log(volume.value()); // Numeric value
console.log(volume.position()); // Normalized position (0-1)
console.log(volume.string()); // String representation
volume.setValue(50); // Set value
volume.setPosition(0.5, 2000); // Set position with 2s ramp
```

#### Integer Controls
```typescript
const count = component.useInteger('Count');
console.log(count.value()); // Integer value
count.setValue(42); // Set value
```

### Using Signals in Templates

All controls use Angular signals for reactivity:

```html
<!-- Boolean control -->
<button [class.active]="systemPower?.state()">
  {{ systemPower?.state() ? 'ON' : 'OFF' }}
</button>

<!-- Text control -->
<h2>{{ trackName?.string() || 'No Track' }}</h2>

<!-- Knob control with computed value -->
<input
  type="range"
  [value]="volumePercent()"
  (input)="setVolume($event)"
/>
```

### Connection Status

Check connection status using the signal:

```typescript
isConnected = this.qsysService.isConnected;
```

```html
@if (isConnected()) {
  <div>Connected to Q-SYS Core</div>
} @else {
  <div>Connecting...</div>
}
```

## Project Structure

```
src/app/
├── models/
│   ├── qsys-control.model.ts      # Type definitions
│   └── qsys-components.ts         # Control classes
├── services/
│   └── qsys.service.ts            # QRWC WebSocket service
└── components/
    └── qsys-example/              # Example component
```

## Example Component

See [src/app/components/qsys-example](src/app/components/qsys-example) for a complete working example that demonstrates:
- Connection status monitoring
- System power control
- Volume control with slider
- Mute button
- Text display

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory.

## Running Tests

To execute unit tests with the [Karma](https://karma-runner.github.io) test runner:

```bash
ng test
```

## Additional Resources

- [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli)
- [Q-SYS QRWC Protocol Documentation](https://q-syshelp.qsc.com/)
- [Angular Signals Documentation](https://angular.dev/guide/signals)
