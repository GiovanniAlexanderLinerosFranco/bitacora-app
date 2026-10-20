"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { askAssistant } from "../../actions/chat";
import { describeError } from "../../lib/action-error";
import { useSubjects } from "../../hooks/use-subjects";
import { useTranslation } from "../../providers/i18n-provider";
import type { RagAnswer } from "../../types";
import { Alert, Button, inputClass } from "../ui";
import { AnswerText, SourcesCard } from "./citation";

type Message =
  | { id: number; role: "user"; content: string }
  | { id: number; role: "assistant"; answer: RagAnswer | null; error: string | null };

export function ChatPanel() {
  const { t } = useTranslation();
  const { subjects } = useSubjects();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [pending, setPending] = useState(false);
  const nextId = useRef(1);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, pending]);

  async function send() {
    const question = input.trim();
    if (!question || pending) return;
    setInput("");
    setPending(true);
    setMessages((m) => [...m, { id: nextId.current++, role: "user", content: question }]);

    // Answers are verified against the sources before display, so they arrive whole instead of token by token.
    const res = await askAssistant({ question, subjectId: subjectId || null });
    setMessages((m) => [
      ...m,
      { id: nextId.current++, role: "assistant", answer: res.error ? null : res.data, error: res.error ? describeError(res.error) : null },
    ]);
    setPending(false);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void send();
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void send();
    }
  }

  return (
    <div className="flex h-[calc(100vh-8.5rem)] min-h-[28rem] flex-col rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div>
          <h1 className="text-lg font-semibold">{t("chat.title")}</h1>
          <p className="text-xs text-slate-500">{t("chat.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <select aria-label={t("chat.subjectFilter")} value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className={`${inputClass} !w-auto`}>
            <option value="">{t("chat.allSubjects")}</option>
            {subjects
              .filter((s) => !s.isArchived)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
          </select>
          {messages.length > 0 && (
            <Button variant="ghost" onClick={() => setMessages([])} disabled={pending}>
              {t("chat.newConversation")}
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4" aria-live="polite">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="text-4xl">🎓</div>
            <h2 className="mt-2 text-lg font-semibold">{t("chat.intro")}</h2>
            <p className="mt-1 max-w-sm text-sm text-slate-500">{t("chat.introHint")}</p>
          </div>
        )}

        {messages.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="flex justify-end">
              <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-indigo-600 px-4 py-2.5 text-sm text-white">{m.content}</div>
            </div>
          ) : (
            <div key={m.id} className="flex">
              <div className="max-w-[92%] rounded-2xl rounded-bl-sm border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800">
                {m.error ? (
                  <Alert>{m.error}</Alert>
                ) : m.answer?.status === "answered" ? (
                  <>
                    <AnswerText answer={m.answer.answer} citations={m.answer.citations} />
                    <SourcesCard citations={m.answer.citations} />
                    {m.answer.verification && m.answer.verification.removedSentences > 0 && (
                      <p className="mt-2 text-xs text-amber-700">⚠ {t("chat.strippedNotice")}</p>
                    )}
                  </>
                ) : (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
                    <p className="text-xs font-semibold uppercase tracking-wide">{t("chat.insufficientTitle")}</p>
                    <p className="mt-1">{m.answer?.answer}</p>
                  </div>
                )}
              </div>
            </div>
          ),
        )}

        {pending && (
          <div className="flex">
            <div className="flex items-center gap-2 rounded-2xl rounded-bl-sm border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
              <span className="flex gap-1" aria-hidden>
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:300ms]" />
              </span>
              {t("chat.thinking")}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={onSubmit} className="flex items-end gap-2 border-t border-slate-200 p-3">
        <textarea
          rows={1}
          maxLength={2000}
          value={input}
          placeholder={t("chat.placeholder")}
          aria-label={t("chat.placeholder")}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          className={`${inputClass} max-h-32 resize-none`}
        />
        <Button type="submit" disabled={pending || !input.trim()}>
          {t("chat.send")}
        </Button>
      </form>
    </div>
  );
}
