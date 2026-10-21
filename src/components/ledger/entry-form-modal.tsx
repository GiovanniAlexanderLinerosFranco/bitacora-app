"use client";

import { useState, type FormEvent, type KeyboardEvent } from "react";
import { removeEntryAttachment, uploadEntryAttachment } from "../../actions/attachments";
import { createLedgerEntry, updateLedgerEntry } from "../../actions/ledger";
import { describeError } from "../../lib/action-error";
import { ALLOWED_MIME_TYPES, MAX_ATTACHMENT_BYTES, classifyMime } from "../../lib/attachments";
import { useTranslation } from "../../providers/i18n-provider";
import type { EntryType, LedgerEntry, SubjectOrProject, TaskStatus } from "../../types";
import { Alert, Badge, Button, Field, Modal, inputClass } from "../ui";

const ENTRY_TYPES: EntryType[] = ["class_note", "meeting", "document", "task", "reflection"];
const TASK_STATUSES: TaskStatus[] = ["todo", "in_progress", "done"];
const MAX_MB = MAX_ATTACHMENT_BYTES / 1024 / 1024;

const today = () => new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD in local time

function TagsInput({ tags, onChange, placeholder }: { tags: string[]; onChange: (tags: string[]) => void; placeholder: string }) {
  const [draft, setDraft] = useState("");

  function commit() {
    const tag = draft.trim().replace(/,+$/, "").toLowerCase();
    if (tag && tag.length <= 50 && !tags.includes(tag) && tags.length < 30) onChange([...tags, tag]);
    setDraft("");
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commit();
    } else if (e.key === "Backspace" && !draft && tags.length) {
      onChange(tags.slice(0, -1));
    }
  }

  return (
    <div className="flex flex-wrap gap-1.5 rounded-lg border border-slate-300 bg-white p-2 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-200">
      {tags.map((tag) => (
        <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700">
          #{tag}
          <button type="button" aria-label={`remove ${tag}`} onClick={() => onChange(tags.filter((x) => x !== tag))}>
            ×
          </button>
        </span>
      ))}
      <input
        value={draft}
        placeholder={tags.length ? "" : placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={commit}
        className="min-w-[8rem] flex-1 bg-transparent text-sm outline-none"
      />
    </div>
  );
}

export function EntryFormModal({
  entry,
  subjects,
  onClose,
  onSaved,
}: {
  entry: LedgerEntry | null;
  subjects: SubjectOrProject[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const [entryType, setEntryType] = useState<EntryType>(entry?.entryType ?? "class_note");
  const [title, setTitle] = useState(entry?.title ?? "");
  const [rawText, setRawText] = useState(entry?.rawText ?? "");
  const [subjectId, setSubjectId] = useState(entry?.subjectId ?? "");
  const [entryDate, setEntryDate] = useState(entry?.entryDate ?? today());
  const [tags, setTags] = useState<string[]>(entry?.tags ?? []);
  const [taskStatus, setTaskStatus] = useState<TaskStatus>(entry?.taskStatus ?? "todo");
  const [dueDate, setDueDate] = useState(entry?.dueDate ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [removeFile, setRemoveFile] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Archived subjects can't receive new entries, but keep the entry's current one selectable.
  const selectable = subjects.filter((s) => !s.isArchived || s.id === entry?.subjectId);
  const isTask = entryType === "task";

  function onFileChange(f: File | null) {
    setFileError(null);
    if (f && f.size > MAX_ATTACHMENT_BYTES) {
      setFileError(t("ledger.attachmentTooLarge", { size: MAX_MB }));
      return;
    }
    if (f && !classifyMime(f.type)) {
      setFileError(t("ledger.attachmentUnsupported"));
      return;
    }
    setFile(f);
    if (f) setRemoveFile(false);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    let saved: LedgerEntry;
    if (entry) {
      // Only send text fields when changed: they trigger re-indexing.
      const res = await updateLedgerEntry(entry.id, {
        entryType,
        subjectId: subjectId || null,
        entryDate,
        tags,
        taskStatus: isTask ? taskStatus : null,
        dueDate: isTask && dueDate ? dueDate : null,
        ...(title !== entry.title ? { title } : {}),
        ...(rawText !== entry.rawText ? { rawText } : {}),
      });
      if (res.error) {
        setError(describeError(res.error, t));
        setPending(false);
        return;
      }
      saved = res.data;
    } else {
      const res = await createLedgerEntry({
        entryType,
        title,
        rawText,
        subjectId: subjectId || null,
        entryDate,
        tags,
        ...(isTask ? { taskStatus, dueDate: dueDate || null } : {}),
      });
      if (res.error) {
        setError(describeError(res.error, t));
        setPending(false);
        return;
      }
      saved = res.data;
    }

    let warning: string | null = null;
    if (file) {
      const fd = new FormData();
      fd.append("file", file);
      const up = await uploadEntryAttachment(saved.id, fd);
      if (up.error) warning = t("ledger.uploadWarning", { reason: describeError(up.error, t) });
    } else if (removeFile && entry?.sourceFilePath) {
      const rm = await removeEntryAttachment(saved.id);
      if (rm.error) warning = describeError(rm.error, t);
    }

    onSaved();
    if (warning) {
      setError(warning); // keep the modal open so the user sees what failed
      setPending(false);
    } else {
      onClose();
    }
  }

  return (
    <Modal title={entry ? t("ledger.editEntry") : t("ledger.newEntry")} onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-4">
        {error && <Alert>{error}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("ledger.type")}>
            <select value={entryType} onChange={(e) => setEntryType(e.target.value as EntryType)} className={inputClass}>
              {ENTRY_TYPES.map((type) => (
                <option key={type} value={type}>
                  {t(`ledger.types.${type}`)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("ledger.date")}>
            <input type="date" required value={entryDate} onChange={(e) => setEntryDate(e.target.value)} className={inputClass} />
          </Field>
        </div>
        <Field label={t("ledger.titleField")}>
          <input required autoFocus maxLength={300} value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
        </Field>
        <Field label={t("ledger.content")}>
          <textarea
            rows={7}
            value={rawText}
            maxLength={200000}
            placeholder={t("ledger.contentPlaceholder")}
            onChange={(e) => setRawText(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label={t("ledger.subject")}>
          <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className={inputClass}>
            <option value="">{t("ledger.noSubject")}</option>
            {selectable.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
        {isTask && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("ledger.taskStatus")}>
              <select value={taskStatus} onChange={(e) => setTaskStatus(e.target.value as TaskStatus)} className={inputClass}>
                {TASK_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {t(`ledger.taskStatuses.${s}`)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("ledger.dueDate")}>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputClass} />
            </Field>
          </div>
        )}
        <div>
          <span className="mb-1 block text-sm font-medium text-slate-700">{t("ledger.tags")}</span>
          <TagsInput tags={tags} onChange={setTags} placeholder={t("ledger.tagsPlaceholder")} />
        </div>
        <div>
          <span className="mb-1 block text-sm font-medium text-slate-700">{t("ledger.attachment")}</span>
          {entry?.sourceFilePath && !removeFile && !file && (
            <div className="mb-2 flex items-center gap-2 text-sm text-slate-600">
              <Badge>{t("ledger.currentFile")}</Badge>
              <span className="truncate">{entry.sourceFilePath.split("/").pop()?.replace(/^[0-9a-f-]{36}-/, "")}</span>
              <Button variant="ghost" className="text-red-600" onClick={() => setRemoveFile(true)}>
                {t("ledger.removeFile")}
              </Button>
            </div>
          )}
          <input
            type="file"
            accept={ALLOWED_MIME_TYPES.join(",")}
            onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-indigo-700"
          />
          <span className="mt-1 block text-xs text-slate-500">{t("ledger.attachmentHint", { size: MAX_MB })}</span>
          {fileError && <span className="mt-1 block text-xs text-red-600">{fileError}</span>}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? t("common.saving") : t("common.save")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
