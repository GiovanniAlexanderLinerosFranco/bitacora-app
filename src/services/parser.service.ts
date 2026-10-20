import "server-only";
import { extractTextFromMedia } from "../lib/ai/openai";
import { classifyMime, normalizeMime, type AttachmentKind } from "../lib/attachments";

/** Upper bound on extracted characters per entry (bounds embedding cost). */
export const MAX_EXTRACTED_CHARS = 300_000;

const INSTRUCTIONS: Record<Exclude<AttachmentKind, "text">, string> = {
  pdf: "Extract all text from this document verbatim, preserving headings, lists and table content as plain text. Do not summarize.",
  image:
    "Transcribe all visible text verbatim. Then add a short factual description of any diagrams, figures or handwriting that is not plain text. Do not infer anything that is not visible.",
  audio: "Transcribe this audio verbatim in its original language. Do not summarize or translate.",
};

/** Cheap content check so a mislabelled upload fails early instead of inside the model call. */
export function matchesDeclaredType(bytes: Uint8Array, mime: string): boolean {
  const kind = classifyMime(mime);
  const m = normalizeMime(mime);
  if (kind === "pdf") return String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-";
  if (m === "image/png") return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  if (m === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8;
  if (kind === "text") return !bytes.slice(0, 4096).includes(0);
  return true;
}

function decodeText(bytes: Uint8Array): string {
  return new TextDecoder("utf-8").decode(bytes).replace(/^\uFEFF/, "");
}

function clean(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, MAX_EXTRACTED_CHARS);
}

/** Extracts searchable text from an uploaded file. Throws on unsupported types or extraction failure. */
export async function extractText(bytes: Uint8Array, mimeType: string): Promise<string> {
  const kind = classifyMime(mimeType);
  if (!kind) throw new Error(`Unsupported file type: ${mimeType}`);
  if (kind === "text") return clean(decodeText(bytes));
  return clean(await extractTextFromMedia({ mimeType: normalizeMime(mimeType), data: bytes, instruction: INSTRUCTIONS[kind] }));
}
