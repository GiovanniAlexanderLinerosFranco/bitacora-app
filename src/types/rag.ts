import type { Locale, UserRole } from "./profile";

/** A retrieved chunk the model is allowed to use. `sourceId` is the label the model must cite, e.g. "S1". */
export interface RetrievedChunk {
  sourceId: string;
  chunkId: string;
  entryId: string;
  subjectId: string | null;
  entryTitle: string;
  entryDate: string;
  pageNumber: number | null;
  content: string;
  similarity: number;
}

export interface RagQuery {
  question: string;
  subjectId?: string | null;
  /** When set, retrieval uses the team copy and does not search the personal corpus. */
  teamId?: string | null;
  matchCount?: number;
  matchThreshold?: number;
}

export interface RagUserContext {
  role: UserRole;
  academicLevel: string | null;
  careerOrField: string | null;
  language: Locale | (string & {});
}

export interface RagContext {
  query: RagQuery;
  user: RagUserContext;
  chunks: RetrievedChunk[];
}

export interface Citation {
  sourceId: string;
  entryId: string;
  entryTitle: string;
  entryDate: string;
  pageNumber: number | null;
  quote: string;
}

export type RagAnswerStatus = "answered" | "insufficient_context";

export interface RagVerification {
  removedSentences: number;
  removedMarkers: number;
  rejectedCitations: number;
}

export interface RagAnswer {
  status: RagAnswerStatus;
  answer: string;
  citations: Citation[];
  /** Present when the model was called; shows what the verifier had to strip. */
  verification?: RagVerification;
}

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };
