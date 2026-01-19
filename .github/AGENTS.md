# Agent Instructions

This file provides context for AI agents working on this repository.

## Quick Links

- **Main documentation:** See `docs/README.md` for full documentation index
- **Agent-specific context:** See `CLAUDE.md` in the repository root
- **Architecture:** See `docs/ARCHITECTURE.md`
- **Troubleshooting:** See `docs/TROUBLESHOOTING.md`

## Project Summary

**Q-SYS Component Browser** - Angular 20 application for Q-SYS audio/video control systems using QRWC WebSocket protocol.

## Key Files for Context

| File | Purpose |
|------|---------|
| `CLAUDE.md` | Detailed agent instructions and code patterns |
| `docs/README.md` | Documentation index |
| `docs/ARCHITECTURE.md` | System architecture |
| `docs/APP-LEVEL-DISCOVERY-ARCHITECTURE.md` | Custom view development pattern |
| `src/app/services/qsys.service.ts` | Main QRWC service |
| `src/app/services/app-initialization.service.ts` | App initialization |

## Critical Pattern

All custom views must wait for app initialization:

```typescript
ngOnInit(): void {
  this.waitForAppInit().then(() => {
    // Safe to use Q-SYS services
  });
}
```

See `CLAUDE.md` or `docs/APP-LEVEL-DISCOVERY-ARCHITECTURE.md` for details.
