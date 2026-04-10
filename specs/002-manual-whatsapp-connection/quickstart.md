# Quickstart: Manual WhatsApp Connection

## How to use

1. **Launch the Agent**: Open the Pi Code Agent TUI as usual.
2. **Observe Disconnected State**: On startup, WhatsApp will remain disconnected. No automatic login will occur.
3. **Open Menu**: Type `/whatsapp` to open the management menu.
4. **Connect**:
    - Select **Connect WhatsApp** (or **Login** if first time).
    - If needed, scan the QR code displayed in the terminal.
5. **Observe Connection**: The status bar will show "WhatsApp: Connected".
6. **Disconnect**:
    - Type `/whatsapp` again.
    - Select **Disconnect WhatsApp**.
    - The socket is released, allowing other agents to use the same session if needed.

## Verification
- Run two TUI instances.
- Verify that neither connects automatically.
- Connect one, then disconnect it.
- Connect the second one.
- Verify no "Conflict" or "Stream Erro" occurs.
