import { z } from "zod";

const emptyToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);
const optText = (max: number) => z.preprocess(emptyToNull, z.string().trim().max(max).nullable());
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD").refine((s) => !Number.isNaN(Date.parse(s)), "Invalid date");
const uuid = z.string().uuid();

export const updateProfileSchema = z
  .object({
    displayName: optText(120),
    role: z.enum(["student", "professional"]),
    academicLevel: optText(120),
    careerOrField: optText(160),
    preferredLanguage: z.string().regex(/^[a-z]{2}(-[A-Z]{2})?$/, "Invalid language code"),
    timezone: z.string().max(64).refine((tz) => {
      try {
        new Intl.DateTimeFormat(undefined, { timeZone: tz });
        return true;
      } catch {
        return false;
      }
    }, "Invalid timezone"),
  })
  .partial()
  .strict();

const subjectBase = {
  kind: z.enum(["subject", "project"]),
  name: z.string().trim().min(1, "Required").max(200),
  description: optText(2000),
  color: z.preprocess(emptyToNull, z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use #RRGGBB").nullable()),
};
export const createSubjectSchema = z
  .object({ ...subjectBase, kind: subjectBase.kind.default("subject"), description: subjectBase.description.optional(), color: subjectBase.color.optional() })
  .strict();
export const updateSubjectSchema = z.object({ ...subjectBase, isArchived: z.boolean() }).partial().strict();

const tags = z
  .array(z.string().trim().min(1).max(50))
  .max(30)
  .transform((t) => [...new Set(t.map((x) => x.toLowerCase()))]);
const metadata = z
  .record(z.string(), z.unknown())
  .refine((m) => JSON.stringify(m).length <= 20_000, "Metadata too large");

const entryBase = {
  subjectId: uuid.nullable(),
  entryType: z.enum(["class_note", "meeting", "document", "task", "reflection"]),
  title: z.string().trim().min(1, "Required").max(300),
  rawText: z.string().max(200_000),
  language: z.preprocess(emptyToNull, z.string().regex(/^[a-z]{2}(-[A-Z]{2})?$/).nullable()),
  entryDate: isoDate,
  taskStatus: z.enum(["todo", "in_progress", "done"]).nullable(),
  dueDate: isoDate.nullable(),
  tags,
  metadata,
};

export const createEntrySchema = z
  .object({
    title: entryBase.title,
    entryType: entryBase.entryType,
    subjectId: entryBase.subjectId.optional(),
    rawText: entryBase.rawText.optional(),
    language: entryBase.language.optional(),
    entryDate: entryBase.entryDate.optional(),
    taskStatus: entryBase.taskStatus.optional(),
    dueDate: entryBase.dueDate.optional(),
    tags: entryBase.tags.optional(),
    metadata: entryBase.metadata.optional(),
  })
  .strict();
export const updateEntrySchema = z.object(entryBase).partial().strict();

export const listEntriesSchema = z
  .object({
    subjectId: uuid.optional(),
    entryType: entryBase.entryType.optional(),
    tag: z.string().trim().min(1).max(50).optional(),
    from: isoDate.optional(),
    to: isoDate.optional(),
    limit: z.number().int().min(1).max(100).default(50),
    offset: z.number().int().min(0).default(0),
  })
  .strict();

export const idSchema = uuid;

/** Tutor question. The subject filter, when present, must be one of the caller's own subject ids. */
export const askAssistantSchema = z
  .object({
    question: z.string().trim().min(1, "Required").max(2000),
    subjectId: z.string().uuid().nullable().optional(),
    teamId: z.string().uuid().nullable().optional(),
  })
  .strict();
