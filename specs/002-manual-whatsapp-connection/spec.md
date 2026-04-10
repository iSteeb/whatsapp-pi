# Feature Specification: Manual WhatsApp Connection

**Feature Branch**: `002-manual-whatsapp-connection`  
**Created**: 2026-04-10  
**Status**: Draft  
**Input**: User description: "The connection is manual. First open the menu /whatsapp > Connect. Then you connect. This is to avoid conflict between two Pi Code Agents tui in the same socket."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Manual Connection via Menu (Priority: P1)

As a user, I want to explicitly initiate the WhatsApp connection through the TUI menu so that I have full control over when the agent joins the session.

**Why this priority**: This is the core requirement to prevent accidental session hijacking or conflicts between multiple agent instances.

**Independent Test**: Can be tested by launching the TUI and verifying that no connection is established until the user navigates to `/whatsapp > Connect`.

**Acceptance Scenarios**:

1. **Given** the TUI is launched, **When** no action is taken, **Then** the WhatsApp status remains "Disconnected".
2. **Given** the TUI is open, **When** the user selects `/whatsapp` and then `Connect`, **Then** the system begins the WhatsApp authentication/connection process.
3. **Given** a successful connection process, **When** completed, **Then** the status changes to "Connected".

---

### User Story 2 - Connection Status Visibility (Priority: P2)

As a user, I want to see the current connection status in the TUI so that I know if I need to initiate a connection.

**Why this priority**: Essential for user feedback since the connection is no longer automatic.

**Independent Test**: Can be tested by observing the status indicator change from "Disconnected" to "Connected" after the manual trigger.

**Acceptance Scenarios**:

1. **Given** a disconnected state, **When** the TUI is visible, **Then** a "Disconnected" indicator is shown.
2. **Given** the user has clicked "Connect", **When** the process is ongoing, **Then** a "Connecting..." indicator is shown.

---

### Edge Cases

- **Multiple Connection Attempts**: What happens if the user selects "Connect" while already connected or connecting? (Default: Option should be disabled or ignore the action).
- **Socket Already in Use**: How does the system handle the case where another instance is already using the WhatsApp socket? (Default: Show a descriptive error message to the user).
- **Network Failure**: How does the system report a failed connection attempt? (Default: Show "Connection Failed" and allow the user to retry manually).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST NOT automatically connect to WhatsApp upon TUI startup.
- **FR-002**: System MUST provide a command or menu path `/whatsapp` within the TUI interface.
- **FR-003**: System MUST provide a `Connect` action within the `/whatsapp` menu.
- **FR-004**: System MUST only initiate the WhatsApp connection sequence (including QR code generation if necessary) upon user selection of the `Connect` action.
- **FR-005**: System MUST display the current WhatsApp connection state (Disconnected, Connecting, Connected) in a visible area of the TUI.
- **FR-006**: System MUST provide a dynamic menu item that toggles between "Connect" and "Disconnect" based on the current connection state.

### Key Entities *(include if feature involves data)*

- **Connection State**: Represents the current status of the WhatsApp link (Disconnected, Connecting, Connected, Error).
- **TUI Menu**: The hierarchical interface allowing access to the `/whatsapp` commands.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of WhatsApp connections are initiated exclusively by manual user action.
- **SC-002**: The connection status indicator updates within 500ms of any state change.
- **SC-003**: Users can successfully navigate from startup to a "Connected" state in under 4 menu interactions.

## Assumptions

- The TUI framework supports hierarchical menus or slash-commands.
- A "socket conflict" refers to multiple instances trying to bind to the same authentication session or port simultaneously.
- The user is responsible for ensuring only one instance is active if they choose to connect.
- Persistent session data exists but will not be used for auto-connection on startup.
