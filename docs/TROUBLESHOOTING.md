# Troubleshooting Guide

## Common Issues

### "Change group does not exist" Errors

**Symptoms:**
- Console floods with "Change group 'xxx' does not exist" errors
- Errors occur after reconnection or page navigation
- Controls stop updating from Q-SYS Core

**Cause:**
QRWC creates a new ChangeGroup with a new ID after reconnection, but components are still trying to poll with the old ChangeGroup ID that no longer exists on Q-SYS Core.

**Solution:**
This should be automatically handled by the re-registration mechanism. Check console for:

```
ChangeGroup ID changed from <old-id> to <new-id> - triggering re-registration
Detected reconnection #N, re-registering all components...
Re-registering component X with new ChangeGroup <new-id>
✓ All components re-registered with new ChangeGroup
```

**If re-registration is NOT happening:**

1. Check if `QrwcAdapterService` is registered in the component's providers
2. Verify the callback is registered in `QrwcAdapterService` constructor
3. Check browser console for errors in the callback execution
4. See [changegroup-reconnection-fix.md](./changegroup-reconnection-fix.md) for detailed fix documentation

---

### Controls Not Updating

**Symptoms:**
- Volume sliders, buttons don't respond to Q-SYS Designer changes
- Controls show stale values

**Possible Causes:**

1. **ChangeGroup not registered** - Check console for:
   ```
   Registered N controls with ChangeGroup for <component-name>
   ```

2. **Poll interceptor not set up** - Check console for:
   ```
   [Poll Interceptor] Polling with ChangeGroup ID: <uuid>
   ```

3. **Component not loaded** - Check console for:
   ```
   ✓ Loaded component: <component-name>
   ```

**Solutions:**

1. Ensure component is in `requiredComponents` or `optionalComponents` list
2. Check that component name matches Q-SYS Designer exactly (case-sensitive)
3. Verify component exists in Q-SYS Design
4. Restart application and check console logs

---

### Component Not Found

**Symptoms:**
- "Required component not found: X" warning
- Missing controls/features in UI

**Cause:**
Component doesn't exist in the Q-SYS Design or name mismatch.

**Solutions:**

1. **Check Q-SYS Design** - Open in Q-SYS Designer, verify component exists
2. **Check component name** - Names are case-sensitive and must match exactly
3. **Check component type** - Verify the component is the expected type
4. **For optional components** - This is expected behavior if component isn't needed

**Example:**
```typescript
// In qrwc-adapter.service.ts
public readonly requiredComponents = [
  'Room Controls',        // Must exist
  'UCI Text Helper',      // Must exist
];

public readonly optionalComponents = [
  'HDMISourceSelect_1',   // Warning if missing, not an error
  'USB Video Bridge Core', // Warning if missing, not an error
];
```

---

### Network Disconnection Issues

**Symptoms:**
- "QRWC Disconnected" message
- Application attempts reconnection
- May succeed or fail after multiple attempts

**Expected Behavior:**

1. Disconnection detected:
   ```
   QRWC Disconnected: <reason>
   ```

2. Automatic reconnection attempts with exponential backoff:
   ```
   Attempting reconnection 1/5 in 2s...
   Attempting reconnection 2/5 in 4s...
   Attempting reconnection 3/5 in 8s...
   ```

3. On success:
   ```
   ✓ Reconnection successful
   ChangeGroup ID changed... - triggering re-registration
   ```

**If reconnection fails:**

1. Check network connectivity
2. Verify Q-SYS Core is online and accessible
3. Check browser console for specific error messages
4. Refresh page to reset reconnection attempts

**Manual recovery:**
- Refresh the browser page
- Check Q-SYS Core status
- Verify network connectivity to Core

---

### RPC Error: Invalid params

**Symptoms:**
```
RPC Error (Component.Get, <uuid>):
{
  "code": -32602,
  "message": "Invalid params"
}
```

**Cause:**
Using wrong RPC method or incorrect parameters.

**Solution:**
Use `Component.GetControls` instead of `Component.Get`:

```typescript
// ✅ Correct
const result = await webSocketManager.sendRpc('Component.GetControls', {
  Name: componentName
});

// ❌ Wrong
const result = await webSocketManager.sendRpc('Component.Get', {
  Name: componentName
});
```

---

### Property Access Errors (undefined)

**Symptoms:**
- Controls display as numbers instead of proper types
- "Cannot read property 'X' of undefined"

**Cause:**
Property name case mismatch (camelCase vs PascalCase).

**Solution:**
Q-SYS RPC returns PascalCase properties (`Name`, `Type`, `Value`), but our service converts them to camelCase (`name`, `type`, `value`). Always use camelCase when accessing control properties:

```typescript
// ✅ Correct
const controlName = control.name;
const controlType = control.type;

// ❌ Wrong
const controlName = control.Name;
const controlType = control.Type;
```

---

## Debugging Tips

### Enable Verbose Logging

The application already logs key operations. Check console for:

1. **Connection events:**
   ```
   Connecting to Q-SYS Core via QRWC...
   Connected to Q-SYS Core
   QRWC initialization complete
   ```

2. **Component loading:**
   ```
   Loading room control components...
   Fetching controls for component: <name>
   Retrieved N controls for <name>
   Registered N controls with ChangeGroup for <name>
   ```

3. **Reconnection events:**
   ```
   ChangeGroup ID changed from X to Y
   Detected reconnection #N
   Re-registering component...
   ```

4. **Polling events:**
   ```
   [Poll Interceptor] Polling with ChangeGroup ID: <uuid>
   ```

### Common Log Patterns

**Healthy operation:**
```
Connecting to Q-SYS Core via QRWC...
Connected to Q-SYS Core
Loading room control components...
Registered 57 controls with ChangeGroup for Room Controls
✓ Loaded component: Room Controls
ChangeGroup polling already started
[Poll Interceptor] Polling with ChangeGroup ID: abc-123
```

**Successful reconnection:**
```
QRWC Disconnected: Connection closed
Attempting reconnection 1/5 in 2s...
Connecting to Q-SYS Core via QRWC...
Connected to Q-SYS Core
ChangeGroup ID changed from abc-123 to def-456
Detected reconnection #2, re-registering all components...
Re-registering component Room Controls with new ChangeGroup def-456
✓ All components re-registered with new ChangeGroup
```

**Error condition:**
```
[Poll Interceptor] Polling with ChangeGroup ID: def-456
QRWC Error: RPC Error: ChangeGroup.Poll failed to poll for changes.
{
  "code": 6,
  "message": "Change group 'def-456' does not exist"
}
```
*This indicates re-registration failed or didn't occur.*

### Browser DevTools

1. **Console tab** - Check for errors and warnings
2. **Network tab** - Monitor WebSocket connection status (ws://...)
3. **Application tab > Storage** - Clear if needed to reset state

### Q-SYS Designer Checks

1. Verify component exists and is named correctly
2. Check control names (case-sensitive)
3. Ensure Design is running (not in Edit mode)
4. Verify Core is accessible on network

## Getting Help

If issues persist after following this guide:

1. **Capture console logs** - Export console output to file
2. **Note exact steps** - Document what you did to trigger the issue
3. **Check recent changes** - Did this work before? What changed?
4. **Review documentation** - See [changegroup-reconnection-fix.md](./changegroup-reconnection-fix.md) for detailed technical information

## Quick Reference

| Issue | Check For | Solution |
|-------|-----------|----------|
| ChangeGroup errors | Re-registration logs | See [ChangeGroup fix doc](./changegroup-reconnection-fix.md) |
| Controls not updating | Poll interceptor logs | Verify component registration |
| Component not found | Component name in Designer | Check spelling, case-sensitivity |
| Network disconnect | Reconnection attempts | Wait for auto-reconnect or refresh |
| RPC Invalid params | RPC method used | Use Component.GetControls |
| Property undefined | Property name case | Use camelCase (not PascalCase) |
