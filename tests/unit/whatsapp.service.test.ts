import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SessionManager } from '../../src/services/session.manager.js';
import { WhatsAppService } from '../../src/services/whatsapp.service.js';

describe('WhatsAppService Filtering', () => {
    let whatsappService: WhatsAppService;
    let sessionManager: SessionManager;

    beforeEach(() => {
        sessionManager = new SessionManager();
        whatsappService = new WhatsAppService(sessionManager);
    });

    it('should only process messages if status is connected', async () => {
        const callback = vi.fn();
        whatsappService.setMessageCallback(callback);
        
        await sessionManager.setStatus('disconnected');
        // Simulate message
        whatsappService.handleIncomingMessages({ 
            messages: [{ 
                key: { remoteJid: '123@s.net' },
                message: { conversation: 'Hello' }
            }] 
        });
        
        expect(callback).not.toHaveBeenCalled();
    });

    it('should report disconnected effective status when persisted status is connected but socket is absent', async () => {
        await sessionManager.setStatus('connected');

        expect(whatsappService.getStatus()).toBe('connected');
        expect(whatsappService.getEffectiveStatus()).toBe('disconnected');
    });

    it('should only process messages if sender is in allow list', async () => {
        const callback = vi.fn();
        whatsappService.setMessageCallback(callback);
        
        await sessionManager.setStatus('connected');
        await sessionManager.addNumber('+1234567890');

        // Allowed
        whatsappService.handleIncomingMessages({ 
            messages: [{ 
                key: { remoteJid: '1234567890@s.whatsapp.net' },
                message: { conversation: 'Hello' }
            }] 
        });
        expect(callback).toHaveBeenCalledTimes(1);

        // Not Allowed
        whatsappService.handleIncomingMessages({ 
            messages: [{ 
                key: { remoteJid: '0987654321@s.whatsapp.net' },
                message: { conversation: 'Hello' }
            }] 
        });
        expect(callback).toHaveBeenCalledTimes(1); // Still 1
    });

    it('should accept messages sent by me fromMe without pi symbol "π" at last letter', () => {
        const callback = vi.fn();
        whatsappService.setMessageCallback(callback);
        
        sessionManager.setStatus('connected');
        sessionManager.addNumber('+1234567890');

        // fromMe is true and does NOT end with π
        whatsappService.handleIncomingMessages({    
            messages: [{ 
                key: { remoteJid: '1234567890@s.whatsapp.net', fromMe: true },
                message: { conversation: 'Testing Pi' }
            }] 
        });
        expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should ignore messages sent by yourself using my own number ("fromMe" with pi symbol "π" at last letter)', () => {
        const callback = vi.fn();
        whatsappService.setMessageCallback(callback);
        
        sessionManager.setStatus('connected');
        sessionManager.addNumber('+1234567890');

        // fromMe is true and ends with π
        whatsappService.handleIncomingMessages({    
            messages: [{ 
                key: { remoteJid: '1234567890@s.whatsapp.net', fromMe: true },
                message: { conversation: 'Testing Pi π' }
            }] 
        });
        expect(callback).not.toHaveBeenCalled();
    });

    it('should ignore a document-message echo whose caption ends with π (media loop prevention)', async () => {
        const callback = vi.fn();
        whatsappService.setMessageCallback(callback);

        await sessionManager.setStatus('connected');
        await sessionManager.addNumber('+1234567890');

        // Simulates a fromMe echo of an outgoing document with a π-branded caption
        await whatsappService.handleIncomingMessages({
            messages: [{
                key: { remoteJid: '1234567890@s.whatsapp.net', fromMe: true },
                message: { documentMessage: { caption: "Here's your file π" } }
            }]
        });
        expect(callback).not.toHaveBeenCalled();
    });

    it('should ignore image and video echoes whose captions end with π', async () => {
        const callback = vi.fn();
        whatsappService.setMessageCallback(callback);

        await sessionManager.setStatus('connected');
        await sessionManager.addNumber('+1234567890');

        await whatsappService.handleIncomingMessages({
            messages: [{
                key: { remoteJid: '1234567890@s.whatsapp.net', fromMe: true },
                message: { imageMessage: { caption: 'photo π' } }
            }]
        });
        await whatsappService.handleIncomingMessages({
            messages: [{
                key: { remoteJid: '1234567890@s.whatsapp.net', fromMe: true },
                message: { videoMessage: { caption: 'clip π' } }
            }]
        });
        expect(callback).not.toHaveBeenCalled();
    });

    describe('JID registry (resolveKnownJid)', () => {
        it('remembers the JID of every allowed incoming message and resolves by digits', async () => {
            const callback = vi.fn();
            whatsappService.setMessageCallback(callback);

            await sessionManager.setStatus('connected');
            await sessionManager.addNumber('+207563001962646');

            // Business-account style incoming message uses @lid
            await whatsappService.handleIncomingMessages({
                messages: [{
                    key: { remoteJid: '207563001962646@lid' },
                    message: { conversation: 'hello' }
                }]
            });

            expect(callback).toHaveBeenCalledTimes(1);
            // Digits resolve to the @lid JID we actually saw — NOT a made-up @s.whatsapp.net
            expect(whatsappService.resolveKnownJid('207563001962646')).toBe('207563001962646@lid');
            expect(whatsappService.resolveKnownJid('+207563001962646')).toBe('207563001962646@lid');
        });

        it('returns null for unknown recipients', () => {
            expect(whatsappService.resolveKnownJid('9999999999')).toBeNull();
            expect(whatsappService.resolveKnownJid('+9999999999')).toBeNull();
        });

        it('passes full JIDs through unchanged', () => {
            expect(whatsappService.resolveKnownJid('abc@g.us')).toBe('abc@g.us');
        });

        it('does NOT register JIDs from blocked or ignored (non-allow-listed) senders', async () => {
            await sessionManager.setStatus('connected');
            // No addNumber call — this sender is not allowed

            await whatsappService.handleIncomingMessages({
                messages: [{
                    key: { remoteJid: '5555555555@lid' },
                    message: { conversation: 'spam' }
                }]
            });

            // Should NOT have remembered the JID — we only trust JIDs from allowed contacts
            expect(whatsappService.resolveKnownJid('5555555555')).toBeNull();
        });
    });

});
