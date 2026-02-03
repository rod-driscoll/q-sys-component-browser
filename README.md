# Q-SYS Component Browser

Angular 20 application for building Q-SYS control interfaces using the QRWC (Q-SYS Remote WebSocket Control) protocol.

## Features

- WebSocket-based connection to Q-SYS Core via QRWC protocol
- Reactive control bindings using Angular signals
- Support for all Q-SYS control types (Text, Boolean, Trigger, Knob/Float, Integer, Combo Box)
- MCP server integration for component/control discovery
- Real-time control updates with configurable polling
- **Component Browser**: Browse and edit all components and controls in your Q-SYS design
- **PWA Support**: Installable as Progressive Web App with offline caching

## Quick Start

### Prerequisites

1. **Q-SYS Designer 10.0+** installed
2. **Q-SYS Hardware or V-Core** (QRWC not supported in emulation mode)
3. **Script Access** configured: Components must have `Script Access` set to `All` or `External`
4. **QRWC Service** enabled: Core Manager > Network > Services > Management > Q-SYS Remote WebSocket Control

### Installation

```bash
npm install
```

### Configuration

Update the Q-SYS Core settings in [src/environments/environment.ts](src/environments/environment.ts):

```typescript
export const environment = {
  production: false,
  QSYS_CORE_IP: '192.168.104.220',  // Your Q-SYS Core IP
  QRWC_USE_SECURE: true,            // true = wss:// (port 443), false = ws:// (port 80)
};
```

> **SSL Certificate Issues?** If you get connection errors with self-signed certificates, set `QRWC_USE_SECURE: false` to use unencrypted WebSocket, or accept the certificate in your browser by visiting `https://[CORE_IP]` first.

### Network Connections

This app uses **two separate WebSocket connections** to Q-SYS Core:

| Connection | URL | Purpose |
|------------|-----|---------|
| **QRWC** | `wss://[IP]/qrc` or `ws://[IP]/qrc` | Q-SYS Remote WebSocket Control - main protocol for control updates and RPC |
| **Lua Server** | `ws://[IP]:9091` | TunnelDiscovery.lua HTTP API and legacy WebSocket for file browser |

- **QRWC**: Controlled by `QRWC_USE_SECURE` setting. Uses port 443 for `wss://` or port 80 for `ws://`.
- **Lua Server**: Port 9091 (configurable via `LUA_SERVER_PORT`). Requires `TunnelDiscovery.lua` loaded on a Script component.

### Development

```bash
ng serve
```

Open `http://localhost:4200/` in your browser.

### Build

```bash
ng build
```

## Documentation

All documentation is located in the [docs/](docs/) folder:

### Getting Started

| Document | Description |
|----------|-------------|
| [docs/README.md](docs/README.md) | **Documentation index** - Start here for navigation |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System architecture, ChangeGroup polling, design decisions |
| [docs/APP-LEVEL-DISCOVERY-ARCHITECTURE.md](docs/APP-LEVEL-DISCOVERY-ARCHITECTURE.md) | App initialization pattern - **required reading for custom views** |

### Deployment

| Document | Description |
|----------|-------------|
| [docs/DEPLOY.md](docs/DEPLOY.md) | Deploy to Q-SYS Core and Crestron touchpanels |
| [docs/GITHUB-PAGES.md](docs/GITHUB-PAGES.md) | GitHub Pages deployment via Actions |

### Troubleshooting & Debugging

| Document | Description |
|----------|-------------|
| [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) | Common issues and solutions |
| [docs/CRESTRON-DEBUGGING.md](docs/CRESTRON-DEBUGGING.md) | Debugging on Crestron touchpanels (includes Eruda) |
| [docs/changegroup-reconnection-fix.md](docs/changegroup-reconnection-fix.md) | ChangeGroup reconnection issue deep dive |

### Development Guides

| Document | Description |
|----------|-------------|
| [docs/LUA-SCRIPTING-BEST-PRACTICES.md](docs/LUA-SCRIPTING-BEST-PRACTICES.md) | Lua scripting for Q-SYS (timers, scope, patterns) |
| [docs/Q-SYS-COMBO-BOX-PATTERN.md](docs/Q-SYS-COMBO-BOX-PATTERN.md) | Working with combo box controls |
| [docs/WEBSOCKET-DISCOVERY.md](docs/WEBSOCKET-DISCOVERY.md) | WebSocket-based component discovery |
| [docs/SECURE_DISCOVERY_WALKTHROUGH.md](docs/SECURE_DISCOVERY_WALKTHROUGH.md) | Secure tunnel setup via control-based communication |

### Reference

| Document | Description |
|----------|-------------|
| [docs/IMPLEMENTATION-LOG.md](docs/IMPLEMENTATION-LOG.md) | Historical development log and decisions |

## Project Structure

```text
src/app/
├── models/
│   ├── qsys-control.model.ts      # Type definitions
│   └── qsys-components.ts         # Control classes
├── services/
│   ├── qsys.service.ts            # QRWC WebSocket service
│   └── app-initialization.service.ts  # App-level init
├── components/
│   └── qsys-browser/              # Component browser UI
└── custom-views/                  # Custom control pages
```

## External Resources

- [Q-SYS QRWC Protocol Documentation](https://q-syshelp.qsc.com/)
- [Angular CLI Documentation](https://angular.dev/tools/cli)
- [Angular Signals Guide](https://angular.dev/guide/signals)

## License

See [LICENSE](LICENSE) for details.
