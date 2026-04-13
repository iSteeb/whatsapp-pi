# Feature Specification: Implement Document Message Support

**Feature Branch**: `008-document-message-support`  
**Created**: 2026-04-13  
**Status**: Draft  
**Input**: User description: "Implement the documentMessage feature. @whatsapp-pi.ts, line 155, around. Only receive the PDF, save in somewhere and pass to agent, similar to image."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Receive and Save Document (Priority: P1)

As a WhatsApp user, I want to send a document to the bot so that it can be stored and accessed by the coding agent.

**Why this priority**: Core functionality requested by the user.

**Independent Test**: Send a PDF file named `proposal.pdf` to the bot. Verify that the file is saved in the local `.pi-data/whatsapp/documents/` directory.

**Acceptance Scenarios**:

1. **Given** the WhatsApp integration is active, **When** a user sends a document, **Then** the bot must download the file and save it to a persistent local directory.

---

### User Story 2 - Notify Agent of Saved Document (Priority: P1)

As a coding agent, I want to be notified when a document is received and where it is saved, so I can use my tools (like `read`) to inspect it if needed.

**Why this priority**: Essential for the agent to "receive" the document as requested.

**Independent Test**: Send a document. Observe the user message received by the Pi agent. It should contain the filename, size, and the local path to the file.

**Acceptance Scenarios**:

1. **Given** a document has been saved locally, **When** the bot forwards the message to Pi, **Then** it must include a text description: `[Document Received: filename (size bytes). Saved at: path/to/file]`.

---

### Edge Cases

- **Filename Conflicts**: What happens if two users send a file with the same name? (Assumption: Append a timestamp or unique ID to the filename).
- **Directory Creation**: What if the download directory doesn't exist? (Assumption: System creates it recursively).
- **Storage Limit**: What if the disk is full? (Assumption: Log error and notify user/agent).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST detect `documentMessage` in the incoming WhatsApp message stream.
- **FR-002**: System MUST download the document content using the provider's media stream.
- **FR-003**: System MUST save the downloaded document to `.pi-data/whatsapp/documents/` within the project root.
- **FR-004**: System MUST sanitize filenames to prevent path injection or filesystem issues.
- **FR-005**: System MUST ensure unique filenames by appending a timestamp or unique identifier.
- **FR-006**: System MUST notify the Pi agent via `sendUserMessage` with a text description containing the original filename, mime type, size, and the relative path to the saved file.
- **FR-007**: System MUST log the download and save operation to the console for TUI visibility.
- **FR-008**: System MUST verify the availability of `pdftotext` at startup and log a warning if it is missing, as it is the primary tool for the agent to read PDF content.

### Key Entities *(include if feature involves data)*

- **Received Document**: The binary file stored on disk.
- **Document Metadata**: Filename, MIME type, size, and local storage path.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of received documents are successfully saved to the designated directory.
- **SC-002**: The agent receives a notification message within 2 seconds of the document being fully downloaded.
- **SC-003**: Saved documents are accessible to the agent via standard tools, and the agent can successfully extract text from PDFs using `pdftotext` in the system environment.

## Assumptions

- **System Environment**: Assumes `pdftotext` is installed and available in the system PATH (verified as present in current environment).
- **Storage Location**: Using `.pi-data/whatsapp/documents/` ensures it stays within the project's data area.
- **No Direct Content Passing**: Unlike images (sent as base64), documents are passed as file paths because the agent has tools to read files, and documents can be very large.
