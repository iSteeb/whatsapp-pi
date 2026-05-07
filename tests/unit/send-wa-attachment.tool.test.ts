import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { validateAndReadAttachment } from '../../src/services/attachment.helper.js';

/**
 * Unit tests for the send_wa_attachment tool execute logic.
 *
 * The tool's execute function is a closure over whatsappService, recentsService,
 * resolveRecipientJid, and validateAndReadAttachment. We replicate the core logic
 * here with mocked services so it can be tested in isolation.
 */

interface MockWhatsAppService {
    getStatus: () => string;
    sendAttachment: (jid: string, content: any) => Promise<{ success: boolean; messageId?: string; error?: string; attempts: number }>;
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
    params: { recipient: string; filePath: string; caption?: string; fileName?: string; mimeType?: string; kind?: string },
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

    const kindOverride = (params.kind && params.kind !== 'auto') ? params.kind as any : undefined;
    const validation = await validateAndReadAttachment(params.filePath, {
        kind: kindOverride,
        mimeType: params.mimeType,
        fileName: params.fileName
    });

    if (!validation.ok) {
        return {
            isError: true,
            content: [{ type: 'text' as const, text: JSON.stringify({ success: false, error: validation.error, attempts: 0 }) }]
        };
    }

    const { buffer, mimeType, kind, fileName } = validation.value;

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
    }

    return {
        isError: !result.success,
        content: [{ type: 'text' as const, text: JSON.stringify({ success: result.success, messageId: result.messageId, resolvedJid: jid, error: result.error, warning, attempts: result.attempts }) }]
    };
}

describe('send_wa_attachment tool', () => {
    let whatsappService: MockWhatsAppService;
    let recentsService: MockRecentsService;
    const tmpDir = join(process.cwd(), '.test-tmp-attachment-tool');

    beforeEach(async () => {
        vi.spyOn(console, 'log').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});
        whatsappService = {
            getStatus: vi.fn().mockReturnValue('connected'),
            sendAttachment: vi.fn().mockResolvedValue({ success: true, messageId: 'ATT123', attempts: 1 }),
            resolveKnownJid: vi.fn().mockReturnValue(null)
        };
        recentsService = {
            recordMessage: vi.fn().mockResolvedValue(undefined)
        };
        await mkdir(tmpDir, { recursive: true });
    });

    afterEach(async () => {
        vi.restoreAllMocks();
        await rm(tmpDir, { recursive: true, force: true });
    });

    it('returns error result when WhatsApp is not connected', async () => {
        vi.mocked(whatsappService.getStatus).mockReturnValue('disconnected');

        const result = await executeToolLogic(
            { recipient: '5511999998888', filePath: '/tmp/fake.pdf' },
            whatsappService,
            recentsService
        );

        expect(result.isError).toBe(true);
        expect(whatsappService.sendAttachment).not.toHaveBeenCalled();
        expect(recentsService.recordMessage).not.toHaveBeenCalled();
    });

    it('returns error result when file does not exist', async () => {
        const result = await executeToolLogic(
            { recipient: '5511999998888', filePath: '/nonexistent/file.pdf' },
            whatsappService,
            recentsService
        );

        expect(result.isError).toBe(true);
        const parsed = JSON.parse(result.content[0].text);
        expect(parsed.error).toContain('File not found');
        expect(whatsappService.sendAttachment).not.toHaveBeenCalled();
    });

    it('uses resolved @lid JID for business-account contacts', async () => {
        vi.mocked(whatsappService.resolveKnownJid).mockReturnValue('207563001962646@lid');

        const filePath = join(tmpDir, 'report.pdf');
        await writeFile(filePath, Buffer.from('fake pdf content'));

        const result = await executeToolLogic(
            { recipient: '207563001962646', filePath, caption: 'Monthly report' },
            whatsappService,
            recentsService
        );

        expect(result.isError).toBe(false);
        const parsed = JSON.parse(result.content[0].text);
        expect(parsed.resolvedJid).toBe('207563001962646@lid');
        expect(parsed.warning).toBeUndefined();

        // Crucially: the attachment was sent to the @lid JID, not the @s.whatsapp.net one
        const [targetJid] = vi.mocked(whatsappService.sendAttachment).mock.calls[0];
        expect(targetJid).toBe('207563001962646@lid');
    });

    it('falls back to @s.whatsapp.net with warning when recipient is unknown', async () => {
        vi.mocked(whatsappService.resolveKnownJid).mockReturnValue(null);

        const filePath = join(tmpDir, 'report.pdf');
        await writeFile(filePath, Buffer.from('fake pdf content'));

        const result = await executeToolLogic(
            { recipient: '5511999998888', filePath },
            whatsappService,
            recentsService
        );

        const parsed = JSON.parse(result.content[0].text);
        expect(parsed.resolvedJid).toBe('5511999998888@s.whatsapp.net');
        expect(parsed.warning).toContain('No previously-seen JID');
    });

    it('sends a document file and records to recents using resolved JID digits', async () => {
        vi.mocked(whatsappService.resolveKnownJid).mockReturnValue('207563001962646@lid');

        const filePath = join(tmpDir, 'report.pdf');
        await writeFile(filePath, Buffer.from('fake pdf content'));

        await executeToolLogic(
            { recipient: '207563001962646', filePath, caption: 'Monthly report' },
            whatsappService,
            recentsService
        );

        expect(recentsService.recordMessage).toHaveBeenCalledOnce();
        const recentsCall = vi.mocked(recentsService.recordMessage).mock.calls[0][0];
        expect(recentsCall.text).toBe('[Attachment: report.pdf] Monthly report');
        expect(recentsCall.senderNumber).toBe('+207563001962646');

        const [, content] = vi.mocked(whatsappService.sendAttachment).mock.calls[0];
        expect(content.kind).toBe('document');
        expect(content.mimetype).toBe('application/pdf');
        expect(content.fileName).toBe('report.pdf');
        expect(content.caption).toBe('Monthly report');
    });

    it('sends an image file and resolves kind automatically', async () => {
        const filePath = join(tmpDir, 'photo.jpg');
        await writeFile(filePath, Buffer.from('fake jpg data'));

        await executeToolLogic(
            { recipient: '5511999998888', filePath },
            whatsappService,
            recentsService
        );

        const [, content] = vi.mocked(whatsappService.sendAttachment).mock.calls[0];
        expect(content.kind).toBe('image');
        expect(content.caption).toBeUndefined();
    });

    it('sends an audio file', async () => {
        const filePath = join(tmpDir, 'voice.ogg');
        await writeFile(filePath, Buffer.from('fake ogg data'));

        await executeToolLogic(
            { recipient: '5511999998888', filePath },
            whatsappService,
            recentsService
        );

        const [, content] = vi.mocked(whatsappService.sendAttachment).mock.calls[0];
        expect(content.kind).toBe('audio');
        expect(content.mimetype).toBe('audio/ogg');
    });

    it('respects explicit kind override to force document for an image file', async () => {
        const filePath = join(tmpDir, 'photo.jpg');
        await writeFile(filePath, Buffer.from('fake jpg data'));

        await executeToolLogic(
            { recipient: '5511999998888', filePath, kind: 'document' },
            whatsappService,
            recentsService
        );

        const [, content] = vi.mocked(whatsappService.sendAttachment).mock.calls[0];
        expect(content.kind).toBe('document');
    });

    it('does NOT record to recents when delivery fails', async () => {
        vi.mocked(whatsappService.sendAttachment).mockResolvedValue({
            success: false,
            error: 'Upload failed',
            attempts: 3
        });

        const filePath = join(tmpDir, 'report.pdf');
        await writeFile(filePath, Buffer.from('fake pdf content'));

        const result = await executeToolLogic(
            { recipient: '5511999998888', filePath },
            whatsappService,
            recentsService
        );

        expect(result.isError).toBe(true);
        expect(recentsService.recordMessage).not.toHaveBeenCalled();
    });

    it('respects mimeType and fileName overrides', async () => {
        const filePath = join(tmpDir, 'data.bin');
        await writeFile(filePath, Buffer.from('binary data'));

        await executeToolLogic(
            { recipient: '5511999998888', filePath, mimeType: 'application/zip', fileName: 'archive.zip' },
            whatsappService,
            recentsService
        );

        const [, content] = vi.mocked(whatsappService.sendAttachment).mock.calls[0];
        expect(content.kind).toBe('document');
        expect(content.mimetype).toBe('application/zip');
        expect(content.fileName).toBe('archive.zip');
    });
});
