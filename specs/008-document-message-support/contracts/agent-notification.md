# Contract: Agent Notification for Documents

## Interface: Pi Agent Message

When a document is received, the WhatsApp-Pi extension sends a user message to the Pi agent using the following text format.

### Format
```text
[Document Received: {filename}]
MIME Type: {mimetype}
Size: {size_formatted}
Location: {saved_path}

Description: {caption_if_any}
```

### Example
```text
[Document Received: project_brief.pdf]
MIME Type: application/pdf
Size: 1.2 MB
Location: ./.pi-data/whatsapp/documents/1712999999_project_brief.pdf

Description: Here is the brief for the new feature.
```

## Behavior
- The notification is sent as a `sendUserMessage` with `deliverAs: "followUp"`.
- This ensures the agent sees the document as a new input and can respond using its tools.
