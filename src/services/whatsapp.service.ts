import { 
    makeWASocket,
    DisconnectReason, 
    useMultiFileAuthState, 
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import { SessionManager } from './session.manager.js';
import { WhatsAppSession } from '../models/whatsapp.types.js';

export class WhatsAppService {
    private socket: any;
    private sessionManager: SessionManager;
    private isReconnecting = false;

    constructor(sessionManager: SessionManager) {
        this.sessionManager = sessionManager;
    }

    async start() {
        if (this.isReconnecting) return;
        this.onStatusUpdate?.('WhatsApp: Connecting...');

        const { state, saveCreds } = await this.sessionManager.getAuthState();
        const { version } = await fetchLatestBaileysVersion();

        // Cleanup existing socket if any
        if (this.socket) {
            this.socket.ev.removeAllListeners('connection.update');
            this.socket.ev.removeAllListeners('creds.update');
            this.socket.ev.removeAllListeners('messages.upsert');
            try {
                this.socket.end(undefined);
            } catch (e) {}
        }

        this.socket = makeWASocket({
            version,
            printQRInTerminal: false,
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, console as any),
            },
        });

        this.socket.ev.on('creds.update', saveCreds);

        this.socket.ev.on('connection.update', async (update: any) => {
            const { connection, lastDisconnect, qr } = update;
            
            if (qr) {
                this.sessionManager.setStatus('pairing');
                this.onQRCode?.(qr);
                this.onStatusUpdate?.('WhatsApp: Pairing...');
            }

            if (connection === 'close') {
                const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
                const errorMessage = lastDisconnect?.error?.message || '';
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
                
                console.error(`Connection closed [${statusCode}]. Reconnecting: ${shouldReconnect}`);
                
                if (errorMessage.includes('bad-request') || statusCode === 400) {
                    console.error('Bad request error detected - clearing session and forcing re-auth');
                    await this.sessionManager.clearSession();
                    this.sessionManager.setStatus('logged-out');
                    this.onStatusUpdate?.('WhatsApp: Logged out');
                    return;
                }

                if (statusCode === DisconnectReason.connectionReplace) {
                    console.error('Connection replaced - another instance connected');
                    this.onStatusUpdate?.('WhatsApp: Conflict (Another Instance)');
                    return;
                }
                
                if (shouldReconnect && !this.isReconnecting) {
                    this.isReconnecting = true;
                    this.onStatusUpdate?.('WhatsApp: Reconnecting...');
                    setTimeout(() => {
                        this.isReconnecting = false;
                        this.start();
                    }, 3000);
                } else if (!shouldReconnect) {
                    this.sessionManager.setStatus('logged-out');
                    this.onStatusUpdate?.('WhatsApp: Disconnected');
                }
            } else if (connection === 'open') {
                console.log('WhatsApp connection successfully opened');
                this.isReconnecting = false;
                this.sessionManager.setStatus('connected');
                this.onStatusUpdate?.('WhatsApp: Connected');
            }
        });

        this.socket.ev.on('messages.upsert', (m: any) => this.handleIncomingMessages(m));
    }

    public handleIncomingMessages(m: any) {
        if (this.sessionManager.getStatus() !== 'connected') return;
        const msg = m.messages[0];
        if (!msg || !msg.key.remoteJid) return;
        
        // Ignore messages sent by Pi (marked with π)
        const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || "";
        if (text.endsWith('(π)')) return;
        

        const sender = msg.key.remoteJid.split('@')[0];
        const fullNumber = '+' + sender; 
        
        if (!this.sessionManager.isAllowed(fullNumber)) {
            console.log(`Ignoring message from ${fullNumber} (not in allow list)`);
            return;
        }

        this.lastRemoteJid = msg.key.remoteJid;
        this.onMessage?.(m);
    }

    private onQRCode?: (qr: string) => void;
    private onMessage?: (m: any) => void;
    private onStatusUpdate?: (status: string) => void;
    private lastRemoteJid: string | null = null;

    setQRCodeCallback(callback: (qr: string) => void) {
        this.onQRCode = callback;
    }

    setMessageCallback(callback: (m: any) => void) {
        this.onMessage = callback;
    }

    setStatusCallback(callback: (status: string) => void) {
        this.onStatusUpdate = callback;
    }

    public getLastRemoteJid(): string | null {
        return this.lastRemoteJid;
    }

    async sendMessage(jid: string, text: string) {
        if (!this.socket) {
            console.error('WhatsApp socket not initialized - attempting to start...');
            await this.start();
        }
        await this.socket.sendMessage(jid, { text: `${text} (π)` });
    }

    async logout() {
        await this.socket?.logout();
        await this.sessionManager.clearSession();
    }

    async stop() {
        if (this.socket) {
            this.socket.ev.removeAllListeners('connection.update');
            this.socket.ev.removeAllListeners('creds.update');
            this.socket.ev.removeAllListeners('messages.upsert');
            try {
                this.socket.end(undefined);
            } catch (e) {}
            this.socket = undefined;
            this.isReconnecting = false;
        }
        await this.sessionManager.setStatus('disconnected');
        this.onStatusUpdate?.('WhatsApp: Disconnected');
    }
}
