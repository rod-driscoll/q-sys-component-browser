# Q-SYS Component Browser

Angular 20 components for building Q-SYS control interfaces using the QRWC (Q-SYS Remote WebSocket Control) protocol.

## Features

- 🔌 WebSocket-based connection to Q-SYS Core
- 🔄 Reactive control bindings using Angular signals
- 🎛️ Support for all Q-SYS control types (Text, Boolean, Trigger, Knob/Float, Integer)
- 🔍 MCP server integration for component/control discovery
- ⚡ Real-time control updates with configurable polling
- 🗂️ **Component Browser**: Browse and edit all components and controls in your Q-SYS design
  - Three-view interface: Components → Controls → Editor
  - Search and filter capabilities
  - Type-specific control editors (Boolean toggles, numeric inputs with ramp, text fields)

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

Update the Q-SYS Core IP address in [src/environments/environment.ts](src/environments/environment.ts):

```typescript
export const environment = {
  production: false,

  // Change this IP address to match your Q-SYS Core
  QSYS_CORE_IP: '192.168.104.220',
  QSYS_CORE_PORT: 9091,

  // ... rest of configuration
};
```

This is the single source of truth for all Q-SYS Core connection settings (WebSocket discovery, HTTP API, and QRWC connections).

### 3. Development Server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Component Browser

The application includes a **Q-SYS Component Browser** that allows you to browse and edit all components and controls in your Q-SYS design.

### Features

- **Component List**: View all available components with search/filter
- **Control List**: View all controls for a selected component
- **Control Editor**: Edit control values with type-specific inputs
  - Boolean: On/Off toggle buttons
  - Float/Integer: Number input with optional ramp time
  - Text: Text input field

### Loading Components and Controls

After the app loads and connects to Q-SYS Core, you can populate the browser using MCP tools:

1. **Load all components** - Use the `get_components` MCP tool, then pass the data to the browser:
   ```javascript
   // In browser console:
   window.qsysBrowser.setComponentsFromMCP([
     { name: "Room Controls DEV", controlCount: 57 },
     { name: "Radio", controlCount: 62 },
     // ... more components from MCP tool
   ]);
   ```

2. **Load controls** - Select a component, then use `get_controls(componentName)` MCP tool:
   ```javascript
   // In browser console:
   window.qsysBrowser.setControlsFromMCP([
     { name: "SystemOnOff", type: "Boolean", direction: "Read/Write", value: 1 },
     { name: "VolumeFader", type: "Float", direction: "Read/Write", value: 75.5 },
     // ... more controls from MCP tool
   ]);
   ```

See [BROWSER-USAGE.md](BROWSER-USAGE.md) for detailed usage instructions.

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
      pollInterval: 350 // Polling interval in ms
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

## Deployment

### Q-SYS Core Deployment

The project includes a deployment script that uploads the built application to a Q-SYS Core's internal storage.

**Important Limitations:**

The Q-SYS Lua HTTP server (used by the included TunnelDiscovery.lua) has a TcpSocket buffer limitation that prevents reliable transfer of files larger than approximately 65KB.

- ✅ **Initial page load**: Works reliably (main.js is 29KB with lazy loading)
- ⚠️ **Large lazy-loaded chunks**: May fail to load (e.g., Angular Material vendor chunk at 273KB)
- ℹ️ **Native Q-SYS web server**: Does not support serving custom applications

### Deployment Options

#### Option 1: Q-SYS Core Internal Deployment (Recommended for Development)

Best for development and simple applications without large dependencies.

1. Create `.env.deploy` file:
```bash
QSYS_CORE_IP=192.168.104.220
QSYS_CORE_USERNAME=your-username    # Optional for auth cores
QSYS_CORE_PASSWORD=your-password    # Optional for auth cores
DEPLOY_PATH=/media/ui
```

2. Deploy:
```bash
npm run deploy
```

3. Access at: `http://[CORE-IP]:9091/index.html`

**Limitations**: Large lazy-loaded components (QSys Browser with Angular Material) may fail to load due to the 65KB file size limitation.

#### Option 2: External Web Server (Recommended for Production)

For production deployments or when using components with large dependencies (Angular Material), serve the application from an external web server:

1. Build the application:
```bash
ng build
```

2. Deploy `dist/q-sys-component-browser/browser/` to your web server (Apache, Nginx, IIS, etc.)

3. Configure CORS on your Q-SYS Core to allow requests from your web server's domain

4. Access the application from your web server's URL

**Advantages**:
- No file size limitations
- Better performance for larger applications
- Can use CDN for static assets
- Standard web server features (compression, caching, etc.)

### Progressive Web App (PWA)

The application is configured as a PWA and can be installed on devices for offline access. The service worker caches all application files for offline use.

**Note**: When using PWA mode from Q-SYS Core deployment, large lazy-loaded chunks may fail to cache due to the file size limitation.

## Running Tests

To execute unit tests with the [Karma](https://karma-runner.github.io) test runner:

```bash
ng test
```

## Additional Resources

- [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli)
- [Q-SYS QRWC Protocol Documentation](https://q-syshelp.qsc.com/)
- [Angular Signals Documentation](https://angular.dev/guide/signals)
