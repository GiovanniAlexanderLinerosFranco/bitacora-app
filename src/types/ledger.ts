export type WorkspaceKind = "subject" | "project";
export type EntryType = "class_note" | "meeting" | "document" | "task" | "reflection";
export type TaskStatus = "todo" | "in_progress" | "done";
export type EmbeddingStatus = "pending" | "processing" | "ready" | "failed";

export interface SubjectOrProject {
  id: string;
  userId: string;
  kind: WorkspaceKind;
  name: string;
  description: string | null;
  color: string | null;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export type CreateSubjectInput = Pick<SubjectOrProject, "name"> &
  Partial<Pick<SubjectOrProject, "kind" | "description" | "color">>;

export interface LedgerEntry {
  id: string;
  userId: string;
  subjectId: string | null;
  entryType: EntryType;
  title: string;
  rawText: string;
  language: string | null;
  entryDate: string; // YYYY-MM-DD
  taskStatus: TaskStatus | null;
  dueDate: string | null;
  sourceFilePath: string | null;
  sourceMimeType: string | null;
  tags: string[];
  metadata: Record<string, unknown>;
  embeddingStatus: EmbeddingStatus;
  createdAt: string;
  updatedAt: string;
}

export type CreateLedgerEntryInput = Pick<LedgerEntry, "title" | "entryType"> &
  Partial<
    Pick<LedgerEntry, "subjectId" | "rawText" | "language" | "entryDate" | "taskStatus" | "dueDate" | "tags" | "metadata">
  >;

export interface DocumentChunk {
  id: string;
  userId: string;
  entryId: string;
  subjectId: string | null;
  chunkIndex: number;
  content: string;
  tokenCount: number | null;
  pageNumber: number | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}
