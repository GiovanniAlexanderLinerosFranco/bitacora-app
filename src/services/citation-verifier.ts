import type { Citation, RetrievedChunk } from "../types";

export interface RawCitation {
  sourceId: string;
  quote: string;
}

export interface VerificationResult {
  /** Answer with unsupported sentences removed and invalid markers stripped; empty when nothing survives. */
  answer: string;
  /** Only citations whose quote was found verbatim in the cited source AND whose marker remains in the answer. */
  citations: Citation[];
  removedSentences: number;
  removedMarkers: number;
  rejectedCitations: number;
}

/** Quotes shorter than this are too easy to match by chance to count as evidence. */
const MIN_QUOTE_CHARS = 12;

const MARKER_RE = /\[\s*(S\d+(?:\s*[,;]\s*S\d+)*)\s*\]/gi;

/** Case/whitespace/quote-style/diacritic-insensitive form used only for comparison. */
export function normalizeForMatch(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u2018\u2019\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E]/g, '"')
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** A quote is valid only if it is a verbatim (normalized) substring of the source chunk. Ellipsis-joined fragments must each match. */
export function quoteMatchesSource(quote: string, sourceContent: string): boolean {
  const hay = normalizeForMatch(sourceContent);
  const fragments = quote
    .split(/\.{3}|\u2026/)
    .map(normalizeForMatch)
    .filter((f) => f.length > 0);
  if (fragments.length === 0) return false;
  if (fragments.join("").length < MIN_QUOTE_CHARS) return false;
  return fragments.every((f) => hay.includes(f));
}

function idsIn(markerBody: string): string[] {
  return markerBody.split(/[,;]/).map((s) => s.trim().toUpperCase());
}

/**
 * Zero-tolerance post-processing:
 * 1. A source counts as "verified" only if at least one model-provided quote for it appears verbatim in that chunk.
 * 2. Markers pointing at unknown or unverified sources are stripped.
 * 3. Every remaining sentence must carry at least one valid marker, otherwise it is removed
 *    (an uncited claim cannot be trusted to come from the sources).
 * 4. Citations are limited to verified sources still referenced by the final answer.
 */
export function verifyAnswer(rawAnswer: string, rawCitations: RawCitation[], chunks: RetrievedChunk[]): VerificationResult {
  const bySource = new Map(chunks.map((c) => [c.sourceId.toUpperCase(), c]));

  const verifiedQuotes = new Map<string, string[]>();
  let rejectedCitations = 0;
  for (const c of rawCitations) {
    const id = c.sourceId?.trim().toUpperCase();
    const src = id ? bySource.get(id) : undefined;
    if (src && typeof c.quote === "string" && quoteMatchesSource(c.quote, src.content)) {
      verifiedQuotes.set(id, [...(verifiedQuotes.get(id) ?? []), c.quote.trim()]);
    } else {
      rejectedCitations++;
    }
  }

  let removedSentences = 0;
  let removedMarkers = 0;
  const usedSources = new Set<string>();
  const keptLines: string[] = [];

  for (const line of rawAnswer.replace(/\r\n/g, "\n").split("\n")) {
    if (!line.trim()) {
      keptLines.push("");
      continue;
    }
    // Split into sentences, keeping a trailing marker with the sentence it supports ("... fact. [S1]").
    const sentences = line.split(/(?<=[.!?;:])\s+(?!\[\s*S\d)/);
    const keptSentences: string[] = [];

    for (const sentence of sentences) {
      let hasValid = false;
      const stripped = sentence.replace(MARKER_RE, (_m, body: string) => {
        const valid = idsIn(body).filter((id) => verifiedQuotes.has(id));
        removedMarkers += idsIn(body).length - valid.length;
        if (valid.length === 0) return "";
        hasValid = true;
        valid.forEach((id) => usedSources.add(id));
        return valid.map((id) => `[${id}]`).join("");
      });
      const textOnly = stripped.replace(/\[S\d+\]/gi, "").replace(/[\s\-*•>#\d.)(:;,]+/g, "");
      if (textOnly.length === 0) continue; // nothing but markers/bullets left
      if (hasValid) keptSentences.push(stripped.replace(/\s+([.,;:!?])/g, "$1").replace(/\s{2,}/g, " ").trim());
      else removedSentences++;
    }
    if (keptSentences.length) keptLines.push(keptSentences.join(" "));
  }

  const answer = keptLines.join("\n").replace(/\n{3,}/g, "\n\n").trim();

  const citations: Citation[] = [];
  for (const id of usedSources) {
    const src = bySource.get(id)!;
    for (const quote of new Set(verifiedQuotes.get(id))) {
      citations.push({
        sourceId: src.sourceId,
        entryId: src.entryId,
        entryTitle: src.entryTitle,
        entryDate: src.entryDate,
        pageNumber: src.pageNumber,
        quote,
      });
    }
  }
  citations.sort((a, b) => a.sourceId.localeCompare(b.sourceId, undefined, { numeric: true }));

  return { answer: citations.length ? answer : "", citations, removedSentences, removedMarkers, rejectedCitations };
}
