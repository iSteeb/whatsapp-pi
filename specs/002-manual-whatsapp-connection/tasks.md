# Tasks: Manual WhatsApp Connection

**Input**: Design documents from `/specs/002-manual-whatsapp-connection/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md

**Tests**: No explicit test suite requested in spec; validation via manual verification in TUI as per `quickstart.md`.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [X] T001 Verify project structure and `package.json` dependencies at repository root

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T002 Implement `stop()` method in `src/services/whatsapp.service.ts` to release the Baileys socket
- [X] T003 [P] Add 'disconnected' status to `SessionStatus` in `src/models/whatsapp.types.ts`
- [X] T004 [P] Add transition handling for 'disconnected' status in `src/services/session.manager.ts`

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Manual Connection via Menu (Priority: P1) 🎯 MVP

**Goal**: As a user, I want to explicitly initiate the WhatsApp connection through the TUI menu so that I have full control over when the agent joins the session.

**Independent Test**: Launch TUI; verify WhatsApp remains disconnected. Execute `/whatsapp > Connect`; verify connection starts.

### Implementation for User Story 1

- [X] T005 [US1] Remove auto-connection block from `session_start` event in `whatsapp-pi.ts`
- [X] T006 [P] [US1] Update `MenuHandler.handleCommand` in `src/ui/menu.handler.ts` to implement the Connect/Disconnect toggle logic
- [X] T007 [US1] Map "Connect" menu choice to `whatsappService.start()` in `src/ui/menu.handler.ts`
- [X] T008 [US1] Map "Disconnect" menu choice to `whatsappService.stop()` in `src/ui/menu.handler.ts`

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - Connection Status Visibility (Priority: P2)

**Goal**: As a user, I want to see the current connection status in the TUI so that I know if I need to initiate a connection.

**Independent Test**: Connect via menu and observe status bar updating from "Disconnected" to "Connecting" and finally "Connected".

### Implementation for User Story 2

- [X] T009 [US2] Update `WhatsAppService` in `src/services/whatsapp.service.ts` to trigger `ctx.ui.setStatus` on connection updates
- [X] T010 [US2] Initialize TUI status to "WhatsApp: Disconnected" in `whatsapp-pi.ts` upon `session_start`

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [X] T011 [P] Implement error notification for "Socket already in use" in `src/services/whatsapp.service.ts`
- [X] T012 Run `quickstart.md` validation to ensure no socket conflicts occur between instances

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - User Story 1 (P1) is the MVP and should be completed first
  - User Story 2 (P2) depends on the connection infrastructure from US1
- **Polish (Final Phase)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2)
- **User Story 2 (P2)**: Can start after Foundational (Phase 2), but implementation relies on status changes triggered by US1 actions

### Within Each User Story

- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities

- T003 and T004 can run in parallel
- T006 [P] [US1] can be developed in parallel with T005
- T011 [P] can be developed independently of the main UI flow

---

## Parallel Example: User Story 1

```bash
# Launch menu logic and entry point updates together:
Task: "Update MenuHandler.handleCommand in src/ui/menu.handler.ts to implement the Connect/Disconnect toggle logic"
Task: "Remove auto-connection block from session_start event in whatsapp-pi.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Verify manual connection/disconnection via `/whatsapp` menu.

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deliver manual connection control (MVP)
3. Add User Story 2 → Test independently → Deliver status bar visibility
4. Final Polish → Deliver robust error handling and conflict verification
