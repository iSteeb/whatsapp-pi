# Implementation Plan: Manual WhatsApp Connection

**Branch**: `002-manual-whatsapp-connection` | **Date**: 2026-04-10 | **Spec**: [/specs/002-manual-whatsapp-connection/spec.md](../spec.md)
**Input**: Feature specification from `/specs/002-manual-whatsapp-connection/spec.md`

## Summary
The system will be modified to prevent automatic WhatsApp connection on startup. A manual "Connect/Disconnect" toggle will be implemented in the `/whatsapp` menu to give users explicit control over the socket lifecycle, preventing conflicts between multiple agent instances.

## Technical Context

**Language/Version**: TypeScript 5.x / Node.js 20+
**Primary Dependencies**: `@whiskeysockets/baileys`, `qrcode-terminal`, `pi-agent-sdk`
**Storage**: Local file-based multi-file auth state (baileys)
**Testing**: `npm test`
**Target Platform**: Node.js / TUI
**Project Type**: Agent extension
**Performance Goals**: Instant UI feedback for connection state changes
**Constraints**: Single socket per session, manual control required
**Scale/Scope**: Small extension module

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **I. OOP**: Uses WhatsAppService and MenuHandler classes.
- [x] **II. Clean Code**: Meaningful method names like `start()`, `stop()`, `handleCommand()`.
- [x] **III. SOLID**: WhatsAppService focuses on connection; MenuHandler focuses on UI.
- [x] **IV. TypeScript**: Strict typing for SessionStatus and event payloads.
- [x] **V. Simplicity**: Minimal toggle logic instead of complex lock mechanisms.

## Project Structure

### Documentation (this feature)

```text
specs/002-manual-whatsapp-connection/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── spec.md              # Feature specification
```

### Source Code (repository root)

```text
src/
├── models/
│   └── whatsapp.types.ts
├── services/
│   ├── whatsapp.service.ts
│   └── session.manager.ts
└── ui/
    └── menu.handler.ts

whatsapp-pi.ts           # Main entry point
```

**Structure Decision**: Standard monolithic structure as the project is a single-purpose extension.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |
