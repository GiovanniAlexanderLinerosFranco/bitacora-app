/** Paragraph-aware chunking with overlap. Sizes are in characters (~4 chars/token). */
export function chunkText(text: string, maxChars = 1800, overlap = 200): string[] {
  const clean = text.replace(/\r\n/g, "\n").trim();
  if (!clean) return [];
  const chunks: string[] = [];
  let current = "";
  const flush = () => {
    if (current.trim()) chunks.push(current.trim());
  };
  for (const para of clean.split(/\n{2,}/)) {
    if (para.length > maxChars) {
      flush();
      current = "";
      for (let i = 0; i < para.length; i += maxChars - overlap) chunks.push(para.slice(i, i + maxChars).trim());
      continue;
    }
    if (current && current.length + para.length + 2 > maxChars) {
      flush();
      current = current.slice(-overlap) + "\n\n" + para;
    } else {
      current = current ? `${current}\n\n${para}` : para;
    }
  }
  flush();
  return chunks;
}
