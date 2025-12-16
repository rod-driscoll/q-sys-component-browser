# Q-SYS Component Browser Usage

The Q-SYS Component Browser provides a three-view interface to browse and edit all components and controls in your Q-SYS design.

## Features

- **Component List View**: Browse all components with search/filter
- **Control List View**: View all controls for a selected component
- **Control Editor View**: Edit control values with type-specific inputs
  - Boolean controls: On/Off toggle buttons
  - Numeric controls (Float/Integer): Number input with optional ramp time
  - Text controls: Text input field
  - Read-only controls: Display only

## Loading Component and Control Data

The browser component exposes methods that can be called from the browser console to load data via MCP tools:

### 1. Load All Components

After the app connects to Q-SYS Core, load all components:

```javascript
// Fetch components using MCP tool (run this in Claude Code)
// Then pass the data to the browser:
window.qsysBrowser.setComponentsFromMCP([
  { name: "Component 1", controlCount: 10 },
  { name: "Component 2", controlCount: 25 },
  // ... more components
]);
```

### 2. Load Controls for a Component

When you select a component, load its controls:

```javascript
// Fetch controls using MCP tool: get_controls("ComponentName")
// Then pass the data to the browser:
window.qsysBrowser.setControlsFromMCP([
  {
    name: "Control1",
    type: "Boolean",
    direction: "Read/Write",
    value: 1
  },
  {
    name: "Control2",
    type: "Float",
    direction: "Read/Write",
    value: 75.5,
    position: 0.755,
    string: "75.5 dB"
  },
  // ... more controls
]);
```

## MCP Tool Integration

Use the following MCP tools to fetch data:

### Get All Components
```
mcp__qrwc-svelte__get_components
```

### Get Controls for a Component
```
mcp__qrwc-svelte__get_controls({ componentName: "Component Name" })
```

## Control Types

The browser supports all Q-SYS control types:

- **Boolean**: On/Off toggle buttons
- **Float**: Decimal number input with optional ramp time
- **Integer**: Whole number input
- **Text**: String input
- **Trigger**: (not editable in UI, use Component.Set)
- **Read Only**: Display current value only

## Navigation

- Click on a component to view its controls
- Click on a control to edit it
- Use the "← Back" button to return to previous view
- Use search boxes to filter components or controls

## Connection Status

The header shows connection status:
- **Connected** (green): Active connection to Q-SYS Core
- **Disconnected** (red): No connection

## Example Workflow

1. App connects to Q-SYS Core (192.168.104.227)
2. Console shows: "Browser component exposed on window.qsysBrowser"
3. Load all components via MCP tool
4. Click a component to view its controls
5. Load controls for that component via MCP tool
6. Click a control to edit its value
7. Update the control (sends Component.Set to Q-SYS)
8. Navigate back to browse other components/controls
