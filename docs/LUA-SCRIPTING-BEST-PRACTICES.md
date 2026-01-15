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

## Checklist for Timer Implementation

When implementing timers in Q-SYS Lua:

- [ ] Timer variable declared at **module/global scope** (not inside functions)
- [ ] Timer created with `Timer.New()` with no arguments (for consistency)
- [ ] EventHandler assigned before calling `:Start()`
- [ ] `:Start(interval)` called with numeric interval as parameter
- [ ] Check for existing timer before creating (`if not myTimer or not myTimer:Running()`)
- [ ] Proper cleanup with `:Stop()` when needed
- [ ] Test timer behavior across script reloads/reconnects

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
