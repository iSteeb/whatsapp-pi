# Data Model: Document Message Support

## Entities

### DocumentMetadata
Represents the metadata for a document received via WhatsApp and saved locally.

| Field | Type | Description |
|-------|------|-------------|
| `filename` | `string` | The original filename provided by the sender. |
| `mimetype` | `string` | The MIME type of the document (e.g., `application/pdf`). |
| `size` | `number` | File size in bytes. |
| `savedPath` | `string` | The relative path from the project root to the saved file. |
| `timestamp` | `number` | When the document was received (Unix timestamp). |

## Validation Rules

1. **Filename**: Must be sanitized to remove illegal characters and path traversal segments.
2. **Storage**: Must be saved under `.pi-data/whatsapp/documents/`.
3. **Uniqueness**: Every saved file must have a unique name on disk (e.g., prefix with timestamp).
