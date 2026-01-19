# Claude Code Instructions

This file provides context for AI assistants working on this codebase.

## Project Overview

**Q-SYS Component Browser** - An Angular 20 application for building Q-SYS audio/video control interfaces using the QRWC (Q-SYS Remote WebSocket Control) protocol.

## Documentation Location

All documentation is in the `docs/` folder. Key files:

- `docs/README.md` - **Documentation index** (start here)
- `docs/ARCHITECTURE.md` - System architecture and design decisions
- `docs/APP-LEVEL-DISCOVERY-ARCHITECTURE.md` - App initialization pattern (critical for custom views)
- `docs/TROUBLESHOOTING.md` - Common issues and solutions
- `docs/DEPLOY.md` - Deployment to Q-SYS Core and Crestron touchpanels

## Key Technical Concepts

### QRWC (Q-SYS Remote WebSocket Control)

- WebSocket-based protocol for communicating with Q-SYS Core processors
- Uses ChangeGroups for efficient polling of control values
- Connection via `ws://[CORE-IP]/qrc` or `wss://[CORE-IP]/qrc`

### ChangeGroup Polling

- Q-SYS mechanism for receiving control value updates
- QRWC library handles polling automatically (350ms default)
- On reconnection, a NEW ChangeGroup is created - components must re-register

### App Initialization Pattern

**Critical for custom views:** All custom view components must wait for app initialization:

```typescript
private appInit = inject(AppInitializationService);

ngOnInit(): void {
  this.waitForAppInit().then(() => {
    // Safe to use Q-SYS services here
  });
}
```

See `docs/APP-LEVEL-DISCOVERY-ARCHITECTURE.md` for details.

## Project Structure

```text
src/app/
├── services/
│   ├── qsys.service.ts              # QRWC connection management
│   └── app-initialization.service.ts # App-level initialization
├── models/
│   └── qsys-components.ts           # QSysComponent, control types
├── components/
│   └── qsys-browser/                # Component browser UI
└── custom-views/                    # Custom control pages
    ├── file-browser/
    ├── named-controls/
    └── media-playlists/

docs/                                # All documentation
lua/                                 # Q-SYS Lua scripts
```

## Common Tasks

### Adding a New Custom View

1. Create component in `src/app/custom-views/`
2. Inject `AppInitializationService`
3. Call `waitForAppInit()` in `ngOnInit()` before accessing Q-SYS services
4. Add route in `app.routes.ts`

### Working with Q-SYS Controls

```typescript
// Get a component
const component = new QSysComponent(qsysService, 'Component Name');

// Use controls
const mute = component.useBoolean('MuteControl');
const volume = component.useKnob('VolumeControl');
const text = component.useText('TextControl');

// Read values (Angular signals)
console.log(mute.state());
console.log(volume.value());

// Set values
mute.setState(true);
volume.setValue(50);
```

### Build Commands

```bash
npm install          # Install dependencies
ng serve             # Development server (localhost:4200)
ng build             # Production build
npm run ch5-archive  # Build for Crestron touchpanels
npm run deploy       # Deploy to Q-SYS Core
```

## Important Warnings

1. **Never create manual ChangeGroup polling loops** - QRWC handles this automatically
2. **Always wait for app initialization** in custom views before using Q-SYS services
3. **Component names are case-sensitive** - must match Q-SYS Designer exactly
4. **Lua timers must be global scope** - see `docs/LUA-SCRIPTING-BEST-PRACTICES.md`

## Troubleshooting

Common issues are documented in `docs/TROUBLESHOOTING.md`:

- "Change group does not exist" errors
- Controls not updating
- Connection issues
- Crestron black screen (see `docs/CRESTRON-DEBUGGING.md`)

## MCP Integration

This project has MCP tools available:

- `get_components` - List all Q-SYS components
- `get_controls` - Get controls for a specific component

These can be used to discover available components and their controls on the connected Q-SYS Core.
