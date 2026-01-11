# Q-SYS Combo Box Pattern

This document explains how to properly load and detect combo box controls in Q-SYS via the RPC API.

## Problem

Q-SYS combo boxes appear as Text controls without their Choices array when using the standard `Component.GetControls` RPC method. This causes combo boxes to be incorrectly identified as plain text controls and rendered as text inputs instead of dropdowns.

## Root Cause

The Q-SYS RPC API has two different methods for getting control information:

1. **`Component.GetControls`** - Returns control **metadata** (Type, Direction, Min/Max values, etc.)
   - ❌ Does **NOT** include the `Choices` array
   - ✓ Fast and efficient for getting control list

2. **`Component.Get`** - Returns control **current values** (String, Value, Position, etc.)
   - ✓ **DOES** include the `Choices` array
   - Slower, but necessary for combo boxes

## Solution Pattern

To properly load combo boxes, you must use **both** RPC methods:

### Step-by-Step Implementation

```typescript
// 1. Get control metadata via Component.GetControls
const controlStates = await webSocketManager.sendRpc('Component.GetControls', {
  Name: componentName
});

// 2. Filter for Text controls (potential combo boxes)
const textControlNames = controlStates
  .filter(state => state.Type === 'Text')
  .map(state => state.Name);

// 3. Fetch current values for Text controls via Component.Get
if (textControlNames.length > 0) {
  const result = await webSocketManager.sendRpc('Component.Get', {
    Name: componentName,
    Controls: textControlNames.map(name => ({ Name: name }))
  });

  // 4. Extract Choices from result
  const choicesMap = new Map<string, string[]>();
  for (const control of result.Controls) {
    if (control.Choices && control.Choices.length > 0) {
      choicesMap.set(control.Name, control.Choices);
    }
  }

  // 5. Merge Choices back into control states
  controlStates = controlStates.map(state => {
    const choices = choicesMap.get(state.Name);
    if (choices) {
      return { ...state, Choices: choices };
    }
    return state;
  });
}

// 6. Detect combo boxes during control processing
for (const state of controlStates) {
  let controlType = state.Type;

  // Combo box detection: Type === "Text" AND Choices.length > 0
  if (state.Choices &&
      Array.isArray(state.Choices) &&
      state.Choices.length > 0 &&
      controlType === 'Text') {
    controlType = 'Combo box';
  }

  // ... process control
}
```

## Q-SYS Combo Box Characteristics

A Q-SYS combo box control has these properties:

| Property | Type | Description | Source API |
|----------|------|-------------|------------|
| `Type` | `"Text"` | Always "Text" type | `Component.GetControls` |
| `Choices` | `string[]` | Array of dropdown options | `Component.Get` only |
| `Position` | `number` | Current selected index (0-based) | `Component.Get` |
| `String` | `string` | Current selected value | `Component.Get` |
| `Direction` | `string` | "Read/Write" or "Read Only" | `Component.GetControls` |

## Detection Logic

```typescript
// CORRECT combo box detection
const isComboBox =
  control.Type === 'Text' &&
  control.Choices &&
  Array.isArray(control.Choices) &&
  control.Choices.length > 0;
```

## Setting Combo Box Values

When updating a combo box, use **Position** (index) not **Value** (string):

```typescript
// CORRECT - Use Position
await webSocketManager.sendRpc('Component.Set', {
  Name: componentName,
  Controls: [{
    Name: controlName,
    Position: languageIndex  // Index into Choices array
  }]
});

// WRONG - Don't use Value for combo boxes
await webSocketManager.sendRpc('Component.Set', {
  Name: componentName,
  Controls: [{
    Name: controlName,
    Value: 'some string'  // ❌ This won't work for combo boxes
  }]
});
```

## Common Pitfalls

### ❌ Don't Do This:
```typescript
// Only using Component.GetControls
const controls = await webSocketManager.sendRpc('Component.GetControls', {
  Name: componentName
});
// Choices will be undefined! Combo boxes won't work!
```

### ❌ Don't Do This:
```typescript
// Retrying Component.GetControls hoping Choices will appear
for (let i = 0; i < 5; i++) {
  const controls = await webSocketManager.sendRpc('Component.GetControls', {
    Name: componentName
  });
  // Choices will NEVER appear with this RPC method!
}
```

### ✓ Do This:
```typescript
// Use Component.GetControls for metadata, then Component.Get for Choices
const metadata = await webSocketManager.sendRpc('Component.GetControls', {
  Name: componentName
});

const textControls = metadata.filter(c => c.Type === 'Text').map(c => c.Name);

const values = await webSocketManager.sendRpc('Component.Get', {
  Name: componentName,
  Controls: textControls.map(name => ({ Name: name }))
});

// Merge Choices from values into metadata
```

## Implementation Reference

See `qsys.service.ts`:
- `fetchChoicesViaComponentGet()` - Fetches Choices via Component.Get RPC
- `mergeChoicesIntoStates()` - Merges Choices into control metadata
- `getComponentControls()` - Main method that implements this pattern

## When to Use This Pattern

This pattern **must** be used whenever:
- Loading controls for display in the UI
- Building control lists for components
- Any operation that needs to detect or render combo boxes

## Performance Considerations

- `Component.GetControls` is fast - use for initial control list
- `Component.Get` is slower - only call for Text controls, not all controls
- Fetching Choices for 20-40 Text controls is acceptable
- Consider caching Choices if reloading the same component frequently

## Summary

**Key Takeaway:** `Component.GetControls` does NOT include Choices. Always use `Component.Get` for Text controls to get the Choices array, then merge it into the control metadata. This is the only way to properly support combo boxes in Q-SYS.
