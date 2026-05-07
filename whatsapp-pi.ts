import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { SessionManager } from './src/services/session.manager.js';
import { WhatsAppService } from './src/services/whatsapp.service.js';
import { MenuHandler } from './src/ui/menu.handler.js';
import { RecentsService } from './src/services/recents.service.js';
import { AudioService } from './src/services/audio.service.js';
import { extractIncomingText } from './src/services/incoming-message.resolver.js';
import { IncomingMediaService } from './src/services/incoming-media.service.js';
import { WhatsAppPiLogger } from './src/services/whatsapp-pi.logger.js';
import { validateAndReadAttachment } from './src/services/attachment.helper.js';
import type { OutgoingKind } from './src/models/whatsapp.types.js';

const shutdownState = globalThis as typeof globalThis & {
    __whatsappPiShutdown?: {
        installed: boolean;
        stop?: () => Promise<void>;
    };
};

export default function (pi: ExtensionAPI) {
    // Register verbose flag
    pi.registerFlag("verbose", {
        description: "Enable verbose mode (show Baileys trace logs)",
        type: "boolean",
        default: false
    });

    pi.registerFlag("whatsapp-pi-online", {
        description: "Enable WhatsApp-Pi on startup",
        type: "boolean",
        default: false
    });

    const sessionManager = new SessionManager();
    const whatsappService = new WhatsAppService(sessionManager);
    const recentsService = new RecentsService(sessionManager);
    const audioService = new AudioService();
    const logger = new WhatsAppPiLogger(false);
    const incomingMediaService = new IncomingMediaService(audioService, logger);
    const menuHandler = new MenuHandler(whatsappService, sessionManager, recentsService);
    let _ctx: ExtensionContext | undefined;

    const installGracefulShutdownHandlers = () => {
        shutdownState.__whatsappPiShutdown ??= { installed: false };
        if (shutdownState.__whatsappPiShutdown.installed) {
            return;
        }

        shutdownState.__whatsappPiShutdown.installed = true;
        
        const shutdown = async (reason: string) => {
            try {
                await shutdownState.__whatsappPiShutdown?.stop?.();
            } catch (error) {
                logger.error(`[WhatsApp-Pi] Graceful shutdown failed during ${reason}:`, error);
            }
        };

        process.once('SIGINT', () => { void shutdown('SIGINT'); });
        process.once('SIGTERM', () => { void shutdown('SIGTERM'); });
    };

    // Initial status setup
    pi.on("session_start", async (_event, ctx) => {
        _ctx = ctx;
        // Check verbose mode
        const isVerboseFlagSet = process.argv.includes("--verbose");

        const isVerbose = isVerboseFlagSet;

        whatsappService.setVerboseMode(isVerbose);
        logger.setVerbose(isVerbose);

        if (isVerbose) {
            logger.log('[WhatsApp-Pi] Verbose mode enabled - Baileys trace logs will be shown');
        }
        ctx.ui.setStatus('whatsapp', '| WhatsApp: Disconnected');
        whatsappService.setStatusCallback((status) => {
            ctx.ui.setStatus('whatsapp', status);
        });
        await sessionManager.ensureInitialized();
        await recentsService.ensureInitialized();
        installGracefulShutdownHandlers();
        shutdownState.__whatsappPiShutdown = {
            installed: shutdownState.__whatsappPiShutdown?.installed ?? false,
            stop: async () => {
                await whatsappService.stop();
            }
        };
        whatsappService.setIncomingMessageRecorder(async (message) => {
            await recentsService.recordMessage({
                messageId: message.id,
                senderNumber: `+${message.remoteJid.split('@')[0]}`,
                senderName: message.pushName,
                text: message.text || '',
                direction: 'incoming',
                timestamp: message.timestamp
            });
        });

        const savedStateEntry = [...ctx.sessionManager.getEntries()]
            .reverse()
            .find(entry => entry.type === "custom" && entry.customType === "whatsapp-state");
        const isWhatsappPiOn = pi.getFlag("whatsapp-pi-online") === true;
        const registered = await sessionManager.isRegistered();

        if (savedStateEntry) {
            const data = (savedStateEntry as { data?: any }).data;
            if (data.status) {
                const restoredStatus = data.status === 'connected' && !(isWhatsappPiOn && registered)
                    ? 'disconnected'
                    : data.status;
                await sessionManager.setStatus(restoredStatus);
            }
            if (Array.isArray(data.allowList)) {
                for (const n of data.allowList) {
                    const num = typeof n === "string" ? n : n.number;
                    const name = typeof n === "string" ? undefined : n.name;
                    await sessionManager.addNumber(num, name);
                }
            }
        }

        if (isWhatsappPiOn && registered) {
            ctx.ui.setStatus('whatsapp', '| WhatsApp: Auto-connecting...');

            // Retry logic (max 3 attempts, 3s delay)
            let attempts = 0;
            const maxAttempts = 4; // Initial + 3 retries

            const tryConnect = async () => {
                attempts++;
                try {
                    await whatsappService.start({ allowPairingOnAuthFailure: false });
                } catch {
                    if (attempts < maxAttempts) {
                        ctx.ui.notify(`WhatsApp: Connection attempt ${attempts} failed. Retrying...`, 'warning');
                        setTimeout(tryConnect, 3000);
                    } else {
                        ctx.ui.notify('WhatsApp: Auto-connect failed after multiple attempts.', 'error');
                        ctx.ui.setStatus('whatsapp', '|  WhatsApp: Connection Failed');
                    }
                }
            };

            await tryConnect();
        } else if (isWhatsappPiOn) {
            ctx.ui.notify('WhatsApp: Auto-connect requested, but no saved WhatsApp credentials were found. Use Connect WhatsApp once to scan the QR code.', 'warning');
        } else {
            ctx.ui.notify('WhatsApp: Use Connect / Reconnect WhatsApp. QR code will appear only if pairing is needed.', 'info');
        }

        ctx.ui.notify('WhatsApp: Session reset via /new is now fully supported.', 'info');

        // Verify pdftotext availability for document support
        try {
            const { code } = await pi.exec('pdftotext', ['-v']);
            if (code !== 0 && code !== 99) { // 99 is a common exit code for -v in some versions
                throw new Error(`pdftotext returned code ${code}`);
            }
        } catch {
            ctx.ui.notify('WhatsApp: pdftotext not found. PDF document support will be limited to storage only.', 'warning');
            logger.warn('[WhatsApp-Pi] Warning: pdftotext not found in system PATH.');
        }
    });

    // Handle incoming messages by injecting them as user prompts
    whatsappService.setMessageCallback(async (m) => {
        const msg = m.messages?.[0];
        if (!msg?.message) return;

        const sender = msg.key.remoteJid?.split('@')[0] || "unknown";
        const pushName = msg.pushName || "WhatsApp User";

        // Mark as read and start typing indicator immediately
        const remoteJid = msg.key.remoteJid;
        if (remoteJid && msg.key.id) {
            whatsappService.markRead(remoteJid, msg.key.id, msg.key.fromMe);
            whatsappService.sendPresence(remoteJid, 'composing');
        }

        const resolved = extractIncomingText(msg.message);
        if (resolved.kind === 'system') {
            logger.log(`[WhatsApp-Pi] ${pushName} (${sender}): ${resolved.text}`);
            return;
        }

        const { text, imageBuffer, imageMimeType } = await incomingMediaService.process(resolved, pushName);

        logger.log(`[WhatsApp-Pi] ${pushName} (${sender}): ${text}`);

        // Use a standard delivery for ALL messages to ensure TUI consistency
        if (imageBuffer && imageMimeType) {
            pi.sendUserMessage([
                { type: "text", text: `Message from ${pushName} (${sender}): ${text}` },
                { type: "image", data: imageBuffer.toString('base64'), mimeType: imageMimeType }
            ], { deliverAs: "followUp" });
        } else {
            pi.sendUserMessage(`Message from ${pushName} (${sender}): ${text}`, { deliverAs: "followUp" });
        }

        // Handle commands
        if (text.trim().toLowerCase().startsWith('/compact')) {
            logger.log(`[WhatsApp-Pi] Session compact requested by ${pushName}.`);

            if (_ctx) {
                _ctx.compact();
                await whatsappService.sendMessage(remoteJid!, "Session compacted successfully! ✅");
            }
            return;
        }

        if (text.trim().toLowerCase().startsWith('/abort')) {
            logger.log(`[WhatsApp-Pi] Abort requested by ${pushName}.`);
            if (_ctx) {
                _ctx.abort();
                await whatsappService.sendMessage(remoteJid!, "Aborted! ✅");
            }
            return;
        }

        
    });

    /**
     * Resolve a recipient string (digits, +-number, or full JID) into the canonical
     * JID we have actually observed for that party. Business accounts use @lid
     * identifiers that cannot be constructed from the phone number alone, so we
     * must look up the JID we saw on the inbound path. Falls back to
     * @s.whatsapp.net only when nothing is known (and the result warns the caller).
     */
    const resolveRecipientJid = (recipient: string): { jid: string; warning?: string } => {
        const known = whatsappService.resolveKnownJid(recipient);
        if (known) return { jid: known };
        if (recipient.includes('@')) return { jid: recipient };
        const digits = recipient.startsWith('+') ? recipient.slice(1) : recipient;
        return {
            jid: `${digits}@s.whatsapp.net`,
            warning: `No previously-seen JID for ${recipient}; falling back to ${digits}@s.whatsapp.net. For business accounts this may deliver to a ghost chat. Prefer a number that has already messaged this session.`
        };
    };

    // Register send_wa_message tool (LLM-callable)
    pi.registerTool({
        name: "send_wa_message",
        label: "Send WhatsApp Message",
        description: "Send a WhatsApp text message to a contact. Pass the recipient as the number shown in parentheses after their name on incoming messages (e.g. '207563001962646' from 'Message from steven. (207563001962646): hi'). Full JIDs and +-prefixed numbers are also accepted. Returns JSON with success status, messageId or error, and optional warning.",
        promptSnippet: "send_wa_message(recipient, message) - Send a WhatsApp text message. `recipient` is the number shown in parentheses on the incoming message (e.g. '207563001962646'), a full JID, or a +-prefixed E.164 number.",
        parameters: Type.Object({
            recipient: Type.String({ minLength: 1, description: "Recipient identifier: the digits from the incoming message header (preferred), a full JID, or a +-prefixed E.164 number" }),
            message: Type.String({ minLength: 1, description: "Plain-text message content to send" })
        }),
        async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
            if (whatsappService.getStatus() !== 'connected') {
                return {
                    isError: true,
                    details: undefined,
                    content: [{ type: "text" as const, text: JSON.stringify({ success: false, error: "WhatsApp not connected", attempts: 0 }) }]
                };
            }

            const { jid, warning } = resolveRecipientJid(params.recipient);

            const formattedMessage = params.message
                .split('\n')
                .map((line) => `    ${line}`)
                .join('\n');

            console.log([
                '[WhatsApp-Pi] Outgoing WhatsApp message',
                `  Recipient: ${params.recipient}`,
                `  Resolved JID: ${jid}`,
                warning ? `  Warning: ${warning}` : null,
                '  Message:',
                formattedMessage
            ].filter(Boolean).join('\n'));

            const result = await whatsappService.sendMessage(jid, params.message);

            if (result.success) {
                await recentsService.recordMessage({
                    messageId: result.messageId!,
                    senderNumber: `+${jid.split('@')[0]}`,
                    text: params.message,
                    direction: 'outgoing',
                    timestamp: Date.now()
                });
                console.log([
                    '[WhatsApp-Pi] Outgoing WhatsApp message result',
                    `  To: ${jid}`,
                    '  Status: sent',
                    `  MessageId: ${result.messageId ?? 'unknown'}`
                ].join('\n'));
            } else {
                console.log([
                    '[WhatsApp-Pi] Outgoing WhatsApp message result',
                    `  To: ${jid}`,
                    '  Status: failed',
                    `  Error: ${result.error ?? 'unknown error'}`
                ].join('\n'));
            }

            return {
                isError: !result.success,
                details: undefined,
                content: [{ type: "text" as const, text: JSON.stringify({ success: result.success, messageId: result.messageId, resolvedJid: jid, error: result.error, warning, attempts: result.attempts }) }]
            };
        }
    });

    // Register send_wa_attachment tool (LLM-callable)
    pi.registerTool({
        name: "send_wa_attachment",
        label: "Send WhatsApp Attachment",
        description: "Send a file as a WhatsApp attachment (image, video, audio, or document). Pass the recipient as the number shown in parentheses after their name on incoming messages (e.g. '207563001962646' from 'Message from steven. (207563001962646): hi'). Full JIDs and +-prefixed numbers are also accepted. Returns JSON with success, messageId or error, resolvedJid, and optional warning.",
        promptSnippet: "send_wa_attachment(recipient, filePath, caption?, kind?) - Send a file attachment. `recipient` is the number shown in parentheses on the incoming message (e.g. '207563001962646'), a full JID, or a +-prefixed E.164 number.",
        parameters: Type.Object({
            recipient: Type.String({ minLength: 1, description: "Recipient identifier: the digits from the incoming message header (preferred), a full JID, or a +-prefixed E.164 number" }),
            filePath: Type.String({ minLength: 1, description: "Absolute or cwd-relative path to the file to send" }),
            caption: Type.Optional(Type.String({ description: "Optional text caption for the attachment (supported for images, videos, and documents)" })),
            fileName: Type.Optional(Type.String({ description: "Override the displayed filename (documents only). Defaults to the file's basename." })),
            mimeType: Type.Optional(Type.String({ description: "Override MIME type (e.g. application/pdf). Defaults to auto-detection from file extension." })),
            kind: Type.Optional(Type.Union([
                Type.Literal('auto'),
                Type.Literal('image'),
                Type.Literal('video'),
                Type.Literal('audio'),
                Type.Literal('document')
            ], { description: "Force the WhatsApp message kind. 'auto' (default) resolves from MIME type: image/* → image, video/* → video, audio/* → audio, everything else → document.", default: 'auto' }))
        }),
        async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
            if (whatsappService.getStatus() !== 'connected') {
                return {
                    isError: true,
                    details: undefined,
                    content: [{ type: "text" as const, text: JSON.stringify({ success: false, error: "WhatsApp not connected", attempts: 0 }) }]
                };
            }

            const { jid, warning } = resolveRecipientJid(params.recipient);

            const kindOverride = (params.kind && params.kind !== 'auto') ? params.kind as OutgoingKind : undefined;
            const validation = await validateAndReadAttachment(params.filePath, {
                kind: kindOverride,
                mimeType: params.mimeType,
                fileName: params.fileName
            });

            if (!validation.ok) {
                return {
                    isError: true,
                    details: undefined,
                    content: [{ type: "text" as const, text: JSON.stringify({ success: false, error: validation.error, attempts: 0 }) }]
                };
            }

            const { buffer, mimeType, kind, fileName, size } = validation.value;

            console.log([
                '[WhatsApp-Pi] Outgoing WhatsApp attachment',
                `  Recipient: ${params.recipient}`,
                `  Resolved JID: ${jid}`,
                warning ? `  Warning: ${warning}` : null,
                `  File: ${params.filePath}`,
                `  Kind: ${kind}`,
                `  MIME: ${mimeType}`,
                `  Size: ${size} bytes`,
                `  FileName: ${fileName}`,
                params.caption ? `  Caption: ${params.caption}` : null
            ].filter(Boolean).join('\n'));

            // Build OutgoingContent based on kind
            let content;
            switch (kind) {
                case 'image':
                    content = { kind: 'image' as const, buffer, caption: params.caption };
                    break;
                case 'video':
                    content = { kind: 'video' as const, buffer, caption: params.caption, mimetype: mimeType };
                    break;
                case 'audio':
                    content = { kind: 'audio' as const, buffer, mimetype: mimeType };
                    break;
                case 'document':
                    content = { kind: 'document' as const, buffer, mimetype: mimeType, fileName, caption: params.caption };
                    break;
                default:
                    content = { kind: 'document' as const, buffer, mimetype: mimeType, fileName, caption: params.caption };
            }

            const result = await whatsappService.sendAttachment(jid, content);

            if (result.success) {
                const recentsText = params.caption
                    ? `[Attachment: ${fileName}] ${params.caption}`
                    : `[Attachment: ${fileName}]`;
                await recentsService.recordMessage({
                    messageId: result.messageId!,
                    senderNumber: `+${jid.split('@')[0]}`,
                    text: recentsText,
                    direction: 'outgoing',
                    timestamp: Date.now()
                });
                console.log([
                    '[WhatsApp-Pi] Outgoing WhatsApp attachment result',
                    `  To: ${jid}`,
                    '  Status: sent',
                    `  MessageId: ${result.messageId ?? 'unknown'}`
                ].join('\n'));
            } else {
                console.log([
                    '[WhatsApp-Pi] Outgoing WhatsApp attachment result',
                    `  To: ${jid}`,
                    '  Status: failed',
                    `  Error: ${result.error ?? 'unknown error'}`
                ].join('\n'));
            }

            return {
                isError: !result.success,
                details: undefined,
                content: [{ type: "text" as const, text: JSON.stringify({ success: result.success, messageId: result.messageId, resolvedJid: jid, error: result.error, warning, attempts: result.attempts }) }]
            };
        }
    });

    // Register commands
    pi.registerCommand("whatsapp", {
        description: "Manage WhatsApp integration",
        handler: async (args, ctx) => {
            _ctx = ctx;
            await menuHandler.handleCommand(ctx);

            // Persist state after changes
            pi.appendEntry("whatsapp-state", {
                status: sessionManager.getStatus(),
                allowList: sessionManager.getAllowList()
            });
        }
    });

    // Handle outgoing messages (Agent -> WhatsApp)
    pi.on("agent_start", async (_event, _ctx) => {
        if (sessionManager.getStatus() !== 'connected') return;
        const lastJid = whatsappService.getLastRemoteJid();
        if (lastJid) {
            await whatsappService.sendPresence(lastJid, 'composing');
        }
    });

    pi.on("message_end", async (event, ctx) => {
        if (sessionManager.getStatus() !== 'connected') return;

        const { message } = event;
        // Only reply if it's the assistant and we have a valid target
        if (message.role === "assistant") {
            const lastJid = whatsappService.getLastRemoteJid();
            const text = message.content.filter(c => c.type === "text").map(c => c.text).join("\n");

            if (lastJid && text) {
                try {
                    const result = await whatsappService.sendMessage(lastJid, text);
                    if (result.success) {
                        await recentsService.recordMessage({
                            messageId: result.messageId ?? `${Date.now()}`,
                            senderNumber: `+${lastJid.split('@')[0]}`,
                            text,
                            direction: 'outgoing',
                            timestamp: Date.now()
                        });
                        ctx.ui.notify(`Sent reply to WhatsApp contact`, 'info');
                    } else {
                        ctx.ui.notify(`Failed to send WhatsApp reply`, 'error');
                    }
                } catch {
                    ctx.ui.notify(`Failed to send WhatsApp reply`, 'error');
                }
            }
        }
    });

    pi.on("session_shutdown", async () => {
        logger.log("[WhatsApp-Pi] Session shutdown detected. Stopping WhatsApp service...");
        await whatsappService.stop();
    });
}
