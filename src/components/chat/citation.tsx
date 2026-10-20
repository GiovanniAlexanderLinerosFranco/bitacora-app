"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "../../providers/i18n-provider";
import type { Citation } from "../../types";

function groupBySource(citations: Citation[]): Map<string, Citation[]> {
  const map = new Map<string, Citation[]>();
  for (const c of citations) map.set(c.sourceId, [...(map.get(c.sourceId) ?? []), c]);
  return map;
}

function SourceDetail({ citations }: { citations: Citation[] }) {
  const { t, formatDate } = useTranslation();
  const first = citations[0];
  return (
    <span className="block space-y-2 text-left">
      <span className="block text-sm font-semibold text-slate-900">{first.entryTitle}</span>
      <span className="block text-xs text-slate-500">
        {formatDate(first.entryDate)}
        {first.pageNumber ? ` · ${t("chat.page", { page: first.pageNumber })}` : ""}
      </span>
      {citations.map((c, i) => (
        <span key={i} className="block rounded-md border-l-4 border-emerald-400 bg-emerald-50 px-2 py-1.5 text-xs text-slate-700">
          <span className="mb-0.5 block font-medium text-emerald-700">✓ {t("chat.verifiedQuote")}</span>
          “{c.quote}”
        </span>
      ))}
    </span>
  );
}

/** Clickable [S1] marker that opens a popover with the verified quote, entry title and date. */
export function CitationTag({ sourceId, citations }: { sourceId: string; citations: Citation[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span ref={ref} className="relative mx-0.5 inline-block align-baseline">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((o) => !o)}
        className={`rounded px-1 text-xs font-semibold ${open ? "bg-emerald-600 text-white" : "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"}`}
      >
        [{sourceId}]
      </button>
      {open && (
        <span role="dialog" className="absolute left-0 top-full z-20 mt-1 block w-72 max-w-[80vw] rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
          <SourceDetail citations={citations} />
        </span>
      )}
    </span>
  );
}

/** Renders the answer text, turning each [S#] marker into a CitationTag. Unknown markers are left as plain text. */
export function AnswerText({ answer, citations }: { answer: string; citations: Citation[] }) {
  const bySource = useMemo(() => groupBySource(citations), [citations]);
  return (
    <div className="whitespace-pre-wrap leading-relaxed">
      {answer.split(/(\[S\d+\])/g).map((part, i) => {
        const id = /^\[(S\d+)\]$/.exec(part)?.[1];
        const group = id ? bySource.get(id) : undefined;
        return id && group ? <CitationTag key={i} sourceId={id} citations={group} /> : <Fragment key={i}>{part}</Fragment>;
      })}
    </div>
  );
}

/** Collapsible list of every verified source behind an answer. */
export function SourcesCard({ citations }: { citations: Citation[] }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const groups = useMemo(() => [...groupBySource(citations).entries()], [citations]);

  return (
    <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50/50">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium text-emerald-800"
      >
        <span>✓ {t("chat.verifiedSources", { count: groups.length })}</span>
        <span aria-hidden>{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <ul className="space-y-3 border-t border-emerald-200 px-3 py-3">
          {groups.map(([id, group]) => (
            <li key={id} className="flex gap-2">
              <span className="mt-0.5 h-fit rounded bg-emerald-100 px-1 text-xs font-semibold text-emerald-800">[{id}]</span>
              <SourceDetail citations={group} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
