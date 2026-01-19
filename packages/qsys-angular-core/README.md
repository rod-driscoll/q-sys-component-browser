# @anthropic-demo/qsys-angular-core

Angular services and models for Q-SYS Core communication via the QRWC (Q-SYS Remote WebSocket Control) protocol.

## Installation

```bash
npm install @anthropic-demo/qsys-angular-core
```

## Prerequisites

- Angular 20+
- Q-SYS Designer 10.0+
- Q-SYS Hardware or V-Core (QRWC not supported in emulation mode)
- QRWC Service enabled on Core

## Quick Start

### 1. Configure the module

```typescript
// app.config.ts
import { ApplicationConfig } from '@angular/core';
import { QSYS_CONFIG, QSysConfig } from '@anthropic-demo/qsys-angular-core';

const qsysConfig: QSysConfig = {
  coreIp: '192.168.1.100',
  corePort: 9091,
  secure: false,
  pollingInterval: 350
};

export const appConfig: ApplicationConfig = {
  providers: [
    { provide: QSYS_CONFIG, useValue: qsysConfig }
  ]
};
```

### 2. Connect to Q-SYS Core

```typescript
import { Component, OnInit, inject } from '@angular/core';
import { QSysService, AppInitializationService, waitForAppInit } from '@anthropic-demo/qsys-angular-core';

@Component({
  selector: 'app-root',
  template: `...`
})
export class AppComponent implements OnInit {
  private qsysService = inject(QSysService);
  private appInit = inject(AppInitializationService);

  async ngOnInit() {
    // Connect to Q-SYS Core
    await this.qsysService.connect({
      coreIp: '192.168.1.100',
      secure: false,
      pollInterval: 350
    });

    // Initialize app (discovery, Lua scripts)
    await this.appInit.initializeApp();
  }
}
```

### 3. Use controls in components

```typescript
import { Component, OnInit, inject } from '@angular/core';
import { QSysService, QSysComponent, waitForAppInit } from '@anthropic-demo/qsys-angular-core';

@Component({
  selector: 'app-room-controls',
  template: `
    <button (click)="mute?.toggle()">
      {{ mute?.state() ? 'Unmute' : 'Mute' }}
    </button>
    <input
      type="range"
      [value]="volume?.position() * 100"
      (input)="onVolumeChange($event)"
    />
  `
})
export class RoomControlsComponent implements OnInit {
  private qsysService = inject(QSysService);

  private roomComponent?: QSysComponent;
  mute?: BooleanControl;
  volume?: KnobControl;

  async ngOnInit() {
    // Wait for app initialization
    await waitForAppInit();

    // Create component wrapper
    this.roomComponent = new QSysComponent(this.qsysService, 'Room Controls');

    // Get typed controls
    this.mute = this.roomComponent.useBoolean('VolumeMute');
    this.volume = this.roomComponent.useKnob('VolumeFader');
  }

  onVolumeChange(event: Event) {
    const value = (event.target as HTMLInputElement).valueAsNumber / 100;
    this.volume?.setPosition(value);
  }
}
```

## API Reference

### Services

#### QSysService

Core service for QRWC WebSocket communication.

```typescript
// Connect to Q-SYS Core
await qsysService.connect({ coreIp: '192.168.1.100' });

// Get all components
const components = await qsysService.getComponents();

// Get controls for a component
const controls = await qsysService.getComponentControls('Room Controls');

// Set a control value
await qsysService.setControl('Room Controls', 'VolumeFader', 0.5);

// Subscribe to control updates
qsysService.getControlUpdates().subscribe(update => {
  console.log(`${update.component}.${update.control} = ${update.value}`);
});

// Connection status signal
const isConnected = qsysService.isConnected();
```

#### AppInitializationService

Orchestrates app-level initialization.

```typescript
// Initialize app (QRWC, discovery, Lua scripts)
await appInit.initializeApp();

// Check initialization status (signals)
appInit.initializationComplete();  // boolean
appInit.isInitializing();          // boolean
appInit.loadingStage();            // string
appInit.error();                   // string | null
```

#### AuthService

Manages Q-SYS Core authentication.

```typescript
// Login with credentials
await authService.login('username', 'password');

// Check authentication
authService.isAuthenticated();  // signal
authService.hasValidToken();    // boolean

// Get auth header for HTTP requests
const header = authService.getAuthHeader();
```

### Models

#### QSysComponent

Wrapper for accessing component controls with type safety.

```typescript
const component = new QSysComponent(qsysService, 'Component Name');

// Get typed controls
const textControl = component.useText('TextControlName');
const boolControl = component.useBoolean('BoolControlName');
const knobControl = component.useKnob('KnobControlName');
const triggerControl = component.useTrigger('TriggerName');
const intControl = component.useInteger('IntControlName');
const buttonControl = component.useButton('ButtonName');
```

#### Control Types

All controls use Angular signals for reactivity:

```typescript
// TextControl
textControl.string();           // current text value
textControl.setValue('text');   // set text

// BooleanControl
boolControl.state();            // true/false
boolControl.setState(true);     // set state
boolControl.toggle();           // toggle state

// KnobControl
knobControl.value();            // numeric value
knobControl.position();         // 0-1 normalized
knobControl.string();           // string representation
knobControl.setValue(50);       // set value
knobControl.setPosition(0.5);   // set normalized position

// TriggerControl
triggerControl.trigger();       // fire trigger

// IntegerControl
intControl.value();             // integer value
intControl.setValue(42);        // set value

// ButtonControl (extends Boolean)
buttonControl.press();          // press button
buttonControl.release();        // release button
```

### Helpers

#### waitForAppInit()

Wait for app initialization before using Q-SYS services.

```typescript
import { waitForAppInit } from '@anthropic-demo/qsys-angular-core';

// In component ngOnInit
async ngOnInit() {
  await waitForAppInit();
  // Safe to use Q-SYS services
}

// With custom timeout (default: 30s)
await waitForAppInit(undefined, 60000);
```

## Configuration

### QSysConfig Interface

```typescript
interface QSysConfig {
  coreIp: string;           // Q-SYS Core IP address
  corePort?: number;        // Port (default: 9091)
  defaultUsername?: string; // Default auth username
  defaultPassword?: string; // Default auth password
  secure?: boolean;         // Use wss:// (default: false)
  pollingInterval?: number; // Poll interval ms (default: 350)
}
```

## Important Notes

1. **Always wait for initialization** in custom views before using Q-SYS services
2. **Component names are case-sensitive** - must match Q-SYS Designer exactly
3. **Never create manual ChangeGroup polling loops** - QRWC handles this automatically
4. **QRWC not supported in emulation mode** - requires real Q-SYS hardware or V-Core

## Related

- [Q-SYS Component Browser](https://github.com/rod-driscoll/q-sys-component-browser) - Reference implementation
- [Q-SYS QRWC Documentation](https://q-syshelp.qsc.com/)
- [@q-sys/qrwc](https://www.npmjs.com/package/@q-sys/qrwc) - QRWC library

## License

MIT
