import type { LedgerEntry, SubjectOrProject, UserProfile } from "../../types";

export interface ProfileRow {
  id: string;
  display_name: string | null;
  role: UserProfile["role"];
  academic_level: string | null;
  career_or_field: string | null;
  preferred_language: string;
  timezone: string;
  onboarding_completed_at?: string | null;
  created_at: string;
  updated_at: string;
}
export const toProfile = (r: ProfileRow): UserProfile => ({
  id: r.id,
  displayName: r.display_name,
  role: r.role,
  academicLevel: r.academic_level,
  careerOrField: r.career_or_field,
  preferredLanguage: r.preferred_language,
  timezone: r.timezone,
  onboardingCompletedAt: r.onboarding_completed_at ?? null,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export interface SubjectRow {
  id: string;
  user_id: string;
  kind: SubjectOrProject["kind"];
  name: string;
  description: string | null;
  color: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}
export const toSubject = (r: SubjectRow): SubjectOrProject => ({
  id: r.id,
  userId: r.user_id,
  kind: r.kind,
  name: r.name,
  description: r.description,
  color: r.color,
  isArchived: r.is_archived,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export interface EntryRow {
  id: string;
  user_id: string;
  subject_id: string | null;
  entry_type: LedgerEntry["entryType"];
  title: string;
  raw_text: string;
  language: string | null;
  entry_date: string;
  task_status: LedgerEntry["taskStatus"];
  due_date: string | null;
  source_file_path: string | null;
  source_mime_type: string | null;
  tags: string[];
  metadata: Record<string, unknown>;
  embedding_status: LedgerEntry["embeddingStatus"];
  created_at: string;
  updated_at: string;
}
export const toEntry = (r: EntryRow): LedgerEntry => ({
  id: r.id,
  userId: r.user_id,
  subjectId: r.subject_id,
  entryType: r.entry_type,
  title: r.title,
  rawText: r.raw_text,
  language: r.language,
  entryDate: r.entry_date,
  taskStatus: r.task_status,
  dueDate: r.due_date,
  sourceFilePath: r.source_file_path,
  sourceMimeType: r.source_mime_type,
  tags: r.tags,
  metadata: r.metadata,
  embeddingStatus: r.embedding_status,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});
