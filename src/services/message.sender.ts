import { WhatsAppService } from './whatsapp.service.js';
import { MessageRequest, MessageResult, OutgoingContent, WhatsAppError } from '../models/whatsapp.types.js';

/**
 * Appends the π suffix used for loop-prevention to the appropriate text field.
 * - text → appended to text string
 * - image/video/document with caption → appended to caption
 * - audio or media without caption → no suffix (audio has no caption field;
 *   loop prevention relies on the allow-list and fromMe filtering instead)
 */
function applyPiSuffix(content: OutgoingContent): any {
    switch (content.kind) {
        case 'text':
            return { text: `${content.text} π` };
        case 'image':
            return {
                image: content.buffer,
                caption: content.caption ? `${content.caption} π` : undefined
            };
        case 'video':
            return {
                video: content.buffer,
                caption: content.caption ? `${content.caption} π` : undefined,
                ...(content.mimetype ? { mimetype: content.mimetype } : {})
            };
        case 'audio':
            return {
                audio: content.buffer,
                ...(content.mimetype ? { mimetype: content.mimetype } : {})
            };
        case 'document':
            return {
                document: content.buffer,
                mimetype: content.mimetype,
                fileName: content.fileName,
                caption: content.caption ? `${content.caption} π` : undefined
            };
    }
}

export class MessageSender {
    private whatsappService: WhatsAppService;

    constructor(whatsappService: WhatsAppService) {
        this.whatsappService = whatsappService;
    }

    /**
     * Pauses execution for the specified time.
     * @param ms Milliseconds to sleep.
     */
    private async sleep(ms: number) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Waits for the WhatsApp connection to be active.
     * @param timeoutMs Maximum time to wait in milliseconds.
     * @throws {WhatsAppError} If connection is not established within timeout.
     */
    private async waitIfOffline(timeoutMs: number = 30000): Promise<void> {
        const start = Date.now();
        while (this.whatsappService.getStatus() !== 'connected') {
            if (Date.now() - start > timeoutMs) {
                throw new WhatsAppError('TIMEOUT', 'Timed out waiting for WhatsApp connection');
            }
            await this.sleep(1000);
        }
    }

    /**
     * Sends a message with retry logic and connection awareness.
     * @param request The message recipient and content.
     * @returns Promise resolving to a result object indicating success or failure.
     */
    public async send(request: MessageRequest): Promise<MessageResult> {
        const maxRetries = request.options?.maxRetries ?? 3;
        let attempts = 0;
        let lastError: unknown = null;

        while (attempts < maxRetries) {
            attempts++;
            try {
                // 1. Ensure we are online
                await this.waitIfOffline();
                
                // 2. Get active socket
                const socket = this.whatsappService.getSocket();
                if (!socket) {
                    throw new WhatsAppError('SOCKET_NOT_INIT', 'WhatsApp socket not initialized');
                }

                // 3. Build the Baileys content payload (π suffix applied inside)
                const baileysContent = applyPiSuffix(request.content);

                // 4. Send the message
                const response = await socket.sendMessage(request.recipientJid, baileysContent);

                return {
                    success: true,
                    messageId: response?.key?.id,
                    attempts
                };
            } catch (error: unknown) {
                lastError = error;
                console.error(`[MessageSender] Attempt ${attempts} failed for ${request.recipientJid}: ${error instanceof Error ? error.message : String(error)}`);
                
                // Specific handling for non-retryable errors
                if (error instanceof WhatsAppError && error.code === 'TIMEOUT') {
                    break;
                }

                // 5. Backoff before retry
                if (attempts < maxRetries) {
                    const backoff = Math.pow(2, attempts) * 1000;
                    if (this.whatsappService.isVerbose()) {
                        console.log(`[MessageSender] Retrying in ${backoff}ms...`);
                    }
                    await this.sleep(backoff);
                }
            }
        }

        return {
            success: false,
            error: lastError instanceof Error ? lastError.message : 'Unknown error',
            attempts
        };
    }
}
