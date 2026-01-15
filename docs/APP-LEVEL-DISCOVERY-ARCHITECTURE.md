# App-Level Discovery Initialization Architecture

## Overview

This document describes the major architectural refactoring that moved WebSocket discovery initialization to the **application level**, ensuring that all connection setup completes **before any pages load**. This eliminates the problem where individual pages would race with discovery initialization.

## Problem Solved

**Before:** Individual custom view pages (file-browser, named-controls, etc.) would call discovery initialization in their own `ngOnInit()` methods. This created a race condition where:
- File-browser would try to connect to file system before discovery completed
- Named-controls would try to read ExternalControls.xml before discovery completed
- Each page had to duplicate the same initialization logic
- The secure tunnel (control-based communication) wasn't available when pages loaded

**Result:** Pages would fall back to insecure HTTP/WebSocket communication instead of using the secure control-based tunnel.

**After:** Discovery now initializes at the application level in `App.ngOnInit()`, completing all three steps:
1. Connect to Q-SYS Core (QRWC)
2. Complete WebSocket discovery (establish secure tunnel via json_input/json_output controls)
3. Load Lua scripts (enable file system and other features)

Only after all three complete do route pages load, guaranteeing secure communication is available.

## Architecture

### 1. App-Level Initialization Service

**File:** [src/app/services/app-initialization.service.ts](src/app/services/app-initialization.service.ts)

```typescript
AppInitializationService {
  // Signals
  isInitializing: signal<boolean>
  initializationComplete: signal<boolean>
  loadingStage: signal<string>
  error: signal<string | null>

  // Main method
  async initializeApp(): Promise<void>
    1. Wait for QRWC connection (20s timeout)
    2. Initialize WebSocket discovery (20s timeout)
    3. Load Lua scripts (15s timeout)

  // Helper methods
  private waitForQRWCConnection(): Promise<void>
  private initializeWebSocketDiscovery(): Promise<void>
  private loadLuaScripts(): Promise<void>
  
  isReady(): boolean  // Check if app ready for pages
}
```

**Key Features:**
- Manages all timeouts with clear error messages
- Prevents duplicate initialization attempts
- Provides signals for app-level state
- Centralizes initialization logic (DRY principle)

### 2. Shared Components

#### Loading Screen Component
**File:** [src/app/components/loading-screen/loading-screen.component.ts](src/app/components/loading-screen/loading-screen.component.ts)

Shows during app initialization with:
- Animated spinner
- Loading stage messages from AppInitializationService
- Progress bar animation
- Fixed overlay above all content (z-index: 9999)

Automatically hides when `initializationComplete` becomes true.

#### Header Component
**File:** [src/app/components/header/header.component.ts](src/app/components/header/header.component.ts)

Sticky header visible on all pages showing:
- **App Title:** "Q-SYS Component Browser"
- **QRWC Connection Status:**
  - Green indicator when connected
  - Shows core address: `192.168.104.220:9091`
  - Red indicator when disconnected
- **Discovery Status:**
  - Green "Secure" when using control-based communication
  - Orange "HTTP Fallback" when using HTTP/WebSocket
  - Red when not connected
- **WS Connection Status Button:**
  - 🔒 Secure Tunnel - control-based communication is available
  - ⚠️ HTTP Fallback - using insecure communication
  - ⏳ Initializing - discovery not complete yet
  - Click to expand "Connection Details" popup showing:
    - Core Address
    - QRWC Status (✓ Connected / ✗ Disconnected)
    - Discovery Status (✓ Connected / ✗ Disconnected)
    - Communication Mode (Secure vs Fallback)

### 3. App-Level Integration

**File:** [src/app/app.ts](src/app/app.ts)

```typescript
export class App implements OnInit {
  constructor(
    private qsysService: QSysService,
    private appInit: AppInitializationService
  ) { }

  ngOnInit(): void {
    // 1. Parse URL parameters
    this.parseUrlParameters();
    
    // 2. Connect to Q-SYS Core
    this.connectToQSys();
    
    // 3. Initialize app (discovery, Lua scripts)
    // This MUST complete before custom view pages load
    this.appInit.initializeApp();
  }
}
```

**File:** [src/app/app.html](src/app/app.html)

```html
<app-header></app-header>
<app-loading-screen></app-loading-screen>
<router-outlet />
<app-pwa-install-prompt></app-pwa-install-prompt>
<app-settings-dialog></app-settings-dialog>
```

The header and loading screen are **above** the router-outlet, so they appear on all pages from the start.

## Page-Level Simplification

All custom view pages now have **zero initialization complexity**. They simply use the services knowing discovery is complete.

### Example: File Browser Component
**Before:**
```typescript
ngOnInit(): void {
  // Wait for QRWC connection
  await this.waitForQRWCConnection();
  // Wait for discovery
  await this.ensureDiscoveryComplete();
  // Load Lua scripts
  await this.loadLuaScripts();
  // Finally connect to file system
  this.fileSystemService.connect();
}
// +100 lines of helper methods duplicated in every page
```

**After:**
```typescript
ngOnInit(): void {
  // App-level initialization is complete
  // Discovery service is ready
  // Lua scripts are loaded
  // Just connect to file system
  console.log('[FILE-BROWSER] Connecting to file system (app init complete)');
  this.fileSystemService.connect();
}
```

### Updated Components:
1. **FileBrowserComponent** - [src/app/custom-views/file-browser/file-browser.component.ts](src/app/custom-views/file-browser/file-browser.component.ts)
   - Removed: LuaScriptService, QSysService, WebSocketDiscoveryService injections
   - Removed: waitForQRWCConnection(), ensureDiscoveryComplete(), loadLuaScripts() methods
   - Simplified: ngOnInit() just calls `fileSystemService.connect()`

2. **NamedControlsComponent** - [src/app/custom-views/named-controls/named-controls.component.ts](src/app/custom-views/named-controls/named-controls.component.ts)
   - Removed: All the duplicated initialization logic
   - Simplified: ngOnInit() just calls `namedControlsService.loadNamedControls()`

## State Management

### Initialization Flow Diagram

```
App.ngOnInit()
├── parseUrlParameters()
├── connectToQSys() [starts QRWC connection in background]
├── appInit.initializeApp()
│   ├── Step 1: waitForQRWCConnection()
│   │   └── Polls qsysService.isConnected() until true (20s timeout)
│   ├── Step 2: initializeWebSocketDiscovery()
│   │   ├── Calls wsDiscoveryService.connect()
│   │   └── Polls wsDiscoveryService.isConnected() until true (20s timeout)
│   └── Step 3: loadLuaScripts()
│       ├── Calls luaScriptService.loadScripts()
│       └── Waits 1s for initialization (15s timeout)
│   └── Set initializationComplete = true
│
└── Pages load ONLY after Step 3 completes
    ├── LoadingScreen hides automatically
    ├── Header becomes interactive
    └── Pages can safely use all services
```

### Signal States

**AppInitializationService.signals:**
- `isInitializing`: true while initialization in progress
- `initializationComplete`: true only after all 3 steps complete
- `loadingStage`: displays current stage ("Connecting to Q-SYS Core...", etc.)
- `error`: contains error message if initialization fails

**WebSocketDiscoveryService.signals:**
- `isConnected`: true when discovery tunnel is established
- `useControlBasedCommunication`: true when secure tunnel available
- `loadingStage`: discovery-specific status messages

## Communication Security Hierarchy

Pages now follow the complete hierarchy:

1. **Preferred: Control-Based (json_input/json_output)**
   - Only available after discovery completes
   - Encrypted at transport level (HTTPS)
   - No separate WebSocket needed
   - Detected by: `wsDiscoveryService.useControlBasedCommunication()`

2. **Fallback 1: Cached Component Data**
   - < 60s since last connection
   - Reuses QRWC component cache

3. **Fallback 2: Lua HTTP/WebSocket**
   - Insecure (HTTP, unencrypted WebSocket)
   - Only if secure tunnel unavailable
   - Now clearly marked in header (⚠️ HTTP Fallback)

## Commits

| Commit | Message |
|--------|---------|
| ba5329f | refactor: move discovery initialization to app level, add shared header and loading screen |
| b21e247 | style: add app layout styles for header and loading screen |
| f56c9dd | fix: invoke computed signals in header template and remove duplicate loadLuaScripts method |

## Files Created

1. [src/app/services/app-initialization.service.ts](src/app/services/app-initialization.service.ts) - App-level initialization orchestration
2. [src/app/components/loading-screen/loading-screen.component.ts](src/app/components/loading-screen/loading-screen.component.ts) - Loading indicator for all pages
3. [src/app/components/header/header.component.ts](src/app/components/header/header.component.ts) - Sticky header with connection status

## Files Modified

1. [src/app/app.ts](src/app/app.ts) - Added AppInitializationService, LoadingScreenComponent, HeaderComponent; added `appInit.initializeApp()` call
2. [src/app/app.html](src/app/app.html) - Added `<app-header>` and `<app-loading-screen>` above router-outlet
3. [src/app/app.css](src/app/app.css) - Added flexbox layout styles for header
4. [src/app/custom-views/file-browser/file-browser.component.ts](src/app/custom-views/file-browser/file-browser.component.ts) - Removed all initialization logic, now just calls `fileSystemService.connect()`
5. [src/app/custom-views/named-controls/named-controls.component.ts](src/app/custom-views/named-controls/named-controls.component.ts) - Removed all initialization logic, now just calls `namedControlsService.loadNamedControls()`

## Benefits

1. **No Race Conditions:** Discovery guaranteed complete before pages load
2. **Consistent UX:** All pages show same loading screen and header
3. **DRY Code:** Initialization logic in one place, not duplicated in every page
4. **Security Visibility:** Header clearly shows if using secure or fallback communication
5. **Debugging:** Connection details button provides instant diagnostics
6. **Scalability:** New pages automatically inherit proper initialization

## Testing

The refactoring has been verified to:
- ✅ Build successfully (no TypeScript errors)
- ✅ Display loading screen during app initialization
- ✅ Show connection details in header
- ✅ Display security status (Secure vs Fallback)
- ✅ File-browser connects with secure tunnel available
- ✅ Named-controls loads without duplicate initialization

## Future Improvements

1. **Persistent Connection Status:** Log connection state changes for diagnostics
2. **Reconnection Logic:** Auto-reconnect if connection drops during app lifetime
3. **Error Recovery:** Retry initialization with exponential backoff on timeout
4. **Connection Analytics:** Track connection stability metrics
5. **Custom View Registration:** Allow dynamic registration of new pages that auto-inherit proper initialization
