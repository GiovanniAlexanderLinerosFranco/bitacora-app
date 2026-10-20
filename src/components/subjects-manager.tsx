"use client";

import { useMemo, useState, type FormEvent } from "react";
import { archiveSubject, createSubject, deleteSubject, updateSubject } from "../actions/subjects";
import { describeError } from "../lib/action-error";
import { useSubjects } from "../hooks/use-subjects";
import { useTranslation } from "../providers/i18n-provider";
import type { SubjectOrProject, WorkspaceKind } from "../types";
import { SUBJECT_COLORS, SubjectBadge } from "./subject-badge";
import { Alert, Badge, Button, Card, Field, Modal, inputClass } from "./ui";

function SubjectFormModal({
  subject,
  onClose,
  onSaved,
}: {
  subject: SubjectOrProject | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const [kind, setKind] = useState<WorkspaceKind>(subject?.kind ?? "subject");
  const [name, setName] = useState(subject?.name ?? "");
  const [description, setDescription] = useState(subject?.description ?? "");
  const [color, setColor] = useState<string | null>(subject?.color ?? SUBJECT_COLORS[0]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const input = { kind, name, description, color };
    const res = subject ? await updateSubject(subject.id, input) : await createSubject({ ...input, description });
    if (res.error) {
      setError(describeError(res.error));
      setPending(false);
      return;
    }
    await onSaved();
    onClose();
  }

  return (
    <Modal title={subject ? t("subjects.edit") : t("subjects.create")} onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-4">
        {error && <Alert>{error}</Alert>}
        <Field label={t("subjects.kind")}>
          <select value={kind} onChange={(e) => setKind(e.target.value as WorkspaceKind)} className={inputClass}>
            <option value="subject">{t("subjects.kinds.subject")}</option>
            <option value="project">{t("subjects.kinds.project")}</option>
          </select>
        </Field>
        <Field label={t("subjects.name")}>
          <input required autoFocus maxLength={200} value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </Field>
        <Field label={t("subjects.description")}>
          <textarea rows={3} maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} />
        </Field>
        <fieldset>
          <legend className="mb-1 text-sm font-medium text-slate-700">{t("subjects.color")}</legend>
          <div className="flex flex-wrap gap-2">
            {SUBJECT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={c}
                aria-pressed={color === c}
                onClick={() => setColor(c)}
                className={`h-7 w-7 rounded-full ring-offset-2 ${color === c ? "ring-2 ring-slate-900" : ""}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </fieldset>
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

export function SubjectsManager() {
  const { t } = useTranslation();
  const { subjects, loading, error, reload } = useSubjects();
  const [kindFilter, setKindFilter] = useState<WorkspaceKind | "">("");
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<SubjectOrProject | "new" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const visible = useMemo(
    () => subjects.filter((s) => (showArchived || !s.isArchived) && (!kindFilter || s.kind === kindFilter)),
    [subjects, kindFilter, showArchived],
  );

  async function run(op: Promise<{ error: { code: string; message: string; fields?: Record<string, string> } | null }>) {
    const res = await op;
    if (res.error) setActionError(describeError(res.error));
    else setActionError(null);
    await reload();
  }

  return (
    <Card
      title={t("subjects.title")}
      description={t("subjects.subtitle")}
      actions={<Button onClick={() => setEditing("new")}>+ {t("subjects.new")}</Button>}
    >
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select
          aria-label={t("subjects.kind")}
          value={kindFilter}
          onChange={(e) => setKindFilter(e.target.value as WorkspaceKind | "")}
          className={`${inputClass} !w-auto`}
        >
          <option value="">{t("common.all")}</option>
          <option value="subject">{t("subjects.kinds.subject")}</option>
          <option value="project">{t("subjects.kinds.project")}</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
          {t("subjects.showArchived")}
        </label>
      </div>

      {(error || actionError) && <Alert>{error ?? actionError}</Alert>}
      {loading ? (
        <p className="text-sm text-slate-500">{t("common.loading")}</p>
      ) : visible.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">{t("subjects.empty")}</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {visible.map((s) => (
            <li key={s.id} className={`rounded-xl border border-slate-200 p-3 ${s.isArchived ? "opacity-60" : ""}`}>
              <div className="flex flex-wrap items-center gap-2">
                <SubjectBadge subject={s} />
                <Badge>{t(`subjects.kinds.${s.kind}`)}</Badge>
                {s.isArchived && <Badge tone="warn">{t("subjects.archivedTag")}</Badge>}
              </div>
              {s.description && <p className="mt-2 line-clamp-2 text-sm text-slate-600">{s.description}</p>}
              <div className="mt-3 flex flex-wrap gap-1">
                <Button variant="ghost" onClick={() => setEditing(s)}>
                  {t("common.edit")}
                </Button>
                <Button variant="ghost" onClick={() => run(archiveSubject(s.id, !s.isArchived))}>
                  {s.isArchived ? t("common.restore") : t("common.archive")}
                </Button>
                <Button
                  variant="ghost"
                  className="text-red-600"
                  onClick={() => window.confirm(t("subjects.confirmDelete", { name: s.name })) && run(deleteSubject(s.id))}
                >
                  {t("common.delete")}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <SubjectFormModal subject={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={reload} />
      )}
    </Card>
  );
}
