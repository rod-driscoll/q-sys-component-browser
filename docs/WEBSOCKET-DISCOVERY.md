# WebSocket Component Discovery

This document explains how to use WebSocket-based component discovery instead of the log-based approach, which is more efficient for large component lists.

## Overview

The WebSocket approach provides several advantages:
- **No log overflow**: Large discovery data doesn't overwhelm the Q-SYS log system
- **Real-time updates**: Can receive live component/control updates
- **Bidirectional**: Can request specific data on demand
- **Efficient**: Binary framing and no polling required

## Setup

### 1. Update Webserver Component Code

In your Q-SYS design, update the `code` control in the `webserver` component with the contents of:
```
lua/TunnelDiscovery.lua
```

This script:
- Sets up an HTTP server on port 8080
- Provides WebSocket endpoint at `ws://[CORE-IP]:8080/ws/discovery`
- Provides REST API endpoints at `http://[CORE-IP]:8080/api/components`
- Serves your Angular app from `dist/q-sys-angular-components`

### 2. WebSocket Endpoints

#### `/ws/discovery` - Component Discovery
Automatically sends full component discovery data when client connects:

```typescript
const ws = new WebSocket('ws://192.168.104.220:8080/ws/discovery');

ws.onopen = () => {
  console.log('Connected to discovery endpoint');
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (message.type === 'discovery') {
    console.log('Received discovery data:', message.data);
    // message.data contains the full component list with controls
  }
};
```

#### `/ws/updates` - Real-time Updates
For future use - will provide real-time component/control value updates.

### 3. HTTP API Endpoints

#### `GET /api/components`
Returns lightweight component list with control counts:

```typescript
fetch('http://192.168.104.220:8080/api/components')
  .then(res => res.json())
  .then(data => {
    console.log(`Found ${data.totalComponents} components`);
    // data.components contains: name, type, controlCount
  });
```

#### `GET /api/components/:componentName/controls`
Returns full control list for a specific component:

```typescript
fetch('http://192.168.104.220:8080/api/components/Display%201/controls')
  .then(res => res.json())
  .then(data => {
    console.log(`Component has ${data.controlCount} controls`);
    // data.controls contains: name, type, direction, value, etc.
  });
```

## Angular Integration

### Option 1: Use WebSocket for Initial Discovery

Update the component browser to use WebSocket for discovery:

```typescript
// In qsys-browser.component.ts
private discoveryWebSocket?: WebSocket;

connectToDiscoveryWebSocket(): void {
  this.discoveryWebSocket = new WebSocket('ws://192.168.104.220:8080/ws/discovery');

  this.discoveryWebSocket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.type === 'discovery') {
      this.processDiscoveryData(message.data);
    }
  };

  this.discoveryWebSocket.onerror = (error) => {
    console.error('WebSocket error:', error);
  };
}

processDiscoveryData(data: any): void {
  // Convert to ComponentInfo format
  const componentList: ComponentInfo[] = data.components.map((comp: any) => ({
    name: comp.name,
    type: comp.type,
    controlCount: comp.controlCount
  }));

  this.browserService.setComponents(componentList);
  console.log(`✓ Loaded ${componentList.length} components via WebSocket`);
}
```

### Option 2: Use HTTP API

For simpler integration, use the HTTP API endpoints:

```typescript
async loadComponentsViaAPI(): Promise<void> {
  const response = await fetch('http://192.168.104.220:8080/api/components');
  const data = await response.json();

  const componentList: ComponentInfo[] = data.components.map((comp: any) => ({
    name: comp.name,
    type: comp.type,
    controlCount: comp.controlCount
  }));

  this.browserService.setComponents(componentList);
}

async loadComponentControls(componentName: string): Promise<void> {
  const response = await fetch(
    `http://192.168.104.220:8080/api/components/${encodeURIComponent(componentName)}/controls`
  );
  const data = await response.json();

  // Process controls...
}
```

## Benefits Over Log-Based Approach

1. **Scalability**: No size limits like with log controls
2. **Performance**: No need to parse log output or wait for print statements
3. **Real-time**: WebSocket provides instant updates
4. **Reliability**: No risk of log buffer overflow
5. **Structured**: JSON data is already parsed, no regex needed

## Migration Path

1. **Phase 1**: Use HTTP API endpoints for component listing (lightweight)
2. **Phase 2**: Use WebSocket for full discovery on demand
3. **Phase 3**: Implement real-time updates via `/ws/updates` endpoint

## Testing

1. Deploy the Lua script to your webserver component
2. Test WebSocket connection:
   ```bash
   # Using wscat (npm install -g wscat)
   wscat -c ws://192.168.104.220:8080/ws/discovery
   ```

3. Test HTTP API:
   ```bash
   curl http://192.168.104.220:8080/api/components
   ```

## Troubleshooting

- **Connection refused**: Check that the webserver component is running
- **CORS errors**: The script includes CORS middleware, but check browser console
- **Large payloads**: WebSocket handles chunking automatically via the library
- **Component not found**: Verify component name spelling and case sensitivity
