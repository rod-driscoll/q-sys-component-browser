# Documentation

This directory contains technical documentation for the Q-SYS Component Browser application.

## Documents

### [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
**Start here if you're experiencing issues.**

Quick reference guide for common problems:
- "Change group does not exist" errors
- Controls not updating
- Component not found warnings
- Network disconnection issues
- RPC errors

Includes debugging tips, log patterns, and solutions.

### [changegroup-reconnection-fix.md](./changegroup-reconnection-fix.md)
**Deep dive into the ChangeGroup reconnection issue and its solution.**

Comprehensive documentation covering:
- Problem overview and symptoms
- Root cause analysis
- Complete solution with code examples
- Testing procedures
- Prevention guidelines and best practices

Read this to understand why the reconnection mechanism exists and how it works.

### [ARCHITECTURE.md](./ARCHITECTURE.md)
**Understanding the system architecture.**

Complete architectural overview:
- ChangeGroup polling system
- Component lifecycle management
- Connection and reconnection flows
- Design decisions and rationale
- Performance and security considerations
- Testing strategies

Read this to understand the overall system design and implementation details.

## Quick Start

### For Developers

1. **First time working with the codebase?**
   - Read [ARCHITECTURE.md](./ARCHITECTURE.md) to understand the system
   - Focus on "ChangeGroup Polling System" and "Architecture Layers" sections

2. **Experiencing an issue?**
   - Check [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) first
   - Look for your specific error message or symptom
   - Follow the suggested solutions

3. **Working on ChangeGroup-related code?**
   - Read [changegroup-reconnection-fix.md](./changegroup-reconnection-fix.md)
   - Follow the "Prevention Guidelines" section
   - Review "Code Patterns to Follow"

### For QA/Testing

1. **Testing reconnection scenarios:**
   - See [changegroup-reconnection-fix.md § Testing the Fix](./changegroup-reconnection-fix.md#testing-the-fix)
   - Follow "How to Verify It Works" checklist
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

### Scenario: New developer joining the team

**Recommended reading order:**
1. This README (you are here)
2. [ARCHITECTURE.md](./ARCHITECTURE.md) - Overview of system
3. [changegroup-reconnection-fix.md](./changegroup-reconnection-fix.md) - Key implementation detail
4. [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - Common issues to be aware of

**Time investment:** ~30-45 minutes total

### Scenario: User reports "controls not updating"

**Troubleshooting steps:**
1. Check [TROUBLESHOOTING.md § Controls Not Updating](./TROUBLESHOOTING.md#controls-not-updating)
2. Review console logs (see Debugging Tips section)
3. Verify component registration in Q-SYS Design
4. If ChangeGroup errors appear, see [changegroup-reconnection-fix.md](./changegroup-reconnection-fix.md)

**Time investment:** ~5-10 minutes

### Scenario: Implementing a new component type

**Implementation guidance:**
1. Review [ARCHITECTURE.md § Component Loading](./ARCHITECTURE.md#2-component-loading)
2. Follow existing patterns in `ComponentWrapper`
3. Add to `requiredComponents` or `optionalComponents`
4. Test reconnection scenario (see changegroup-reconnection-fix.md § Testing)
5. Update TROUBLESHOOTING.md if new issues arise

**Time investment:** Implementation varies, testing ~15 minutes

### Scenario: Investigating reconnection failures

**Investigation steps:**
1. Capture full console logs (see [TROUBLESHOOTING.md § Debugging Tips](./TROUBLESHOOTING.md#debugging-tips))
2. Compare against "Healthy operation" and "Successful reconnection" log patterns
3. Check if "Detected reconnection #N" message appears
4. Review [changegroup-reconnection-fix.md § Solution](./changegroup-reconnection-fix.md#solution)
5. Verify callback is registered (see [ARCHITECTURE.md § Reconnection Lifecycle](./ARCHITECTURE.md#reconnection-lifecycle))

**Time investment:** ~15-30 minutes

## Key Concepts

### ChangeGroup
Q-SYS's mechanism for efficiently receiving control value updates. A ChangeGroup has a UUID and tracks which controls are registered. Only changed values are returned when polling.

**Learn more:** [ARCHITECTURE.md § What is a ChangeGroup?](./ARCHITECTURE.md#what-is-a-changegroup)

### Poll Interception
We override QRWC's internal `poll()` method to intercept and distribute control updates to all subscribers.

**Learn more:** [ARCHITECTURE.md § Why Poll Interception?](./ARCHITECTURE.md#why-poll-interception)

### ComponentWrapper
Custom wrapper around QRWC components that provides re-registration capability and control over component lifecycle.

**Learn more:** [ARCHITECTURE.md § Why ComponentWrapper?](./ARCHITECTURE.md#why-componentwrapper)

### Re-registration
When QRWC creates a new ChangeGroup (during reconnection), all components must re-register their controls with the new ChangeGroup ID. This is handled automatically via callback mechanism.

**Learn more:** [changegroup-reconnection-fix.md § Solution](./changegroup-reconnection-fix.md#solution)

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

## Related Files

### Source Code
- `src/app/services/qsys.service.ts` - Main Q-SYS connection service
- `src/app/custom-views/room-controls/services/qrwc-adapter.service.ts` - Component adapter
- `src/app/components/qsys-browser/qsys-browser.ts` - Component browser

### Configuration
- `src/environments/environment.ts` - Environment configuration
- `.claude/settings.local.json` - Claude Code settings

## Version History

| Date | Version | Changes |
|------|---------|---------|
| 2026-01-10 | 1.0.0 | Initial documentation creation<br>- Added TROUBLESHOOTING.md<br>- Added changegroup-reconnection-fix.md<br>- Added ARCHITECTURE.md |

## Feedback

If you find issues with the documentation or have suggestions for improvement:

1. Check if the issue is already documented
2. Verify the information is actually incorrect/outdated
3. Propose specific improvements
4. Submit via pull request or issue tracker

## License

This documentation is part of the Q-SYS Component Browser project and follows the same license as the main project.
