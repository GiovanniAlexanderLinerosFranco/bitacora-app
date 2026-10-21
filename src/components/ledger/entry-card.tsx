"use client";

import { useState } from "react";
import { getEntryAttachmentUrl } from "../../actions/attachments";
import { describeError } from "../../lib/action-error";
import { useTranslation } from "../../providers/i18n-provider";
import type { EmbeddingStatus, LedgerEntry, SubjectOrProject } from "../../types";
import { SubjectBadge } from "../subject-badge";
import { Badge, Button } from "../ui";

const STATUS_TONE: Record<EmbeddingStatus, "neutral" | "good" | "warn" | "bad"> = {
  pending: "neutral",
  processing: "warn",
  ready: "good",
  failed: "bad",
};

export function EntryCard({
  entry,
  subject,
  onEdit,
  onDelete,
  onReindex,
  onTagClick,
  onError,
}: {
  entry: LedgerEntry;
  subject: SubjectOrProject | undefined;
  onEdit: () => void;
  onDelete: () => void;
  onReindex: () => void;
  onTagClick: (tag: string) => void;
  onError: (message: string) => void;
}) {
  const { t, formatDate } = useTranslation();
  const [opening, setOpening] = useState(false);

  async function openAttachment() {
    setOpening(true);
    const res = await getEntryAttachmentUrl(entry.id);
    setOpening(false);
    if (res.error) onError(describeError(res.error, t));
    else window.open(res.data.url, "_blank", "noopener,noreferrer");
  }

  return (
    <article id={`entry-${entry.id}`} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge>{t(`ledger.types.${entry.entryType}`)}</Badge>
        {subject && <SubjectBadge subject={subject} />}
        {entry.taskStatus && <Badge tone={entry.taskStatus === "done" ? "good" : "warn"}>{t(`ledger.taskStatuses.${entry.taskStatus}`)}</Badge>}
        <span className="text-slate-500">{formatDate(entry.entryDate)}</span>
        {entry.dueDate && (
          <span className="text-slate-500">
            · {t("ledger.dueDate")}: {formatDate(entry.dueDate)}
          </span>
        )}
        <span className="ml-auto">
          <Badge tone={STATUS_TONE[entry.embeddingStatus]}>{t(`ledger.embedding.${entry.embeddingStatus}`)}</Badge>
        </span>
      </div>

      <h3 className="mt-2 text-base font-semibold text-slate-900">{entry.title}</h3>
      {entry.rawText && <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-sm text-slate-600">{entry.rawText}</p>}

      {entry.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {entry.tags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => onTagClick(tag)}
              className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700 hover:bg-indigo-100"
            >
              #{tag}
            </button>
          ))}
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-1">
        {entry.sourceFilePath && (
          <Button variant="secondary" disabled={opening} onClick={openAttachment}>
            📎 {t("ledger.download")}
          </Button>
        )}
        {entry.embeddingStatus === "failed" && (
          <Button variant="secondary" onClick={onReindex}>
            ↻ {t("ledger.reindex")}
          </Button>
        )}
        <Button variant="ghost" onClick={onEdit}>
          {t("common.edit")}
        </Button>
        <Button variant="ghost" className="text-red-600" onClick={onDelete}>
          {t("common.delete")}
        </Button>
      </div>
    </article>
  );
}
