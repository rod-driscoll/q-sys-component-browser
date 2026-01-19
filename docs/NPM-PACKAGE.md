# Q-SYS Angular Core Package

This document describes the `@anthropic-demo/qsys-angular-core` npm package located in `packages/qsys-angular-core/`.

## Purpose

The package extracts the core Q-SYS communication services from this project into a reusable library. This allows you to create multiple custom Q-SYS control interfaces without duplicating the core QRWC communication code.

## Package Contents

### Services

| Service | Description |
|---------|-------------|
| `QSysService` | Core QRWC WebSocket connection and RPC communication |
| `AppInitializationService` | App-level initialization orchestration |
| `AuthService` | Q-SYS Core authentication (Bearer tokens) |
| `SecureTunnelDiscoveryService` | Secure tunnel via control-based communication |
| `LuaScriptService` | Lua script loading and management |

### Models

| Export | Description |
|--------|-------------|
| `QSysComponent` | Component wrapper class with typed control factories |
| `TextControl`, `BooleanControl`, `KnobControl`, etc. | Type-safe control wrappers with Angular signals |
| `QSysConfig`, `QSYS_CONFIG` | Configuration interface and injection token |
| `QrwcConnectionOptions` | Connection options interface |

### Helpers

| Export | Description |
|--------|-------------|
| `waitForAppInit()` | Wait for app initialization before using services |
| `createWaitForAppInit()` | Create bound wait function for components |

## Using the Package

### Option 1: Local Development (Monorepo)

For development within this repository, import directly from the package path:

```typescript
// In your app's service or component
import { QSysService, QSysComponent } from '../../packages/qsys-angular-core/src';
```

Or add a path alias to tsconfig.json:

```json
{
  "compilerOptions": {
    "paths": {
      "@qsys/core": ["packages/qsys-angular-core/src"]
    }
  }
}
```

Then import:

```typescript
import { QSysService, QSysComponent } from '@qsys/core';
```

### Option 2: Published npm Package

After publishing the package to npm:

```bash
npm install @anthropic-demo/qsys-angular-core
```

```typescript
import { QSysService, QSysComponent, QSYS_CONFIG } from '@anthropic-demo/qsys-angular-core';
```

## Configuration

The package uses Angular's dependency injection for configuration:

```typescript
// app.config.ts
import { ApplicationConfig } from '@angular/core';
import { QSYS_CONFIG, QSysConfig } from '@anthropic-demo/qsys-angular-core';

const qsysConfig: QSysConfig = {
  coreIp: '192.168.1.100',
  corePort: 9091,
  secure: false,
  defaultUsername: 'admin',
  defaultPassword: 'admin',
  pollingInterval: 350
};

export const appConfig: ApplicationConfig = {
  providers: [
    { provide: QSYS_CONFIG, useValue: qsysConfig }
  ]
};
```

## Migration from Direct Import

If your code currently imports from `../../services/qsys.service`, update to:

**Before:**
```typescript
import { QSysService } from '../services/qsys.service';
import { environment } from '../../environments/environment';
```

**After:**
```typescript
import { QSysService, QSYS_CONFIG } from '@anthropic-demo/qsys-angular-core';
// Configuration now injected via QSYS_CONFIG token
```

## Publishing to npm

To publish as an npm package:

1. Update version in `packages/qsys-angular-core/package.json`
2. Build the package (add build script as needed)
3. Publish:

```bash
cd packages/qsys-angular-core
npm publish --access public
```

## Extracting to Separate Repository

To move the package to its own repository:

1. Create new repository
2. Copy `packages/qsys-angular-core/` contents to new repo root
3. Add Angular library build tooling (ng-packagr or similar)
4. Update package.json with build scripts
5. Publish to npm
6. Update this project to depend on published package

## Files Not Included in Package

The following are intentionally excluded from the core package:

| File/Service | Reason |
|--------------|--------|
| `qsys-browser.service.ts` | Component Browser UI-specific |
| `file-system.service.ts` | File browser feature |
| `media-playlists.service.ts` | Media playlists feature |
| `named-controls.service.ts` | Named controls feature |
| `custom-view-registry.service.ts` | Custom view system |
| `pwa-update.service.ts` | PWA feature |
| UI components | Package is services-only |
| Lua scripts | Deployment artifacts |
| Crestron tooling | Build/deploy scripts |

These can be added to your custom project as needed, or could become separate packages.
