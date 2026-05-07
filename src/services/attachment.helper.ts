import { extname, basename } from 'node:path';
import { stat, readFile } from 'node:fs/promises';
import type { OutgoingKind } from '../models/whatsapp.types.js';

/** Maximum attachment size in bytes (100 MB — WhatsApp's practical document limit) */
export const ATTACHMENT_SIZE_CAP = 100 * 1024 * 1024;

/** Extension → MIME type map for auto-detection. Keep in sync with common WhatsApp-supported types. */
const MIME_MAP: Record<string, string> = {
    // Images
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    // Video
    '.mp4': 'video/mp4',
    '.3gp': 'video/3gpp',
    '.avi': 'video/x-msvideo',
    '.mov': 'video/quicktime',
    '.mkv': 'video/x-matroska',
    // Audio
    '.mp3': 'audio/mpeg',
    '.ogg': 'audio/ogg',
    '.wav': 'audio/wav',
    '.aac': 'audio/aac',
    '.m4a': 'audio/mp4',
    '.amr': 'audio/amr',
    // Documents
    '.pdf': 'application/pdf',
    '.txt': 'text/plain',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.csv': 'text/csv',
    '.rtf': 'application/rtf',
    '.html': 'text/html',
    '.htm': 'text/html',
    '.xml': 'application/xml',
    '.json': 'application/json',
    // Archives
    '.zip': 'application/zip',
    '.rar': 'application/vnd.rar',
    '.7z': 'application/x-7z-compressed',
    '.tar': 'application/x-tar',
    '.gz': 'application/gzip'
};

export function guessMimeType(filePath: string): string {
    const ext = extname(filePath).toLowerCase();
    return MIME_MAP[ext] ?? 'application/octet-stream';
}

export function resolveKind(mimeType: string): OutgoingKind {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    return 'document';
}

export interface ValidatedAttachment {
    buffer: Buffer;
    mimeType: string;
    kind: OutgoingKind;
    fileName: string;
    size: number;
}

export type ValidationResult =
    | { ok: false; error: string }
    | { ok: true; value: ValidatedAttachment };

export async function validateAndReadAttachment(
    filePath: string,
    options?: { kind?: OutgoingKind; mimeType?: string; fileName?: string }
): Promise<ValidationResult> {
    let fileStat;
    try {
        fileStat = await stat(filePath);
    } catch {
        return { ok: false, error: `File not found: ${filePath}` };
    }

    if (!fileStat.isFile()) {
        return { ok: false, error: `Path is not a regular file: ${filePath}` };
    }

    if (fileStat.size === 0) {
        return { ok: false, error: `File is empty: ${filePath}` };
    }

    if (fileStat.size > ATTACHMENT_SIZE_CAP) {
        const capMB = (ATTACHMENT_SIZE_CAP / (1024 * 1024)).toFixed(0);
        const fileMB = (fileStat.size / (1024 * 1024)).toFixed(1);
        return { ok: false, error: `File exceeds ${capMB} MB cap (${fileMB} MB): ${filePath}` };
    }

    const buffer = await readFile(filePath);
    const mimeType = options?.mimeType ?? guessMimeType(filePath);
    const kind = options?.kind ?? resolveKind(mimeType);
    const resolvedFileName = options?.fileName ?? basename(filePath);

    return {
        ok: true,
        value: {
            buffer,
            mimeType,
            kind,
            fileName: resolvedFileName,
            size: fileStat.size
        }
    };
}
