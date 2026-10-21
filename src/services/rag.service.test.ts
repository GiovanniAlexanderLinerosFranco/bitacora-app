import { beforeEach, describe, expect, it, vi } from "vitest";
import { LOCALES } from "../types";

vi.mock("../lib/ai/openai", () => ({
  embedTexts: vi.fn(),
  generateJson: vi.fn(),
}));

vi.mock("../lib/actions/helpers", () => ({
  fail: vi.fn(),
  fromPostgrest: vi.fn(),
  ok: vi.fn(),
}));

import { NO_CONTEXT, noContextMessage } from "./rag.service";

describe("NO_CONTEXT", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("has a distinct message for every supported locale", () => {
    expect(Object.keys(NO_CONTEXT).sort()).toEqual([...LOCALES].sort());
    const messages = LOCALES.map((locale) => NO_CONTEXT[locale]);
    expect(messages.every((message) => message && message.length > 20)).toBe(true);
    expect(new Set(messages).size).toBe(LOCALES.length);
  });

  it("answers in the active language, including a regional tag", () => {
    for (const locale of LOCALES) {
      expect(noContextMessage(locale)).toBe(NO_CONTEXT[locale]);
    }
    expect(noContextMessage("es-MX")).toBe(NO_CONTEXT.es);
    expect(noContextMessage("PT_BR")).toBe(NO_CONTEXT.pt);
  });

  it("falls back to English when the language is missing or unknown", () => {
    expect(noContextMessage("")).toBe(NO_CONTEXT.en);
    expect(noContextMessage("zz")).toBe(NO_CONTEXT.en);
    expect(noContextMessage("   ")).toBe(NO_CONTEXT.en);
  });
});
