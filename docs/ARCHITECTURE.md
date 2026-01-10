# Architecture Documentation

## ChangeGroup Polling System

### Overview

The application uses Q-SYS's ChangeGroup mechanism to receive real-time control updates from Q-SYS Core. This document explains how the system works and why certain design decisions were made.

### What is a ChangeGroup?

A ChangeGroup is Q-SYS's mechanism for efficiently receiving control value updates. Instead of polling individual controls, you:

1. Create a ChangeGroup (gets a UUID)
2. Add components and their controls to the ChangeGroup
3. Poll the ChangeGroup for changes
4. Receive only changed values since last poll

**Benefits:**
- Efficient: Only changed values are returned
- Scalable: One poll for many controls
- Real-time: Poll interval determines update frequency

**Q-SYS RPC Methods:**
- `ChangeGroup.Create` - Create new ChangeGroup (rarely used, QRWC does this)
- `ChangeGroup.AddComponentControl` - Register controls for updates
- `ChangeGroup.Poll` - Get changes since last poll
- `ChangeGroup.Destroy` - Clean up ChangeGroup (rarely used)

### Architecture Layers

```
┌─────────────────────────────────────────────────┐
│          Angular Components                     │
│  (CamerasCard, RoomControls, etc.)             │
└─────────────────┬───────────────────────────────┘
                  │ Uses
                  ▼
┌─────────────────────────────────────────────────┐
│       QrwcAdapterService                        │
│  • Manages ComponentWrappers                    │
│  • Registers re-registration callback           │
│  • Handles component lifecycle                  │
└─────────────────┬───────────────────────────────┘
                  │ Uses
                  ▼
┌─────────────────────────────────────────────────┐
│       ComponentWrapper                          │
│  • Mimics QRWC Component interface              │
│  • Contains ControlWrappers                     │
│  • Registers controls with ChangeGroup          │
│  • Re-registers on reconnection                 │
└─────────────────┬───────────────────────────────┘
                  │ Uses
                  ▼
┌─────────────────────────────────────────────────┐
│       QSysService                               │
│  • Manages QRWC connection                      │
│  • Detects ChangeGroup ID changes               │
│  • Invokes re-registration callback             │
│  • Intercepts poll method                       │
└─────────────────┬───────────────────────────────┘
                  │ Uses
                  ▼
┌─────────────────────────────────────────────────┐
│       QRWC Library (@q-sys/qrwc)                │
│  • WebSocket management                         │
│  • RPC communication                            │
│  • ChangeGroup object (internal)                │
└─────────────────┬───────────────────────────────┘
                  │ WebSocket
                  ▼
┌─────────────────────────────────────────────────┐
│       Q-SYS Core                                │
│  • Maintains ChangeGroup state                  │
│  • Tracks registered controls                   │
│  • Returns changed values on poll               │
└─────────────────────────────────────────────────┘
```

### Connection Lifecycle

#### 1. Initial Connection

```typescript
// QSysService.connect()
const socket = new WebSocket(`ws://${coreIp}/qrc`);
this.qrwc = await Qrwc.createQrwc({
  socket,
  pollingInterval: 35,
  componentFilter: () => false  // Don't load components during init
});

// QRWC internally creates ChangeGroup with UUID
const changeGroup = (this.qrwc as any).changeGroup;
const changeGroupId = changeGroup.id;  // e.g., "abc-123-..."
```

#### 2. Component Loading

```typescript
// QrwcAdapterService.loadRequiredComponents()
for (const componentName of this.requiredComponents) {
  const component = new ComponentWrapper(
    componentName,
    webSocketManager,
    changeGroup  // Reference to QRWC's ChangeGroup
  );
  await component.initialize(this.qsysService);
}
```

#### 3. Control Registration

```typescript
// ComponentWrapper.initialize()
// 1. Fetch control definitions
const controlsList = await qsysService.getComponentControls(this.name);

// 2. Create ControlWrappers
for (const controlData of controlsList) {
  const control = new ControlWrapper(controlData, ...);
  this.controls[controlData.name] = control;
}

// 3. Register ALL controls with ChangeGroup on Q-SYS Core
await webSocketManager.sendRpc('ChangeGroup.AddComponentControl', {
  Id: this.changeGroup.id,
  Component: {
    Name: this.name,
    Controls: Object.keys(this.controls).map(name => ({ Name: name }))
  }
});
```

**Critical:** This RPC call creates the ChangeGroup on Q-SYS Core if it doesn't exist, and registers all controls to receive updates.

#### 4. Poll Interception

```typescript
// QSysService.listenToChangeGroupUpdates()
// Override QRWC's poll method to intercept results
const originalPoll = changeGroup.poll.bind(changeGroup);
changeGroup.poll = async () => {
  const result = await webSocketManager.sendRpc('ChangeGroup.Poll', {
    Id: this.changeGroup.id
  });

  // Process changes and emit to subscribers
  if (result.Changes) {
    result.Changes.forEach(change => {
      this.controlUpdates$.next({
        component: change.Component,
        control: change.Name,
        value: change.Value,
        // ... other properties
      });
    });
  }
};
```

#### 5. Polling Loop

```typescript
// QRWC starts polling automatically (or we start it manually)
await changeGroup.startPolling();

// QRWC uses setInterval to poll at specified interval
setInterval(() => {
  changeGroup.poll();  // Calls our intercepted method
}, pollingInterval * 1000);
```

#### 6. Control Updates

```typescript
// ControlWrapper.setupControlUpdateListener()
this.qsysService.getControlUpdates().subscribe(update => {
  if (update.component === this.componentName &&
      update.control === this.name) {
    // Update local state
    this.state = {
      ...this.state,
      Value: update.value,
      Position: update.position,
      String: update.string
    };

    // Notify listeners (Angular components)
    this.updateListeners.forEach(listener => {
      listener(this.state);
    });
  }
});
```

### Reconnection Lifecycle

#### Problem: QRWC Creates New ChangeGroup

When QRWC reconnects (network issue, page reload, etc.), it creates a **brand new ChangeGroup object** with a **new UUID**:

```typescript
// Before reconnection
changeGroup.id = "abc-123-..."

// After reconnection (QRWC.createQrwc() called again)
changeGroup.id = "def-456-..."  // DIFFERENT UUID!
```

The old ChangeGroup `abc-123` still exists on Q-SYS Core with all registered controls. But the new ChangeGroup `def-456` does NOT exist on Q-SYS Core because no controls have been registered with it yet.

#### Solution: Detect and Re-register

```typescript
// 1. QSysService.connect() - Detect ChangeGroup ID change
const newChangeGroupId = (changeGroup as any)?.id;
if (this.currentChangeGroupId !== newChangeGroupId) {
  this.currentChangeGroupId = newChangeGroupId;
  this.reconnectionCount.update(count => count + 1);

  // Invoke callback immediately
  if (this.changeGroupChangedCallback) {
    this.changeGroupChangedCallback();
  }
}

// 2. QrwcAdapterService - Callback registered in constructor
this.qsysService.onChangeGroupChanged(async () => {
  await this.reregisterAllComponents();
});

// 3. QrwcAdapterService.reregisterAllComponents()
const components = this.loadedComponents();
for (const componentName of Object.keys(components)) {
  const component = components[componentName];
  await component.reregisterWithChangeGroup(
    newWebSocketManager,
    newChangeGroup
  );
}

// 4. ComponentWrapper.reregisterWithChangeGroup()
// Update references to new instances
this.webSocketManager = newWebSocketManager;
this.changeGroup = newChangeGroup;

// Re-register ALL controls with the NEW ChangeGroup
await this.webSocketManager.sendRpc('ChangeGroup.AddComponentControl', {
  Id: this.changeGroup.id,  // NEW ID (def-456)
  Component: {
    Name: this.name,
    Controls: Object.keys(this.controls).map(name => ({ Name: name }))
  }
});

// Update all ControlWrappers with new WebSocketManager
for (const controlName in this.controls) {
  (this.controls[controlName] as any).webSocketManager = newWebSocketManager;
}
```

**Result:** The new ChangeGroup `def-456` now exists on Q-SYS Core with all controls registered. Polling will succeed.

### Design Decisions

#### Why Not Use QRWC's Component Loading?

QRWC can automatically load components during initialization:

```typescript
// We DON'T do this
this.qrwc = await Qrwc.createQrwc({
  socket,
  componentFilter: (name) => requiredComponents.includes(name)
});
```

**Reasons we don't:**

1. **Timeout Issues:** Loading many components during init can timeout
2. **Control Over Timing:** We want to load components on-demand
3. **Custom Wrapper Needed:** We need ComponentWrapper with re-registration capability
4. **Easier Testing:** Manual component loading is more predictable

#### Why Callback Instead of Effect?

Initial implementation used Angular effect:

```typescript
effect(() => {
  const reconnectionCount = this.qsysService.reconnectionCount();
  const isConnected = this.qsysService.isConnected();
  if (reconnectionCount > 0 && isConnected) {
    this.reregisterAllComponents();
  }
});
```

**Problems:**
- Effects may not trigger if signals change simultaneously
- Angular batches change detection unpredictably
- Effect might be destroyed/recreated during navigation
- Timing issues: one signal updates before the other

**Callback advantages:**
- Synchronous, immediate execution
- Guaranteed to run when ChangeGroup changes
- No dependency on Angular change detection
- Simple, deterministic control flow

#### Why Poll Interception?

We intercept QRWC's poll method instead of polling ourselves:

```typescript
changeGroup.poll = async () => {
  const result = await webSocketManager.sendRpc('ChangeGroup.Poll', {
    Id: this.changeGroup.id
  });
  // Process and distribute changes
};
```

**Reasons:**
1. **QRWC manages polling loop:** setInterval, error handling, backoff
2. **Access to all changes:** We can distribute to all subscribers
3. **Minimal interference:** QRWC's internal callbacks still work
4. **Dynamic ChangeGroup ID:** We get current ID each time

#### Why ComponentWrapper?

We don't use QRWC's components directly. Instead, we wrap them:

```typescript
class ComponentWrapper {
  constructor(
    public name: string,
    private webSocketManager: any,
    private changeGroup: any
  ) {}

  async initialize(qsysService: QSysService) {
    // Fetch controls via RPC
    const controlsList = await qsysService.getComponentControls(this.name);

    // Create ControlWrappers
    for (const controlData of controlsList) {
      this.controls[controlData.name] = new ControlWrapper(...);
    }

    // Register with ChangeGroup
    await this.registerWithChangeGroup();
  }

  async reregisterWithChangeGroup(newWS, newCG) {
    // Update references and re-register
  }
}
```

**Benefits:**
1. **Re-registration capability:** Can update references and re-register
2. **Control over RPC:** We decide when to fetch/register
3. **Consistent interface:** Mimics QRWC but with our enhancements
4. **Easier testing:** Mock WebSocketManager and ChangeGroup

### Performance Considerations

#### Polling Interval

Default: 35 seconds (QRWC default)

```typescript
pollingInterval: 35
```

**Trade-offs:**
- Shorter interval = more responsive, more network traffic
- Longer interval = less responsive, less network traffic
- Q-SYS recommends 30-60 seconds for typical UIs

#### ChangeGroup Efficiency

Only changed values are transmitted:

```typescript
// If 100 controls registered but only 1 changed
{
  Changes: [
    {
      Component: "Room Controls",
      Name: "VolumeFader",
      Position: 0.75
    }
  ]
}
```

This is much more efficient than polling each control individually.

#### Reconnection Backoff

Exponential backoff prevents connection storms:

```typescript
const delayMs = Math.pow(2, this.reconnectAttempts) * 1000;
// Attempt 1: 2s
// Attempt 2: 4s
// Attempt 3: 8s
// Attempt 4: 16s
// Attempt 5: 32s
```

After 5 failed attempts, reconnection stops. User must refresh page.

### Error Handling

#### ChangeGroup.Poll Failures

```typescript
try {
  const result = await webSocketManager.sendRpc('ChangeGroup.Poll', {
    Id: this.changeGroup.id
  });
} catch (error) {
  // Log error but don't crash
  console.error('QRWC Error:', error.message);
  // QRWC continues polling
}
```

**Common errors:**
- "Change group does not exist" → Re-registration didn't happen
- "Connection closed" → Network issue, reconnection triggered
- "Timeout" → Q-SYS Core slow/busy, retry on next poll

#### Component Loading Failures

```typescript
try {
  const component = new ComponentWrapper(...);
  await component.initialize(this.qsysService);
  components[componentName] = component;
} catch (error) {
  if (isRequired) {
    console.warn(`Failed to load required component ${componentName}:`, error);
  } else {
    console.log(`Optional component ${componentName} not loaded:`, error);
  }
}
```

**Strategy:**
- Required components: Warn but continue
- Optional components: Log info only
- App remains functional with partial component set

### Security Considerations

#### WebSocket Connection

```typescript
const protocol = this.options.secure ? 'wss' : 'ws';
const socket = new WebSocket(`${protocol}://${coreIp}/qrc`);
```

**Notes:**
- Use `wss://` for production (encrypted)
- Use `ws://` for development (easier debugging)
- Q-SYS Core must be configured to accept WebSocket connections

#### RPC Method Access

All RPC calls go through Q-SYS Core's permission system. If the Core restricts certain methods, RPCs will fail with permission errors.

**Best practices:**
- Only call documented RPC methods
- Handle permission errors gracefully
- Don't expose sensitive operations to untrusted clients

### Testing Strategies

#### Unit Testing ComponentWrapper

```typescript
describe('ComponentWrapper', () => {
  it('should register controls with ChangeGroup', async () => {
    const mockWS = { sendRpc: jest.fn().mockResolvedValue({}) };
    const mockCG = { id: 'test-123' };

    const component = new ComponentWrapper('Test', mockWS, mockCG);
    await component.initialize(mockQSysService);

    expect(mockWS.sendRpc).toHaveBeenCalledWith(
      'ChangeGroup.AddComponentControl',
      expect.objectContaining({ Id: 'test-123' })
    );
  });
});
```

#### Integration Testing Reconnection

```typescript
describe('Reconnection', () => {
  it('should re-register components when ChangeGroup ID changes', async () => {
    // 1. Connect with ChangeGroup ID 'abc-123'
    await qsysService.connect(options);

    // 2. Load components
    await qrwcAdapter.loadRequiredComponents();

    // 3. Simulate reconnection (new ChangeGroup ID 'def-456')
    await qsysService.connect(options);

    // 4. Verify re-registration occurred
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('Detected reconnection')
    );
  });
});
```

#### Manual Testing Checklist

- [ ] Initial connection and component loading
- [ ] Control updates (change in Q-SYS Designer, verify UI updates)
- [ ] Network disconnection and auto-reconnection
- [ ] Page navigation (Room Controls → Component Browser → Room Controls)
- [ ] Multiple rapid reconnections
- [ ] Reconnection with controls actively changing
- [ ] Component not found (remove from Design)
- [ ] Invalid RPC responses

### Future Improvements

#### Potential Optimizations

1. **Selective Re-registration:**
   - Currently re-registers ALL components on reconnection
   - Could track which components actually need re-registration
   - Trade-off: Complexity vs. minor performance gain

2. **ChangeGroup Pooling:**
   - Use multiple ChangeGroups for different component sets
   - Could reduce poll payload size
   - Trade-off: More complex management

3. **Smart Polling:**
   - Adjust poll interval based on activity
   - Fast polling when controls changing, slow when idle
   - Trade-off: More complex logic

4. **Connection State Machine:**
   - Formal state machine for connection lifecycle
   - Easier to reason about transitions
   - Better error recovery

#### Known Limitations

1. **Max Reconnect Attempts:**
   - After 5 failed attempts, reconnection stops
   - User must manually refresh page
   - Could add UI button to retry

2. **ChangeGroup Cleanup:**
   - Old ChangeGroups remain on Q-SYS Core after reconnection
   - Q-SYS eventually garbage collects them
   - Could explicitly destroy old ChangeGroups

3. **Component Load Order:**
   - Components load sequentially
   - Could parallelize for faster startup
   - Trade-off: More complex error handling

## References

- [Q-SYS External Control API](https://q-syshelp.qsc.com/External_Control_APIs/External_Control_Protocol_Commands.htm)
- [QRWC Library Documentation](https://www.npmjs.com/package/@q-sys/qrwc)
- [changegroup-reconnection-fix.md](./changegroup-reconnection-fix.md) - Detailed fix documentation
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - Common issues and solutions
