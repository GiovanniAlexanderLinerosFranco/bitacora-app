"use client";

import { useId, useState } from "react";

export interface CitationDemoCopy {
  title: string;
  hint: string;
  noteLabel: string;
  noteBefore: string;
  cited: string;
  noteAfter: string;
  summaryLabel: string;
  summary: string;
  flowLabel: string;
  flow: readonly [string, string, string];
  quizLabel: string;
  quizQuestion: string;
  quizAnswer: string;
  showSource: string;
  sourceLabel: string;
}

/** Shows one note becoming a summary, a flow or a quiz, each pointing at the same sentence. */
export function CitationDemo({ copy }: { copy: CitationDemoCopy }) {
  const baseId = useId();
  const [tool, setTool] = useState<"summary" | "flow" | "quiz">("summary");
  const [highlight, setHighlight] = useState(true);
  const tools = [
    { id: "summary" as const, label: copy.summaryLabel },
    { id: "flow" as const, label: copy.flowLabel },
    { id: "quiz" as const, label: copy.quizLabel },
  ];

  return (
    <section className="py-16" aria-labelledby={`${baseId}-title`}>
      <h2 id={`${baseId}-title`} className="text-center text-2xl font-bold text-slate-900">
        {copy.title}
      </h2>
      <p className="mx-auto mt-3 max-w-2xl text-center text-sm text-slate-600">{copy.hint}</p>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{copy.noteLabel}</p>
          <p className="mt-3 text-sm leading-7 text-slate-800">
            {copy.noteBefore}
            <mark
              id={`${baseId}-source`}
              className={highlight ? "rounded bg-amber-200 px-1 text-slate-900" : "bg-transparent text-slate-800"}
            >
              {copy.cited}
            </mark>
            {copy.noteAfter}
          </p>
        </article>

        <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-5">
          <div role="tablist" aria-label={copy.title} className="flex flex-wrap gap-2">
            {tools.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                id={`${baseId}-${item.id}`}
                aria-selected={tool === item.id}
                aria-controls={`${baseId}-panel`}
                onClick={() => {
                  setTool(item.id);
                  setHighlight(true);
                }}
                className={`rounded-full px-3 py-1.5 text-sm font-medium ${tool === item.id ? "bg-indigo-600 text-white" : "bg-white text-slate-700 hover:bg-indigo-100"}`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div role="tabpanel" id={`${baseId}-panel`} aria-labelledby={`${baseId}-${tool}`} className="mt-4">
            {tool === "summary" && <p className="text-sm leading-6 text-slate-800">{copy.summary}</p>}
            {tool === "flow" && (
              <ol className="flex flex-col gap-2">
                {copy.flow.map((step, index) => (
                  <li key={step} className="flex items-center gap-2 text-sm text-slate-800">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
                      {index + 1}
                    </span>
                    <span className="rounded-lg bg-white px-3 py-2">{step}</span>
                  </li>
                ))}
              </ol>
            )}
            {tool === "quiz" && (
              <div className="space-y-2 text-sm text-slate-800">
                <p className="font-medium">{copy.quizQuestion}</p>
                <p className="rounded-lg bg-white px-3 py-2">{copy.quizAnswer}</p>
              </div>
            )}
            <p className="mt-4 text-xs text-slate-600">
              <span className="font-semibold text-indigo-800">{copy.sourceLabel}: </span>
              {copy.cited}
            </p>
            <button
              type="button"
              onClick={() => {
                setHighlight(true);
                document.getElementById(`${baseId}-source`)?.scrollIntoView({ behavior: "smooth", block: "center" });
              }}
              className="mt-3 text-sm font-medium text-indigo-700 hover:underline"
            >
              {copy.showSource}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
