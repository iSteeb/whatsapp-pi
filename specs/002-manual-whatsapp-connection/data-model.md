# Data Model: Manual WhatsApp Connection

## Entities

### ConnectionState
Represents the lifecycle of the WhatsApp connection.

- **Status Enum**:
    - `logged-out`: No credentials present.
    - `pairing`: QR code generated, waiting for scan.
    - `connected`: Socket open and authenticated.
    - `disconnected`: Credentials present but socket closed by user.
    - `error`: Connection failed due to network or session issues.

### WhatsAppSession (Persisted)
Stored in `.pi-data/config.json`.

- `status`: Current `ConnectionState`.
- `allowList`: List of phone numbers allowed to interact with the agent.

## State Transitions

| Initial State | Action | Next State | Description |
|---------------|--------|------------|-------------|
| `logged-out` | "Connect/Login" | `pairing` | Generates QR code. |
| `pairing` | Scan QR | `connected` | Authentication successful. |
| `connected` | "Disconnect" | `disconnected` | Socket closed manually. |
| `disconnected` | "Connect" | `connected` | Socket opened manually. |
| `connected` | Crash/Error | `error` | Unexpected socket closure. |
