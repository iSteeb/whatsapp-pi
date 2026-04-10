# Research: Manual WhatsApp Connection

## Decision 1: Disabling Auto-Connect
- **Decision**: Remove the auto-connection logic from the `session_start` event handler in `whatsapp-pi.ts`.
- **Rationale**: Directly required by FR-001 to avoid socket conflicts between multiple agent instances.
- **Alternatives considered**: 
    - Checking for existing lock files (rejected as it's less reliable than manual control).

## Decision 2: Implementation of Toggle
- **Decision**: Update `MenuHandler.handleCommand` to provide a dynamic toggle "Connect WhatsApp" vs "Disconnect WhatsApp".
- **Rationale**: Simplifies the UI as per Principle V (Simplicity) and provides clear state-based actions.
- **TUI Integration**: Use `ctx.ui.select` to present the correct action based on `sessionManager.getStatus()`.

## Decision 3: Socket Lifecycle Management
- **Decision**: Implement a `stop()` method in `WhatsAppService` that calls `socket.end()` and cleans up event listeners.
- **Rationale**: Ensures that "Disconnect" actually releases the socket, fulfilling the goal of avoiding conflicts.

## Decision 4: Status Updates
- **Decision**: Update the TUI status bar using `ctx.ui.setStatus('whatsapp', ...)` whenever the connection state changes in `WhatsAppService`.
- **Rationale**: Provides immediate feedback to the user (FR-005).
