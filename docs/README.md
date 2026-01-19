# Documentation

This directory contains technical documentation for the Q-SYS Component Browser application.

## Core Documentation

### [APP-LEVEL-DISCOVERY-ARCHITECTURE.md](./APP-LEVEL-DISCOVERY-ARCHITECTURE.md) ⭐
**REQUIRED READING for all custom view development.**

Learn how app-level initialization works and the **mandatory pattern** for all custom views:
- Why `waitForAppInit()` is required for control feedback to work
- Complete code pattern with examples
- Updated components: file-browser, named-controls, media-playlists
- Creating new custom views with proper initialization

**Critical:** All custom views MUST wait for `initializationComplete` before accessing Q-SYS services.

### [ARCHITECTURE.md](./ARCHITECTURE.md)
**Understanding the system architecture.**

Complete architectural overview:
- ChangeGroup polling system and QRWC integration
- Component lifecycle management
- Connection and reconnection flows
- Design decisions and rationale (callback vs effects, poll interception)
- Performance and security considerations
- Testing strategies

Essential for understanding how QRWC automatic polling works and why manual polling is prohibited.

### [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
**Start here if you're experiencing issues.**

Quick reference guide for common problems:
- "Change group does not exist" errors
- Controls not updating (feedback not working)
- Component not found warnings
- Network disconnection issues
- RPC errors and timeouts

Includes debugging tips, log patterns, and solutions.

### [changegroup-reconnection-fix.md](./changegroup-reconnection-fix.md)
**Deep dive into the ChangeGroup reconnection issue and its solution.**

Comprehensive documentation covering:
- Problem overview and symptoms
- Root cause analysis (why ChangeGroup UUID changes)
- Complete solution with re-registration mechanism
- Testing procedures
- Prevention guidelines and best practices

Read this to understand the reconnection mechanism and ComponentWrapper pattern.

## Feature Documentation

### [SECURE_DISCOVERY_WALKTHROUGH.md](./SECURE_DISCOVERY_WALKTHROUGH.md)
**Secure component discovery via control-based communication.**

Covers:
- Dual-mode Lua script architecture (TunnelDiscovery.lua)
- Zero-config client discovery via json_input/json_output controls
- Configuration steps for secure tunnel
- Verification and testing

### [Q-SYS-COMBO-BOX-PATTERN.md](./Q-SYS-COMBO-BOX-PATTERN.md)
**How Q-SYS combo boxes work with choices.**

Explains:
- Choice-based control updates
- String vs Position vs Value
- Control metadata handling

## Development Guides

### [LUA-SCRIPTING-BEST-PRACTICES.md](./LUA-SCRIPTING-BEST-PRACTICES.md)
**Writing effective Lua scripts for Q-SYS.**

Best practices for:
- Function declaration order
- Avoiding forward reference errors
- Timer management
- Error handling patterns

### [CRESTRON-DEBUGGING.md](./CRESTRON-DEBUGGING.md)
**Debugging Q-SYS control issues.**

Tips for diagnosing control communication problems.

### [ERUDA-DEBUG-CONSOLE.md](./ERUDA-DEBUG-CONSOLE.md)
**Using Eruda mobile debug console.**

How to enable and use the Eruda console for mobile debugging.

### [IMPLEMENTATION-LOG.md](./IMPLEMENTATION-LOG.md)
**Historical log of major changes.**

Chronological record of significant features and fixes.

## Quick Start

### For New Developers

1. **Creating a new custom view?**
   - Read [APP-LEVEL-DISCOVERY-ARCHITECTURE.md](./APP-LEVEL-DISCOVERY-ARCHITECTURE.md) first
   - Copy the `waitForAppInit()` pattern from existing views
   - Test control feedback thoroughly

2. **Understanding the architecture?**
   - Start with [ARCHITECTURE.md](./ARCHITECTURE.md)
   - Focus on "ChangeGroup Polling System" section
   - Learn why manual polling is prohibited

3. **Experiencing control issues?**
   - Check [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
   - Look for "Controls not updating" section
   - Verify `waitForAppInit()` is being called

### For Existing Developers

1. **"Controls not updating" or "no feedback"?**
   - Ensure component uses `waitForAppInit()` pattern
   - Check console for initialization complete log
   - See [APP-LEVEL-DISCOVERY-ARCHITECTURE.md](./APP-LEVEL-DISCOVERY-ARCHITECTURE.md)

2. **"Change group does not exist" errors?**
   - Read [changegroup-reconnection-fix.md](./changegroup-reconnection-fix.md)
   - Check if ComponentWrapper re-registration is working
   - See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)

3. **Adding Q-SYS component integration?**
   - Read [ARCHITECTURE.md](./ARCHITECTURE.md) section on ComponentWrapper vs QSysComponent
   - Never create manual ChangeGroup polling loops
   - Use QRWC's automatic polling mechanism

### For QA/Testing

1. **Testing new custom views:**
   - Verify `waitForAppInit()` is implemented
   - Test hard refresh (Ctrl+Shift+R)
   - Navigate away and back to the view
   - Confirm control feedback works in all scenarios

2. **Testing reconnection scenarios:**
   - See [changegroup-reconnection-fix.md](./changegroup-reconnection-fix.md)
   - Follow testing procedures
   - Check console for re-registration logs
   - Compare logs against "What Success Looks Like"

2. **Investigating reported issues:**
   - Check [TROUBLESHOOTING.md § Debugging Tips](./TROUBLESHOOTING.md#debugging-tips)
   - Review "Common Log Patterns" section
   - Capture console logs for developers

### For Technical Writers

The documentation follows this structure:

```
TROUBLESHOOTING.md (User-facing, problem → solution)
     ↓ links to
changegroup-reconnection-fix.md (Detailed technical explanation)
     ↓ references
ARCHITECTURE.md (System design and implementation)
```

When updating documentation:
- Keep TROUBLESHOOTING.md concise and action-oriented
- Add detailed explanations to changegroup-reconnection-fix.md
- Update ARCHITECTURE.md for system-wide changes

## Common Scenarios

### Scenario: Creating a new custom view

**Required steps:**
1. Read [APP-LEVEL-DISCOVERY-ARCHITECTURE.md § Creating New Custom Views](./APP-LEVEL-DISCOVERY-ARCHITECTURE.md)
2. Copy `waitForAppInit()` pattern from existing view (file-browser, named-controls, or media-playlists)
3. Inject `AppInitializationService`
4. Call `waitForAppInit()` in `ngOnInit()` before any Q-SYS service calls
5. Test control feedback thoroughly

**Time investment:** ~10-15 minutes (plus your feature implementation)

### Scenario: New developer joining the team

**Recommended reading order:**
1. This README (you are here)
2. [APP-LEVEL-DISCOVERY-ARCHITECTURE.md](./APP-LEVEL-DISCOVERY-ARCHITECTURE.md) - **Critical for custom view development**
3. [ARCHITECTURE.md](./ARCHITECTURE.md) - System overview and ChangeGroup polling
4. [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - Common issues

**Time investment:** ~30-45 minutes total

### Scenario: User reports "controls not updating" or "no feedback"

**Troubleshooting steps:**
1. Verify component has `waitForAppInit()` - see [APP-LEVEL-DISCOVERY-ARCHITECTURE.md](./APP-LEVEL-DISCOVERY-ARCHITECTURE.md)
2. Check console for "App initialization complete" log
3. Review [TROUBLESHOOTING.md § Controls Not Updating](./TROUBLESHOOTING.md#controls-not-updating)
4. Verify QRWC connection is established
5. Check if ChangeGroup polling is active

**Time investment:** ~5-10 minutes

### Scenario: "Change group does not exist" errors flooding console

**Troubleshooting steps:**
1. Check [TROUBLESHOOTING.md § Change group does not exist](./TROUBLESHOOTING.md)
2. Review [changegroup-reconnection-fix.md](./changegroup-reconnection-fix.md) for detailed explanation
3. Verify re-registration is happening (check console logs)
4. Confirm ComponentWrapper pattern is used correctly

**Time investment:** ~10-15 minutes

## Key Concepts

### App-Level Initialization
All Q-SYS services (QRWC, discovery, Lua scripts) initialize at the application level before any page loads. Custom views **must** wait for `initializationComplete` to ensure services are ready.

**Learn more:** [APP-LEVEL-DISCOVERY-ARCHITECTURE.md](./APP-LEVEL-DISCOVERY-ARCHITECTURE.md)

### ChangeGroup
Q-SYS's mechanism for efficiently receiving control value updates. A ChangeGroup has a UUID and tracks which controls are registered. Only changed values are returned when polling. QRWC handles polling automatically - never create manual polling loops.

**Learn more:** [ARCHITECTURE.md § What is a ChangeGroup?](./ARCHITECTURE.md#what-is-a-changegroup)

### Poll Interception
We override QRWC's internal `poll()` method to intercept and distribute control updates to all subscribers without interfering with QRWC's automatic polling loop.

**Learn more:** [ARCHITECTURE.md § Why Poll Interception?](./ARCHITECTURE.md#why-poll-interception)

### ComponentWrapper vs QSysComponent
- **ComponentWrapper**: Used for components that need re-registration on reconnection (room-controls pattern)
- **QSysComponent**: Simpler pattern for basic control access without lifecycle management (media-playlists pattern)

**Learn more:** [ARCHITECTURE.md § Why ComponentWrapper?](./ARCHITECTURE.md#why-componentwrapper)

### Re-registration
When QRWC creates a new ChangeGroup (during reconnection), all components must re-register their controls with the new ChangeGroup ID. This is handled automatically via callback mechanism.

**Learn more:** [changegroup-reconnection-fix.md § Solution](./changegroup-reconnection-fix.md#solution)

## Best Practices

### For Custom View Development

1. **Always wait for app initialization**
   - Inject `AppInitializationService`
   - Call `waitForAppInit()` in `ngOnInit()`
   - Never access Q-SYS services before initialization completes
   - See [APP-LEVEL-DISCOVERY-ARCHITECTURE.md](./APP-LEVEL-DISCOVERY-ARCHITECTURE.md)

2. **Never create manual polling loops**
   - QRWC handles ChangeGroup polling automatically (350ms default)
   - Use poll interception for control updates
   - Q-SYS recommends 30-60s for typical UIs
   - See [ARCHITECTURE.md § Polling Interval](./ARCHITECTURE.md)

3. **Use the correct component pattern**
   - **QSysComponent**: Simple control access (media-playlists pattern)
   - **ComponentWrapper**: Full lifecycle with re-registration (room-controls pattern)
   - See [ARCHITECTURE.md § ComponentWrapper](./ARCHITECTURE.md)

4. **Test thoroughly**
   - Hard refresh (Ctrl+Shift+R)
   - Navigate away and back
   - Test with slow network conditions
   - Verify control feedback works in all scenarios

## Related Files

### Critical Source Files
- [src/app/services/app-initialization.service.ts](../src/app/services/app-initialization.service.ts) - App-level initialization
- [src/app/services/qsys.service.ts](../src/app/services/qsys.service.ts) - QRWC connection and ChangeGroup
- [src/app/models/qsys-components.ts](../src/app/models/qsys-components.ts) - QSysComponent and controls

### Reference Implementations
- [src/app/custom-views/file-browser/](../src/app/custom-views/file-browser/) - With app init wait
- [src/app/custom-views/named-controls/](../src/app/custom-views/named-controls/) - With app init wait
- [src/app/custom-views/media-playlists/](../src/app/custom-views/media-playlists/) - With app init wait

## Contributing to Documentation

### Adding New Documentation

1. **Determine which document to update:**
   - User-facing issue/solution → TROUBLESHOOTING.md
   - Implementation detail/fix → changegroup-reconnection-fix.md
   - System design/architecture → ARCHITECTURE.md

2. **Follow existing format:**
   - Use clear headings
   - Include code examples
   - Add links between related sections
   - Update this README if adding new major sections

3. **Keep it current:**
   - Update docs when code changes
   - Remove outdated information
   - Add timestamps for time-sensitive information

### Documentation Style

- **Code examples:** Use TypeScript with syntax highlighting
- **Logs:** Use code blocks with actual log output
- **Decisions:** Explain "why" not just "what"
- **Links:** Use relative links between docs
- **Tone:** Professional but approachable

## Feedback

Found issues or have suggestions?

1. Check if already documented
2. Verify information is incorrect/outdated
3. Propose specific improvements
4. Consider which document should be updated
