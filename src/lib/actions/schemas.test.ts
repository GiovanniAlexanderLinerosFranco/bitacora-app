import { describe, expect, it } from "vitest";
import {
  askAssistantSchema,
  createEntrySchema,
  createSubjectSchema,
  idSchema,
  listEntriesSchema,
  updateEntrySchema,
  updateProfileSchema,
} from "./schemas";

const SUBJECT = "11111111-1111-4111-8111-111111111111";

describe("createEntrySchema", () => {
  it("accepts a minimal note and normalizes tags", () => {
    const parsed = createEntrySchema.safeParse({
      title: "  Mitosis  ",
      entryType: "class_note",
      tags: ["Bio", "bio", "Lab"],
    });

    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.title).toBe("Mitosis");
    expect(parsed.data.tags).toEqual(["bio", "lab"]);
  });

  it("rejects an empty title, a bad date, an unknown field and a subject that is not a uuid", () => {
    expect(createEntrySchema.safeParse({ title: "   ", entryType: "task" }).success).toBe(false);
    expect(createEntrySchema.safeParse({ title: "Note", entryType: "class_note", entryDate: "2020-13-40" }).success).toBe(false);
    expect(createEntrySchema.safeParse({ title: "Note", entryType: "class_note", extra: true }).success).toBe(false);
    expect(createEntrySchema.safeParse({ title: "Note", entryType: "class_note", subjectId: "not-a-uuid" }).success).toBe(false);
  });

  it("rejects a note whose text exceeds the personal ledger cap", () => {
    const parsed = createEntrySchema.safeParse({
      title: "Huge",
      entryType: "document",
      rawText: "a".repeat(200_001),
    });
    expect(parsed.success).toBe(false);
  });
});

describe("updateEntrySchema", () => {
  it("accepts a partial patch and rejects an empty title", () => {
    expect(updateEntrySchema.safeParse({ taskStatus: "done" }).success).toBe(true);
    expect(updateEntrySchema.safeParse({ title: "" }).success).toBe(false);
    expect(updateEntrySchema.safeParse({ ownerId: SUBJECT }).success).toBe(false);
  });
});

describe("listEntriesSchema", () => {
  it("applies the default page and accepts a subject filter", () => {
    const parsed = listEntriesSchema.safeParse({ subjectId: SUBJECT, entryType: "task", tag: "lab" });

    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.limit).toBe(50);
    expect(parsed.data.offset).toBe(0);
    expect(parsed.data.subjectId).toBe(SUBJECT);
  });

  it("rejects an inverted page size, a negative offset and a malformed date", () => {
    expect(listEntriesSchema.safeParse({ limit: 0 }).success).toBe(false);
    expect(listEntriesSchema.safeParse({ limit: 101 }).success).toBe(false);
    expect(listEntriesSchema.safeParse({ offset: -1 }).success).toBe(false);
    expect(listEntriesSchema.safeParse({ from: "01-01-2026" }).success).toBe(false);
    expect(listEntriesSchema.safeParse({ subjectId: "mine" }).success).toBe(false);
  });
});

describe("askAssistantSchema", () => {
  it("accepts a trimmed question and an optional subject", () => {
    const parsed = askAssistantSchema.safeParse({ question: "  What is mitosis?  ", subjectId: SUBJECT });

    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.question).toBe("What is mitosis?");
    expect(parsed.data.subjectId).toBe(SUBJECT);
  });

  it("accepts a question over the whole personal ledger", () => {
    expect(askAssistantSchema.safeParse({ question: "Summarize my lab", subjectId: null }).success).toBe(true);
  });

  it("rejects an empty question, a question over 2000 characters, a bad subject and extra fields", () => {
    expect(askAssistantSchema.safeParse({ question: "   " }).success).toBe(false);
    expect(askAssistantSchema.safeParse({ question: "a".repeat(2001) }).success).toBe(false);
    expect(askAssistantSchema.safeParse({ question: "Why?", subjectId: "subject" }).success).toBe(false);
    expect(askAssistantSchema.safeParse({ question: "Why?", userId: SUBJECT }).success).toBe(false);
  });
});

describe("parameter schemas", () => {
  it("validates ids, profile fields and subject names", () => {
    expect(idSchema.safeParse(SUBJECT).success).toBe(true);
    expect(idSchema.safeParse("entry-1").success).toBe(false);

    const profile = updateProfileSchema.safeParse({
      role: "student",
      preferredLanguage: "es",
      timezone: "America/Bogota",
      careerOrField: "Biology",
    });
    expect(profile.success).toBe(true);
    expect(updateProfileSchema.safeParse({ role: "admin" }).success).toBe(false);
    expect(updateProfileSchema.safeParse({ timezone: "Not/AZone" }).success).toBe(false);
    expect(updateProfileSchema.safeParse({ preferredLanguage: "spanish" }).success).toBe(false);

    const subject = createSubjectSchema.safeParse({ name: "  Genetics  " });
    expect(subject.success).toBe(true);
    if (!subject.success) return;
    expect(subject.data.name).toBe("Genetics");
    expect(subject.data.kind).toBe("subject");
    expect(createSubjectSchema.safeParse({ name: "" }).success).toBe(false);
    expect(createSubjectSchema.safeParse({ name: "Lab", color: "blue" }).success).toBe(false);
  });
});
