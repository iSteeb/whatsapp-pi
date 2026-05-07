import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Unit tests for the send_wa_message tool execute logic.
 *
 * The tool's execute function is a closure over whatsappService, recentsService,
 * and resolveRecipientJid. We replicate the exact logic here with mocked services
 * so it can be tested in isolation.
 */

interface MockWhatsAppService {
    getStatus: () => string;
    sendMessage: (jid: string, message: string) => Promise<{ success: boolean; messageId?: string; error?: string; attempts: number }>;
    resolveKnownJid: (recipient: string) => string | null;
}

interface MockRecentsService {
    recordMessage: (input: {
        messageId: string;
        senderNumber: string;
        text: string;
        direction: 'outgoing';
        timestamp: number;
    }) => Promise<void>;
}

function makeResolveRecipientJid(whatsappService: MockWhatsAppService) {
    return (recipient: string): { jid: string; warning?: string } => {
        const known = whatsappService.resolveKnownJid(recipient);
        if (known) return { jid: known };
        if (recipient.includes('@')) return { jid: recipient };
        const digits = recipient.startsWith('+') ? recipient.slice(1) : recipient;
        return {
            jid: `${digits}@s.whatsapp.net`,
            warning: `No previously-seen JID for ${recipient}; falling back to ${digits}@s.whatsapp.net. For business accounts this may deliver to a ghost chat. Prefer a number that has already messaged this session.`
        };
    };
}

async function executeToolLogic(
    params: { recipient: string; message: string },
    whatsappService: MockWhatsAppService,
    recentsService: MockRecentsService
) {
    if (whatsappService.getStatus() !== 'connected') {
        return {
            isError: true,
            content: [{ type: 'text' as const, text: JSON.stringify({ success: false, error: 'WhatsApp not connected', attempts: 0 }) }]
        };
    }

    const resolveRecipientJid = makeResolveRecipientJid(whatsappService);
    const { jid, warning } = resolveRecipientJid(params.recipient);

    const result = await whatsappService.sendMessage(jid, params.message);

    if (result.success) {
        await recentsService.recordMessage({
            messageId: result.messageId!,
            senderNumber: `+${jid.split('@')[0]}`,
            text: params.message,
            direction: 'outgoing',
            timestamp: Date.now()
        });
    }

    return {
        isError: !result.success,
        content: [{ type: 'text' as const, text: JSON.stringify({ success: result.success, messageId: result.messageId, resolvedJid: jid, error: result.error, warning, attempts: result.attempts }) }]
    };
}

describe('send_wa_message tool', () => {
    let whatsappService: MockWhatsAppService;
    let recentsService: MockRecentsService;

    beforeEach(() => {
        vi.spyOn(console, 'log').mockImplementation(() => {});
        whatsappService = {
            getStatus: vi.fn().mockReturnValue('connected'),
            sendMessage: vi.fn().mockResolvedValue({ success: true, messageId: 'MSG123', attempts: 1 }),
            resolveKnownJid: vi.fn().mockReturnValue(null)
        };
        recentsService = {
            recordMessage: vi.fn().mockResolvedValue(undefined)
        };
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('US1: not connected', () => {
        it('returns error result when WhatsApp is not connected', async () => {
            vi.mocked(whatsappService.getStatus).mockReturnValue('disconnected');

            const result = await executeToolLogic(
                { recipient: '5511999998888', message: 'Hello' },
                whatsappService,
                recentsService
            );

            expect(result.isError).toBe(true);
            const parsed = JSON.parse(result.content[0].text);
            expect(parsed.success).toBe(false);
            expect(parsed.error).toBe('WhatsApp not connected');
            expect(whatsappService.sendMessage).not.toHaveBeenCalled();
        });
    });

    describe('US2: JID resolution', () => {
        it('uses the canonical JID when resolveKnownJid finds one (business account @lid case)', async () => {
            vi.mocked(whatsappService.resolveKnownJid).mockReturnValue('207563001962646@lid');

            const result = await executeToolLogic(
                { recipient: '207563001962646', message: 'Hello Steven' },
                whatsappService,
                recentsService
            );

            expect(result.isError).toBe(false);
            expect(whatsappService.sendMessage).toHaveBeenCalledWith('207563001962646@lid', 'Hello Steven');

            const parsed = JSON.parse(result.content[0].text);
            expect(parsed.resolvedJid).toBe('207563001962646@lid');
            expect(parsed.warning).toBeUndefined();
        });

        it('falls back to @s.whatsapp.net with a warning when JID is unknown', async () => {
            vi.mocked(whatsappService.resolveKnownJid).mockReturnValue(null);

            const result = await executeToolLogic(
                { recipient: '5511999998888', message: 'Hello' },
                whatsappService,
                recentsService
            );

            expect(whatsappService.sendMessage).toHaveBeenCalledWith('5511999998888@s.whatsapp.net', 'Hello');
            const parsed = JSON.parse(result.content[0].text);
            expect(parsed.resolvedJid).toBe('5511999998888@s.whatsapp.net');
            expect(parsed.warning).toContain('No previously-seen JID');
            expect(parsed.warning).toContain('ghost chat');
        });

        it('accepts a full JID as-is when resolver returns null but input contains @', async () => {
            vi.mocked(whatsappService.resolveKnownJid).mockReturnValue(null);

            await executeToolLogic(
                { recipient: '5511999998888@s.whatsapp.net', message: 'Hello' },
                whatsappService,
                recentsService
            );

            expect(whatsappService.sendMessage).toHaveBeenCalledWith('5511999998888@s.whatsapp.net', 'Hello');
        });

        it('strips leading + from recipient before constructing fallback JID', async () => {
            vi.mocked(whatsappService.resolveKnownJid).mockReturnValue(null);

            await executeToolLogic(
                { recipient: '+5511999998888', message: 'Hello' },
                whatsappService,
                recentsService
            );

            expect(whatsappService.sendMessage).toHaveBeenCalledWith('5511999998888@s.whatsapp.net', 'Hello');
        });
    });

    describe('US3: recents recording', () => {
        it('records outgoing message using the resolved JID digits', async () => {
            vi.mocked(whatsappService.resolveKnownJid).mockReturnValue('207563001962646@lid');

            await executeToolLogic(
                { recipient: '207563001962646', message: 'Hello recents' },
                whatsappService,
                recentsService
            );

            expect(recentsService.recordMessage).toHaveBeenCalledOnce();
            const call = vi.mocked(recentsService.recordMessage).mock.calls[0][0];
            expect(call.senderNumber).toBe('+207563001962646');
            expect(call.text).toBe('Hello recents');
            expect(call.direction).toBe('outgoing');
        });

        it('does NOT record to recents when delivery fails', async () => {
            vi.mocked(whatsappService.sendMessage).mockResolvedValue({
                success: false,
                error: 'Failed',
                attempts: 1
            });

            await executeToolLogic(
                { recipient: '5511999998888', message: 'Hello' },
                whatsappService,
                recentsService
            );

            expect(recentsService.recordMessage).not.toHaveBeenCalled();
        });

        it('does NOT record to recents when WhatsApp is not connected', async () => {
            vi.mocked(whatsappService.getStatus).mockReturnValue('disconnected');

            await executeToolLogic(
                { recipient: '5511999998888', message: 'Hello' },
                whatsappService,
                recentsService
            );

            expect(recentsService.recordMessage).not.toHaveBeenCalled();
        });
    });
});
