# Research: Implement Document Message Support

**Decision**: Use `downloadContentFromMessage` from `@whiskeysockets/baileys` to fetch documents and save them to a local project directory.

## Decisions & Rationale

### 1. Storage Location
- **Decision**: `./.pi-data/whatsapp/documents/`
- **Rationale**: Follows the existing project pattern for persistent data storage. It is isolated from the source code and easy for the agent to find.

### 2. Document Download Mechanism
- **Decision**: Use `downloadContentFromMessage(msg.message.documentMessage, 'document')`.
- **Rationale**: This is the standard Baileys API for media downloads, consistent with how images are handled in the current codebase.

### 3. Filename Sanitization
- **Decision**: Replace non-alphanumeric characters (except dots, dashes, and underscores) with underscores. Append a unique timestamp to prevent collisions.
- **Rationale**: Prevents path injection attacks and ensures unique files even if multiple users send files with identical names (e.g., `invoice.pdf`).

### 4. PDF Tooling
- **Decision**: Rely on system-installed `pdftotext` for agent-side processing.
- **Rationale**: `pdftotext` is verified as present in the target environment (Msys/MinGW). It provides a simple CLI interface that the Pi agent can use via its `bash` tool without requiring additional Node.js dependencies for PDF parsing.

## Alternatives Considered

### a. Base64 Content Passing (like images)
- **Rejected because**: Documents (especially PDFs) can be significantly larger than images, potentially hitting token or memory limits if passed directly in the message array. Local file access via agent tools is more robust for documents.

### b. Native Node.js PDF Library (e.g., `pdf-parse`)
- **Rejected because**: Adds more dependencies to the extension. Using the system's `pdftotext` via `bash` is simpler and leverages existing agent capabilities.

## Technical Details

### Filename Sanitization Pattern:
```typescript
const sanitized = originalName.replace(/[^a-z0-9\._-]/gi, '_');
const uniqueName = `${Date.now()}_${sanitized}`;
```

### Directory Creation:
```typescript
import { mkdir } from 'node:fs/promises';
await mkdir(docDir, { recursive: true });
```
