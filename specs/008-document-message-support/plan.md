# Implementation Plan: Implement Document Message Support

**Branch**: `008-document-message-support` | **Date**: 2026-04-13 | **Spec**: [specs/008-document-message-support/spec.md]
**Input**: Feature specification from `/specs/008-document-message-support/spec.md`

## Summary

The goal is to implement support for `documentMessage` in the WhatsApp-Pi integration. When a user sends a document (PDF, etc.), the bot will download it using Baileys, save it to a local directory (`.pi-data/whatsapp/documents/`), and notify the Pi agent with the file's metadata and local path. The agent can then use its tools (like `bash` with `pdftotext`) to process the content.

## Technical Context

**Language/Version**: TypeScript 5.x / Node.js 20+
**Primary Dependencies**: `@whiskeysockets/baileys`, `pi-agent-sdk` (Extension API)
**Storage**: Local filesystem persistent storage in `.pi-data/whatsapp/documents/`
**Testing**: `npm test` (Vitest)
**Target Platform**: Node.js / Pi Coding Agent
**Project Type**: CLI Extension / WhatsApp Integration
**Performance Goals**: Document processing (download + notification) should complete in under 2 seconds for small/medium files.
**Constraints**: Must operate within the Pi Extension lifecycle; storage must be project-local.
**Scale/Scope**: Single message processing within the callback loop.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **I. OOP**: Does the design use appropriate classes/interfaces? (Will use existing `WhatsAppService` and `SessionManager` patterns)
- [x] **II. Clean Code**: Are names meaningful and functions focused? (New handler functions will be small and descriptive)
- [x] **III. SOLID**: Does the design respect SOLID principles? (Extending existing callback logic without breaking current handlers)
- [x] **IV. TypeScript**: Is the typing strict and appropriate? (Strict typing for message structures and metadata)
- [x] **V. Simplicity**: Is this the simplest possible implementation? (Direct download and notify flow)

## Project Structure

### Documentation (this feature)

```text
specs/008-document-message-support/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (generated later)
```

### Source Code (repository root)

```text
src/
├── models/
│   └── whatsapp.types.ts
├── services/
│   ├── whatsapp.service.ts
│   └── message.sender.ts
└── whatsapp-pi.ts       # Entry point / Extension logic

.pi-data/
└── whatsapp/
    └── documents/       # New storage location
```

**Structure Decision**: Standard single project structure with services and models. Storage is isolated in `.pi-data/`.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |
