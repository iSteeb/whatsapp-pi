export type SessionStatus = 'logged-out' | 'pairing' | 'connected' | 'disconnected';

export interface WhatsAppSession {
    id: string;
    status: SessionStatus;
    credentialsPath: string;
}

export interface AllowList {
    numbers: string[];
}

export interface IncomingMessage {
    id: string;
    remoteJid: string;
    pushName?: string;
    text?: string;
    timestamp: number;
}

/** Content kind for outgoing WhatsApp messages */
export type OutgoingKind = 'text' | 'image' | 'video' | 'audio' | 'document';

/** Union of content payloads the MessageSender can deliver */
export type OutgoingContent =
    | { kind: 'text'; text: string }
    | { kind: 'image'; buffer: Buffer; caption?: string }
    | { kind: 'video'; buffer: Buffer; caption?: string; mimetype?: string }
    | { kind: 'audio'; buffer: Buffer; mimetype?: string }
    | { kind: 'document'; buffer: Buffer; mimetype: string; fileName?: string; caption?: string };

export interface MessageRequest {
    recipientJid: string;
    content: OutgoingContent;
    options?: {
        maxRetries?: number;
        priority?: 'high' | 'normal';
    };
}

export interface MessageResult {
    success: boolean;
    messageId?: string;
    error?: string;
    attempts: number;
}

export class WhatsAppError extends Error {
    constructor(public code: string, message: string) {
        super(message);
        this.name = 'WhatsAppError';
    }
}

export function validatePhoneNumber(number: string): boolean {
    return /^\+[1-9]\d{1,14}$/.test(number);
}

export interface DocumentMetadata {
    filename: string;
    mimetype: string;
    size: number;
    savedPath: string;
    timestamp: number;
}

export type MessageDirection = 'incoming' | 'outgoing';

export interface RecentConversationMessage {
    messageId: string;
    senderNumber: string;
    text: string;
    direction: MessageDirection;
    timestamp: number;
}

export interface RecentConversationSummary {
    senderNumber: string;
    senderName?: string;
    lastMessagePreview: string;
    lastMessageTime: number;
    lastMessageDirection: MessageDirection;
    messageCount: number;
    isAllowed: boolean;
}

export interface SelectedMessageContext {
    messageId: string;
    senderNumber: string;
    senderName?: string;
    text: string;
    direction: MessageDirection;
    timestamp: number;
}

export interface ReplyDraft {
    text: string;
    targetMessageId: string;
    targetConversation: string;
}

export interface ReplySendResult {
    success: boolean;
    messageId?: string;
    error?: string;
    attempts: number;
}

export interface RecentsStore {
    conversations: RecentConversationSummary[];
    messagesBySender: Record<string, RecentConversationMessage[]>;
    updatedAt: number;
}
