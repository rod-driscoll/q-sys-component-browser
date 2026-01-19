# Documentation

This directory contains all technical documentation for the Q-SYS Component Browser application.

> **New to the project?** Start with [ARCHITECTURE.md](./ARCHITECTURE.md) for system overview, then [APP-LEVEL-DISCOVERY-ARCHITECTURE.md](./APP-LEVEL-DISCOVERY-ARCHITECTURE.md) if you're creating custom views.

## Documentation Index

### Architecture & Core Concepts

| Document | Description |
|----------|-------------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System architecture, ChangeGroup polling, QRWC integration, design decisions |
| [APP-LEVEL-DISCOVERY-ARCHITECTURE.md](./APP-LEVEL-DISCOVERY-ARCHITECTURE.md) | **Required for custom views** - App initialization pattern with `waitForAppInit()` |
| [changegroup-reconnection-fix.md](./changegroup-reconnection-fix.md) | Deep dive into ChangeGroup reconnection mechanism |

### Deployment Guides

| Document | Description |
|----------|-------------|
| [DEPLOY.md](./DEPLOY.md) | Deploy to Q-SYS Core (Media Resources API) and Crestron touchpanels (CH5Z) |
| [GITHUB-PAGES.md](./GITHUB-PAGES.md) | Automatic deployment to GitHub Pages via Actions |

### Troubleshooting & Debugging

| Document | Description |
|----------|-------------|
| [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) | Common issues and solutions (start here for problems) |
| [CRESTRON-DEBUGGING.md](./CRESTRON-DEBUGGING.md) | Debugging on Crestron touchpanels, Eruda console setup |

### Development Guides

| Document | Description |
|----------|-------------|
| [LUA-SCRIPTING-BEST-PRACTICES.md](./LUA-SCRIPTING-BEST-PRACTICES.md) | Q-SYS Lua scripting (timers, scope, function order) |
| [Q-SYS-COMBO-BOX-PATTERN.md](./Q-SYS-COMBO-BOX-PATTERN.md) | Working with combo box controls via RPC API |
| [WEBSOCKET-DISCOVERY.md](./WEBSOCKET-DISCOVERY.md) | WebSocket-based component discovery |
| [SECURE_DISCOVERY_WALKTHROUGH.md](./SECURE_DISCOVERY_WALKTHROUGH.md) | Secure tunnel via control-based communication |

### Package & Reuse

| Document | Description |
|----------|-------------|
| [NPM-PACKAGE.md](./NPM-PACKAGE.md) | Using the `@qsys/angular-core` npm package for custom projects |

### Reference

| Document | Description |
|----------|-------------|
| [IMPLEMENTATION-LOG.md](./IMPLEMENTATION-LOG.md) | Historical development log with detailed implementation notes |

---

## Quick Start by Role

### For New Developers

1. Read [ARCHITECTURE.md](./ARCHITECTURE.md) - understand ChangeGroup polling and QRWC
2. Read [APP-LEVEL-DISCOVERY-ARCHITECTURE.md](./APP-LEVEL-DISCOVERY-ARCHITECTURE.md) - learn the `waitForAppInit()` pattern
3. Check [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) if you encounter issues

### For Custom View Development

**Critical:** All custom views MUST wait for app initialization before accessing Q-SYS services.

```typescript
import { AppInitializationService } from '../../services/app-initialization.service';

export class MyCustomViewComponent implements OnInit {
  private appInit = inject(AppInitializationService);

  ngOnInit(): void {
    this.waitForAppInit().then(() => {
      // Safe to use Q-SYS services here
      this.loadData();
    });
  }

  private waitForAppInit(): Promise<void> {
    return new Promise((resolve) => {
      if (this.appInit.initializationComplete()) {
        resolve();
        return;
      }
      const checkInterval = setInterval(() => {
        if (this.appInit.initializationComplete()) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
    });
  }
}
```

See [APP-LEVEL-DISCOVERY-ARCHITECTURE.md](./APP-LEVEL-DISCOVERY-ARCHITECTURE.md) for complete details.

### For Deployment

- **Q-SYS Core / Crestron**: See [DEPLOY.md](./DEPLOY.md)
- **GitHub Pages**: See [GITHUB-PAGES.md](./GITHUB-PAGES.md)

### For Troubleshooting

| Problem | Document |
|---------|----------|
| "Change group does not exist" errors | [TROUBLESHOOTING.md](./TROUBLESHOOTING.md), [changegroup-reconnection-fix.md](./changegroup-reconnection-fix.md) |
| Controls not updating | [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) |
| Crestron black screen | [CRESTRON-DEBUGGING.md](./CRESTRON-DEBUGGING.md) |
| Lua timer issues | [LUA-SCRIPTING-BEST-PRACTICES.md](./LUA-SCRIPTING-BEST-PRACTICES.md) |

---

## Key Concepts

### App-Level Initialization

All Q-SYS services (QRWC, discovery, Lua scripts) initialize at the application level before any page loads. Custom views **must** wait for `initializationComplete` to ensure services are ready.

### ChangeGroup

Q-SYS's mechanism for efficiently receiving control value updates. A ChangeGroup has a UUID and tracks which controls are registered. Only changed values are returned when polling. QRWC handles polling automatically.

### ComponentWrapper vs QSysComponent

- **ComponentWrapper**: Used for components needing re-registration on reconnection
- **QSysComponent**: Simpler pattern for basic control access

### Communication Security Hierarchy

1. **Control-Based (Secure)**: json_input/json_output controls via QRWC
2. **Cache**: Previously discovered components (< 60s reconnection)
3. **Fallback**: Insecure Lua HTTP/WebSocket (only if necessary)

---

## Related Source Files

### Critical Services

- [src/app/services/app-initialization.service.ts](../src/app/services/app-initialization.service.ts) - App-level initialization
- [src/app/services/qsys.service.ts](../src/app/services/qsys.service.ts) - QRWC connection and ChangeGroup
- [src/app/models/qsys-components.ts](../src/app/models/qsys-components.ts) - QSysComponent and controls

### Reference Implementations

- [src/app/custom-views/file-browser/](../src/app/custom-views/file-browser/) - Custom view with app init wait
- [src/app/custom-views/named-controls/](../src/app/custom-views/named-controls/) - Custom view with app init wait
- [src/app/custom-views/media-playlists/](../src/app/custom-views/media-playlists/) - Custom view with app init wait

---

## External References

- [Q-SYS External Control API](https://q-syshelp.qsc.com/External_Control_APIs/External_Control_Protocol_Commands.htm)
- [QRWC Library (@q-sys/qrwc)](https://www.npmjs.com/package/@q-sys/qrwc)
- [Angular Signals](https://angular.dev/guide/signals)
- [Crestron CH5 Documentation](https://sdkcon78221.crestron.com/sdk/Crestron_HTML5UI/)
