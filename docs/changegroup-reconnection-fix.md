# ChangeGroup Reconnection Issue - Documentation

## Problem Overview

When the application reconnected to Q-SYS Core (either through network disconnection or page navigation), the console would flood with "Change group does not exist" errors, causing the application to enter an error loop.

### Error Message
```
QRWC Error: RPC Error: ChangeGroup.Poll failed to poll for changes.
RPC Error (ChangeGroup.Poll, <uuid>):
{
  "code": 6,
  "message": "Change group '<uuid>' does not exist"
}
```

## Root Cause

The QRWC library creates a new ChangeGroup object with a new UUID every time it connects or reconnects to Q-SYS Core. However, our application had previously registered component controls with the **old** ChangeGroup ID. When polling continued after reconnection, it used the **new** ChangeGroup ID, but this ChangeGroup had never been created on the Q-SYS Core side (no controls were registered with it).

### Detailed Explanation

1. **Initial Connection**:
   - QRWC creates ChangeGroup with ID `abc-123`
   - Components register controls via `ChangeGroup.AddComponentControl`
   - ChangeGroup `abc-123` exists on both client and Q-SYS Core
   - Polling works correctly

2. **Reconnection Occurs**:
   - QRWC internally creates NEW ChangeGroup with ID `def-456`
   - Old ComponentWrappers still reference ChangeGroup `abc-123`
   - Poll interceptor uses new ID `def-456` (from current QRWC instance)
   - Q-SYS Core returns "does not exist" because no controls were registered with `def-456`

3. **Error Loop**:
   - Polling continues with non-existent ChangeGroup
   - Every poll attempt fails
   - Console floods with errors
   - Application becomes unusable

## Solution

The solution involves three key mechanisms working together:

### 1. ChangeGroup ID Tracking

Track the current ChangeGroup ID to detect when QRWC creates a new one:

```typescript
// In QSysService
private currentChangeGroupId: string | null = null;

// During connect(), after QRWC is created:
const changeGroup = (this.qrwc as any).changeGroup;
const newChangeGroupId = (changeGroup as any)?.id;

// Detect ID changes
if (this.currentChangeGroupId && newChangeGroupId &&
    this.currentChangeGroupId !== newChangeGroupId) {
  // ChangeGroup has changed - trigger re-registration
}
```

### 2. Callback-Based Notification

Use a direct callback mechanism (not Angular effects) for reliable notification:

```typescript
// In QSysService
private changeGroupChangedCallback: (() => Promise<void>) | null = null;

onChangeGroupChanged(callback: () => Promise<void>): void {
  this.changeGroupChangedCallback = callback;
}

// When ChangeGroup ID changes:
if (this.changeGroupChangedCallback) {
  this.changeGroupChangedCallback().catch(error => {
    console.error('Error in ChangeGroup changed callback:', error);
  });
}
```

### 3. Component Re-registration

When notified of a ChangeGroup change, re-register all components with the new ChangeGroup:

```typescript
// In QrwcAdapterService constructor
this.qsysService.onChangeGroupChanged(async () => {
  const reconnectionCount = this.qsysService.reconnectionCount();
  console.log(`Detected reconnection #${reconnectionCount}, re-registering all components...`);
  await this.reregisterAllComponents();
});

// In ComponentWrapper
async reregisterWithChangeGroup(newWebSocketManager: any, newChangeGroup: any): Promise<void> {
  // Update references
  this.webSocketManager = newWebSocketManager;
  this.changeGroup = newChangeGroup;

  // Re-register all controls with new ChangeGroup
  await this.registerWithChangeGroup();

  // Update control wrappers
  for (const controlName in this.controls) {
    (this.controls[controlName] as any).webSocketManager = newWebSocketManager;
  }
}
```

## Implementation Details

### Files Modified

1. **src/app/services/qsys.service.ts**
   - Added `currentChangeGroupId` tracking
   - Added `reconnectionCount` signal
   - Added `onChangeGroupChanged()` callback registration
   - Added ChangeGroup ID change detection during `connect()`
   - Invokes callback when ChangeGroup ID changes

2. **src/app/custom-views/room-controls/services/qrwc-adapter.service.ts**
   - Registers callback with `onChangeGroupChanged()`
   - Implements `reregisterAllComponents()` method
   - Removed unreliable effect-based approach

3. **src/app/custom-views/room-controls/services/qrwc-adapter.service.ts** (ComponentWrapper class)
   - Added `reregisterWithChangeGroup()` method
   - Updates WebSocket manager and ChangeGroup references
   - Re-registers controls with new ChangeGroup

### Sequence After Reconnection

1. **Connection Established**:
   ```
   QSysService.connect() called
   └─> QRWC instance created
       └─> New ChangeGroup created with new ID
   ```

2. **ChangeGroup ID Change Detected**:
   ```
   isConnected.set(true)
   └─> Check if ChangeGroup ID changed
       └─> currentChangeGroupId !== newChangeGroupId
           └─> Update currentChangeGroupId
           └─> Increment reconnectionCount
           └─> Invoke changeGroupChangedCallback()
   ```

3. **Components Re-registered**:
   ```
   changeGroupChangedCallback() invoked
   └─> QrwcAdapterService.reregisterAllComponents()
       └─> For each loaded component:
           └─> component.reregisterWithChangeGroup(newWS, newCG)
               └─> Update references
               └─> Call ChangeGroup.AddComponentControl RPC
               └─> Update control wrappers
       └─> Ensure poll interceptor is set up
   ```

4. **Polling Works**:
   ```
   Poll interceptor polls with new ChangeGroup ID
   └─> ChangeGroup exists on Q-SYS Core (controls were registered)
       └─> Poll succeeds
       └─> Control updates received
   ```

## Why Effects Didn't Work

Initial attempts used Angular effects to watch for reconnections:

```typescript
// This approach was UNRELIABLE
effect(() => {
  const reconnectionCount = this.qsysService.reconnectionCount();
  const isConnected = this.qsysService.isConnected();

  if (reconnectionCount > 0 && isConnected) {
    this.reregisterAllComponents();
  }
});
```

**Problems with effects**:
- May not trigger when multiple signals change simultaneously
- Timing issues: if `reconnectionCount` updates before `isConnected`, condition is false
- Effects can be destroyed/recreated during navigation
- Angular change detection may batch updates unpredictably

**Why callbacks work better**:
- Synchronous, immediate invocation
- No dependency on Angular change detection
- Guaranteed execution when ChangeGroup changes
- Simple, deterministic flow

## Testing the Fix

### How to Verify It Works

1. **Load the application** and navigate to Room Controls
2. **Check console** for initial component loading:
   ```
   Loading room control components...
   Registered 57 controls with ChangeGroup for Room Controls
   ✓ Loaded component: Room Controls
   ```

3. **Trigger reconnection** (disconnect network or reload page)
4. **Check console** for re-registration:
   ```
   ChangeGroup ID changed from abc-123 to def-456 - triggering re-registration
   ChangeGroup changed - reconnection #2
   Detected reconnection #2, re-registering all components...
   Re-registering component Room Controls with new ChangeGroup def-456
   Re-registered 57 controls for Room Controls
   ✓ All components re-registered with new ChangeGroup
   ```

5. **Verify no errors**: Console should NOT show "Change group does not exist" errors
6. **Test controls**: Volume sliders, buttons, etc. should respond to Q-SYS changes

### What Success Looks Like

After reconnection:
- ✅ "Detected reconnection #N, re-registering all components..." message appears
- ✅ Each component shows "Re-registering component X with new ChangeGroup Y"
- ✅ "✓ All components re-registered with new ChangeGroup" confirmation
- ✅ No "Change group does not exist" errors
- ✅ Poll interceptor polls successfully with new ChangeGroup ID
- ✅ Control updates work correctly (test by changing values in Q-SYS Designer)

### What Failure Looks Like

If the fix is broken:
- ❌ "Detected reconnection" message does NOT appear
- ❌ Console floods with "Change group 'xxx' does not exist" errors
- ❌ Poll interceptor shows mismatched ChangeGroup IDs
- ❌ Controls don't update when changed in Q-SYS Designer
- ❌ Application enters error loop

## Prevention Guidelines

### For Future Development

1. **Never rely solely on Angular effects for critical operations**
   - Effects are great for UI reactivity
   - Use callbacks for guaranteed execution of critical logic

2. **Always check QRWC internal state after reconnection**
   - QRWC may recreate objects internally
   - Don't assume references remain valid after disconnect/reconnect

3. **Track object identities, not just object existence**
   - ChangeGroup object exists after reconnection
   - But it's a NEW object with a NEW ID
   - Track IDs to detect replacements

4. **Test reconnection scenarios thoroughly**
   - Network disconnection
   - Page navigation
   - Multiple rapid reconnections
   - Reconnection while operations are in progress

5. **Log state changes clearly**
   - Log ChangeGroup IDs during connection
   - Log when re-registration occurs
   - Makes debugging reconnection issues much easier

### Code Patterns to Follow

#### ✅ DO: Use callbacks for critical notifications
```typescript
// In service
private callback: (() => Promise<void>) | null = null;
onCriticalEvent(callback: () => Promise<void>): void {
  this.callback = callback;
}
// Invoke synchronously when event occurs
if (this.callback) {
  this.callback().catch(console.error);
}
```

#### ✅ DO: Track object identities
```typescript
private currentObjectId: string | null = null;
if (this.currentObjectId !== newObjectId) {
  // Object was replaced, handle it
}
```

#### ✅ DO: Re-establish references after reconnection
```typescript
async reregisterWithNewInstance(newInstance: any): Promise<void> {
  this.instance = newInstance;  // Update reference
  await this.registerWithInstance();  // Re-register
}
```

#### ❌ DON'T: Rely on effects for critical operations
```typescript
// Unreliable - may not trigger
effect(() => {
  if (signal1() && signal2()) {
    criticalOperation();
  }
});
```

#### ❌ DON'T: Assume object references survive reconnection
```typescript
// BAD: Old reference may be stale
constructor() {
  this.changeGroup = qrwc.changeGroup;  // Store once
  // After reconnect, this.changeGroup is stale!
}

// GOOD: Get reference fresh each time
getChangeGroup() {
  return (this.qrwc as any).changeGroup;  // Always current
}
```

## Related Issues

- Original symptom: Controls not updating in component browser
- Related: ChangeGroup polling errors after page navigation
- Related: Component subscriptions not receiving updates after reconnection

## Commits

The fix was implemented across multiple commits:

1. `64d8c18` - Initial re-registration mechanism with signals
2. `c495eb9` - Improved ChangeGroup ID change detection
3. `bd9fbc2` - Fixed timing issue (move check after isConnected)
4. `1580704` - Final fix using callback instead of effect

## References

- QRWC Library: `@q-sys/qrwc`
- Q-SYS Core RPC Methods: `ChangeGroup.AddComponentControl`, `ChangeGroup.Poll`
- Related files: `qsys.service.ts`, `qrwc-adapter.service.ts`
