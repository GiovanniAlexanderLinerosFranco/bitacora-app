"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { retryStuckIndexing } from "../../actions/indexing";
import { deleteLedgerEntry, getLedgerEntry, listLedgerEntries, reindexLedgerEntry, type ListEntriesParams } from "../../actions/ledger";
import { describeError } from "../../lib/action-error";
import { useSubjects } from "../../hooks/use-subjects";
import { useTranslation } from "../../providers/i18n-provider";
import type { EntryType, LedgerEntry } from "../../types";
import { Alert, Button, Card, inputClass } from "../ui";
import { EntryCard } from "./entry-card";
import { EntryFormModal } from "./entry-form-modal";

const PAGE_SIZE = 20;
const ENTRY_TYPES: EntryType[] = ["class_note", "meeting", "document", "task", "reflection"];
const POLL_MS = 4000;
const MAX_POLLS = 60;

interface Filters {
  subjectId: string;
  entryType: EntryType | "";
  tag: string;
  from: string;
  to: string;
}
const NO_FILTERS: Filters = { subjectId: "", entryType: "", tag: "", from: "", to: "" };

export function LedgerWorkspace() {
  const { t } = useTranslation();
  const { subjects } = useSubjects();
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [tagDraft, setTagDraft] = useState("");
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<LedgerEntry | "new" | null>(null);
  const requestId = useRef(0);

  const subjectById = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects]);
  const hasFilters = Object.values(filters).some(Boolean);

  const load = useCallback(
    async (offset: number) => {
      const id = ++requestId.current;
      setLoading(true);
      const params: ListEntriesParams = {
        limit: PAGE_SIZE,
        offset,
        ...(filters.subjectId ? { subjectId: filters.subjectId } : {}),
        ...(filters.entryType ? { entryType: filters.entryType } : {}),
        ...(filters.tag ? { tag: filters.tag } : {}),
        ...(filters.from ? { from: filters.from } : {}),
        ...(filters.to ? { to: filters.to } : {}),
      };
      const res = await listLedgerEntries(params);
      if (id !== requestId.current) return; // a newer request superseded this one
      setLoading(false);
      if (res.error) return setError(describeError(res.error, t));
      setError(null);
      setHasMore(res.data.length === PAGE_SIZE);
      setEntries((prev) => (offset === 0 ? res.data : [...prev, ...res.data]));
    },
    [filters, t],
  );

  useEffect(() => {
    void load(0);
  }, [load]);

  // Re-embeds this owner's pending and failed notes, and processing rows abandoned mid-run.
  // The action filters service-role queries by the signed-in user. Overlapping sweeps are skipped.
  const retrying = useRef(false);
  useEffect(() => {
    let cancelled = false;
    const sweep = async () => {
      if (retrying.current) return;
      retrying.current = true;
      try {
        const res = await retryStuckIndexing();
        if (cancelled || res.error || res.data.entryIds.length === 0) return;
        const results = await Promise.all(res.data.entryIds.map((id) => getLedgerEntry(id)));
        if (cancelled) return;
        const fresh = new Map(results.flatMap((r) => (r.data ? [[r.data.id, r.data] as const] : [])));
        setEntries((prev) => prev.map((e) => fresh.get(e.id) ?? e));
      } finally {
        retrying.current = false;
      }
    };
    void sweep();
    const timer = setInterval(() => void sweep(), 60_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  // Debounce the free-text tag filter.
  useEffect(() => {
    const timer = setTimeout(() => setFilters((f) => (f.tag === tagDraft.trim().toLowerCase() ? f : { ...f, tag: tagDraft.trim().toLowerCase() })), 400);
    return () => clearTimeout(timer);
  }, [tagDraft]);

  // Refresh only entries that are still being indexed, so statuses update without a manual reload.
  const inFlight = entries
    .filter((e) => e.embeddingStatus === "pending" || e.embeddingStatus === "processing")
    .map((e) => e.id)
    .join(",");
  useEffect(() => {
    if (!inFlight) return;
    const ids = inFlight.split(",");
    let polls = 0;
    const timer = setInterval(async () => {
      if (++polls > MAX_POLLS) return clearInterval(timer);
      const results = await Promise.all(ids.map((id) => getLedgerEntry(id)));
      const fresh = new Map(results.flatMap((r) => (r.data ? [[r.data.id, r.data] as const] : [])));
      setEntries((prev) => prev.map((e) => fresh.get(e.id) ?? e));
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [inFlight]);

  async function onDelete(entry: LedgerEntry) {
    if (!window.confirm(t("ledger.confirmDelete"))) return;
    const res = await deleteLedgerEntry(entry.id);
    if (res.error) setError(describeError(res.error, t));
    else setEntries((prev) => prev.filter((e) => e.id !== entry.id));
  }

  async function onReindex(entry: LedgerEntry) {
    const res = await reindexLedgerEntry(entry.id);
    if (res.error) setError(describeError(res.error, t));
    else setEntries((prev) => prev.map((e) => (e.id === entry.id ? res.data : e)));
  }

  function clearFilters() {
    setFilters(NO_FILTERS);
    setTagDraft("");
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t("ledger.title")}</h1>
          <p className="text-sm text-slate-500">{t("ledger.subtitle")}</p>
        </div>
        <Button onClick={() => setEditing("new")}>+ {t("ledger.newEntry")}</Button>
      </div>

      <Card>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <select aria-label={t("ledger.filters.subject")} value={filters.subjectId} onChange={(e) => setFilters({ ...filters, subjectId: e.target.value })} className={inputClass}>
            <option value="">{t("ledger.filters.subject")}: {t("common.all")}</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <select aria-label={t("ledger.filters.type")} value={filters.entryType} onChange={(e) => setFilters({ ...filters, entryType: e.target.value as EntryType | "" })} className={inputClass}>
            <option value="">{t("ledger.filters.type")}: {t("common.all")}</option>
            {ENTRY_TYPES.map((type) => (
              <option key={type} value={type}>
                {t(`ledger.types.${type}`)}
              </option>
            ))}
          </select>
          <input aria-label={t("ledger.filters.tag")} placeholder={`#${t("ledger.filters.tag")}`} value={tagDraft} onChange={(e) => setTagDraft(e.target.value)} className={inputClass} />
          <input aria-label={t("ledger.filters.from")} title={t("ledger.filters.from")} type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} className={inputClass} />
          <input aria-label={t("ledger.filters.to")} title={t("ledger.filters.to")} type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} className={inputClass} />
        </div>
        {hasFilters && (
          <div className="mt-3">
            <Button variant="ghost" onClick={clearFilters}>
              ✕ {t("common.clear")}
            </Button>
          </div>
        )}
      </Card>

      {error && <Alert>{error}</Alert>}

      {entries.length === 0 && !loading ? (
        <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
          {hasFilters ? t("ledger.emptyFiltered") : t("ledger.empty")}
        </p>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => (
            <EntryCard
              key={entry.id}
              entry={entry}
              subject={entry.subjectId ? subjectById.get(entry.subjectId) : undefined}
              onEdit={() => setEditing(entry)}
              onDelete={() => onDelete(entry)}
              onReindex={() => onReindex(entry)}
              onTagClick={(tag) => {
                setTagDraft(tag);
                setFilters((f) => ({ ...f, tag }));
              }}
              onError={setError}
            />
          ))}
        </div>
      )}

      {loading && <p className="text-center text-sm text-slate-500">{t("common.loading")}</p>}
      {hasMore && !loading && (
        <div className="text-center">
          <Button variant="secondary" onClick={() => load(entries.length)}>
            {t("ledger.loadMore")}
          </Button>
        </div>
      )}

      {editing && (
        <EntryFormModal
          key={editing === "new" ? "new" : editing.id}
          entry={editing === "new" ? null : editing}
          subjects={subjects}
          onClose={() => setEditing(null)}
          onSaved={() => void load(0)}
        />
      )}
    </div>
  );
}
