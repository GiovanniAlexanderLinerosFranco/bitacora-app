/** Attachment policy shared by the upload action and parser. Keep in sync with the bucket in migration 002. */
export const ATTACHMENTS_BUCKET = "bitacora-ledger-attachments";
/** OpenAI inline file/transcription requests cap at ~20-25 MB (base64 adds ~33%), so raw files stay well below that. */
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export type AttachmentKind = "text" | "pdf" | "image" | "audio";

const MIME_KINDS: Record<string, AttachmentKind> = {
  "text/plain": "text",
  "text/markdown": "text",
  "text/csv": "text",
  "application/pdf": "pdf",
  "image/png": "image",
  "image/jpeg": "image",
  "image/webp": "image",
  "audio/mpeg": "audio",
  "audio/wav": "audio",
  "audio/x-wav": "audio",
  "audio/ogg": "audio",
  "audio/flac": "audio",
};

export const ALLOWED_MIME_TYPES = Object.keys(MIME_KINDS);

export function normalizeMime(mime: string): string {
  return mime.split(";")[0].trim().toLowerCase();
}

export function classifyMime(mime: string): AttachmentKind | null {
  return MIME_KINDS[normalizeMime(mime)] ?? null;
}

export function sanitizeFileName(name: string): string {
  const cleaned = name.replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^\.+/, "").slice(-100);
  return cleaned || "file";
}
