/**
 * Paragraph-aware chunking with overlap. Sizes are in characters (~4 chars/token).
 * A chunk never exceeds `maxChars`. Breaks fall on a paragraph, then a sentence, then a
 * space, and only then inside a token that is itself longer than the limit.
 */
export function chunkText(text: string, maxChars = 1800, overlap = 200): string[] {
  const clean = text.replace(/\r\n/g, "\n").trim();
  if (!clean) return [];
  const limit = Math.max(1, Math.floor(maxChars));
  const ov = Math.max(0, Math.min(Math.floor(overlap), Math.max(0, limit - 1)));

  const blocks = clean
    .split(/\n{2,}/)
    .flatMap((para) => splitBlock(para.trim(), limit))
    .filter((block) => block.length > 0);
  if (blocks.length === 0) return [];

  const chunks: string[] = [];
  let current = "";
  const flush = () => {
    if (current.trim()) chunks.push(current.trim());
    current = "";
  };

  for (const block of blocks) {
    if (!current) {
      current = block;
      continue;
    }
    const joined = `${current}\n\n${block}`;
    if (joined.length <= limit) {
      current = joined;
      continue;
    }
    flush();
    const tail = ov > 0 ? (chunks[chunks.length - 1]?.slice(-ov) ?? "") : "";
    const withOverlap = tail ? `${tail}\n\n${block}` : block;
    current = withOverlap.length <= limit ? withOverlap : block;
  }
  flush();
  return chunks;
}

/** Packs a paragraph, splitting on sentence boundaries before cutting a sentence that fits. */
function splitBlock(para: string, limit: number): string[] {
  if (!para) return [];
  if (para.length <= limit) return [para];

  const sentences = para
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
  if (sentences.length <= 1) return splitLongPiece(para, limit);

  const parts: string[] = [];
  let current = "";
  for (const sentence of sentences) {
    const pieces = sentence.length <= limit ? [sentence] : splitLongPiece(sentence, limit);
    for (const piece of pieces) {
      const next = current ? `${current} ${piece}` : piece;
      if (current && next.length > limit) {
        parts.push(current);
        current = piece;
      } else {
        current = next;
      }
    }
  }
  if (current) parts.push(current);
  return parts;
}

/** Cuts an oversized sentence or token at the last space or newline inside the window. */
function splitLongPiece(text: string, limit: number): string[] {
  const parts: string[] = [];
  let rest = text.trim();
  while (rest.length > limit) {
    const window = rest.slice(0, limit);
    const space = window.lastIndexOf(" ");
    const newline = window.lastIndexOf("\n");
    let cut = Math.max(space, newline);
    if (cut < Math.floor(limit * 0.5)) cut = limit;
    const head = rest.slice(0, cut).trim();
    if (!head) break;
    parts.push(head);
    rest = rest.slice(cut).trim();
  }
  if (rest) parts.push(rest);
  return parts;
}
