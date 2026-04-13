# Quickstart: Testing Document Support

## Setup
1. Ensure `whatsapp-pi` is running and connected (`/whatsapp` to check).
2. Ensure `pdftotext` is installed on your system.

## Test Flow

### 1. Basic Reception
1. Send a PDF file named `test.pdf` to your WhatsApp bot.
2. Check the TUI logs for: `[WhatsApp-Pi] Received document: test.pdf`.
3. Verify the file exists in `.pi-data/whatsapp/documents/`.

### 2. Agent Processing
1. Send another PDF.
2. Wait for the agent (Pi) to acknowledge receipt.
3. Ask the agent: "Can you read the content of the PDF I just sent and summarize it?"
4. Observe the agent using the `bash` tool with `pdftotext` to read the file.

## Expected Log Output
```text
[WhatsApp-Pi] Downloading document from User...
[WhatsApp-Pi] Document saved to ./.pi-data/whatsapp/documents/123456789_test.pdf
[WhatsApp-Pi] Notifying agent about document...
```
