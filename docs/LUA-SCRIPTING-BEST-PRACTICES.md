# Q-SYS Lua Scripting Best Practices

This document captures important lessons learned during development to avoid common mistakes when writing Lua scripts for Q-SYS Core.

---

## Critical: Timer Scope Must Be Global

### The Rule
**All timers in Q-SYS Lua MUST be declared at the global scope, NOT as local variables.**

### Why?
In Q-SYS Lua scripting environment, the script execution model requires timers to be kept alive at the global scope. If a timer is declared as a local variable within a function, it can be garbage collected when the function exits, causing the timer to stop unexpectedly.

### Reference
- Q-SYS Documentation: [Timer Object](https://help.qsys.com/q-sys_9.13/#Control_Scripting/Using_Lua_in_Q-Sys/Timer.htm?Highlight=timer)

### Example - WRONG ❌
```lua
function startTimer()
  local myTimer = Timer.New()  -- LOCAL = WRONG!
  myTimer.EventHandler = function()
    print("This timer will stop unexpectedly")
  end
  myTimer:Start(1)
end
```

### Example - CORRECT ✅
```lua
-- Declare at module/global scope
local myTimer = nil

function initializeTimer()
  myTimer = Timer.New()  -- Assign to global-scoped variable
  myTimer.EventHandler = function()
    print("This timer works reliably")
  end
  myTimer:Start(1)
end
```

### Real Example from Project
**File:** `lua/WebSocketComponentDiscovery.lua`

**WRONG (Initial Implementation):**
```lua
-- Inside function scope - INCORRECT
function setupTimers()
  reconnectionCheckTimer = Timer.New(CheckQRWCConnectionState, 2, true)
  reconnectionCheckTimer:Start()  -- ERROR: bad argument #-2 to 'Start' (number expected, got QSC.timer)
end
```

**CORRECT (Fixed Implementation):**
```lua
-- At module scope (before any functions)
local reconnectionCheckTimer = nil

-- Later, at module initialization
if not reconnectionCheckTimer or not reconnectionCheckTimer:Running() then
  reconnectionCheckTimer = Timer.New()
  reconnectionCheckTimer.EventHandler = CheckQRWCConnectionState
  reconnectionCheckTimer:Start(2)  -- Correct: using numeric interval parameter
  print("Started QRWC connection state monitor (checks every 2 seconds)")
end
```

---

## Critical: Function Definition Order Matters

### The Rule
**All functions that are called during script execution MUST be defined BEFORE they are called.**

Lua loads and executes code sequentially. If a function is defined inside a conditional block or after where it's called, it will be `nil` when referenced.

### Why?
In Q-SYS Lua, control event handlers and reconnection logic may call functions during runtime. If those functions aren't defined at module scope before execution, you get:
```
attempt to call a nil value (global 'FunctionName')
```

### Example - WRONG ❌
```lua
-- Control reconnection handler defined early
function ReinitializeControlHandlers()
  Controls.trigger.EventHandler = function()
    WriteJsonToControl(jsonStr)  -- ERROR: nil value!
  end
end

-- ... lots of other code ...

-- Function defined AFTER it's referenced
if someCondition then
  local function WriteJsonToControl(jsonStr)
    -- This function is only defined if someCondition is true
    -- AND it's local, so invisible outside this block
  end
end
```

### Example - CORRECT ✅
```lua
-- Define function at module scope FIRST
function WriteJsonToControl(jsonStr)
  if not Controls.json_output then return end
  Controls.json_output.String = jsonStr
end

-- Now it can be called from anywhere
function ReinitializeControlHandlers()
  Controls.trigger.EventHandler = function()
    WriteJsonToControl(jsonStr)  -- CORRECT: function already defined
  end
end
```

### Real Example from Project
**File:** `lua/WebSocketComponentDiscovery.lua`

**WRONG (Initial Implementation):**
```lua
-- Line 1815: ReinitializeControlHandlers() calls WriteJsonToControl()
function ReinitializeControlHandlers()
  if Controls.trigger_update then
    Controls.trigger_update.EventHandler = function()
      WriteJsonToControl(jsonStr)  -- ERROR on line 1815
    end
  end
end

-- Line 2701: WriteJsonToControl defined AFTER it's called
if Controls.json_output and Controls.trigger_update then
  local function WriteJsonToControl(jsonStr)
    -- ... implementation ...
  end
end
```

**CORRECT (Fixed Implementation):**
```lua
-- Line 2696: Define function at module scope, BEFORE it's called
function WriteJsonToControl(jsonStr)
  if not Controls.json_output then
    print("Warning: json_output control not available")
    return
  end
  Controls.json_output.String = jsonStr
end

-- Line 1815: Can now be called from anywhere
function ReinitializeControlHandlers()
  if Controls.trigger_update then
    Controls.trigger_update.EventHandler = function()
      WriteJsonToControl(jsonStr)  -- CORRECT: function defined at module scope
    end
  end
end
```

---

## Related: Timer.New() API Patterns

When using Q-SYS Timer objects, be aware of these patterns:

### Pattern 1: Create Empty, Configure Later
```lua
local myTimer = Timer.New()  -- Create empty timer
myTimer.EventHandler = myFunction  -- Set callback
myTimer:Start(interval)  -- Start with numeric interval
```

### Pattern 2: Configure Immediately (Rare)
```lua
-- This form auto-starts, so you cannot call :Start() again
local myTimer = Timer.New(function, interval, recurring)
-- Do NOT call :Start() on this timer
```

**Recommendation:** Use Pattern 1 for clarity and consistency.

---

## Checklist for Lua Script Implementation

When writing Q-SYS Lua scripts:

### Scope & Definition
- [ ] All timers declared at **module/global scope** (not inside functions)
- [ ] All functions that will be called during runtime defined **at module scope**
- [ ] Functions defined **BEFORE** any code that calls them
- [ ] Functions defined **outside** conditional blocks if they might be called unconditionally

### Timer Implementation
- [ ] Timer created with `Timer.New()` with no arguments (for consistency)
- [ ] EventHandler assigned before calling `:Start()`
- [ ] `:Start(interval)` called with numeric interval as parameter
- [ ] Check for existing timer before creating (`if not myTimer or not myTimer:Running()`)
- [ ] Proper cleanup with `:Stop()` when needed

### Event Handlers
- [ ] Control event handlers stored in variables defined at module scope
- [ ] Event handler functions can reference module-level functions
- [ ] Reconnection handlers can safely call all module-level functions

### Testing
- [ ] Test timer behavior across script reloads
- [ ] Test timer behavior across QRWC reconnects
- [ ] Test that event handlers still work after reconnection

---

## References

- [Q-SYS Control Scripting Documentation](https://help.qsys.com/q-sys_9.13/#Control_Scripting/Using_Lua_in_Q-Sys/Control_Scripting.htm)
- [Timer Object API](https://help.qsys.com/q-sys_9.13/#Control_Scripting/Using_Lua_in_Q-Sys/Timer.htm?Highlight=timer)
- Project File: `lua/WebSocketComponentDiscovery.lua`

---

## Revision History

| Date | Issue | Fix |
|------|-------|-----|
| 2026-01-15 | Timer initialization error in reconnectionCheckTimer | Changed to global scope + correct Start() pattern |
| 2026-01-15 | WriteJsonToControl nil error during reconnect | Moved function to module scope for visibility |
