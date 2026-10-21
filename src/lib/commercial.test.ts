import { describe, expect, it } from "vitest";
import { sanitizeEventMetadata } from "./product-events";
import { localeFromPathname } from "./public-locale";
import { landingMetadata } from "./seo";

describe("sanitizeEventMetadata", () => {
  it("keeps short codes and numbers", () => {
    expect(sanitizeEventMetadata({ entry_type: "class_note", chunk_count: 3, has_subject: true })).toEqual({
      entry_type: "class_note",
      chunk_count: 3,
      has_subject: true,
    });
  });

  it("drops note text, questions, quotes, titles and long strings", () => {
    expect(
      sanitizeEventMetadata({
        raw_text: "the whole note",
        rawText: "also the note",
        question: "What did I write about mitosis?",
        content: "attachment text",
        quote: "separates sister chromatids",
        title: "Lab 1",
        answer: "A long tutor answer that must not be stored.",
        reason: "no_chunks",
        essay: "x".repeat(41),
      }),
    ).toEqual({ reason: "no_chunks" });
  });

  it("ignores arrays and nested objects", () => {
    expect(sanitizeEventMetadata(["sign_up"])).toEqual({});
    expect(sanitizeEventMetadata({ nested: { question: "secret" } })).toEqual({});
  });
});

describe("localeFromPathname", () => {
  it("reads a single public locale segment and ignores app routes", () => {
    expect(localeFromPathname("/es")).toBe("es");
    expect(localeFromPathname("/PT")).toBe("pt");
    expect(localeFromPathname("/")).toBeNull();
    expect(localeFromPathname("/pricing")).toBeNull();
    expect(localeFromPathname("/es/pricing")).toBeNull();
  });
});

describe("landingMetadata", () => {
  it("publishes the Spanish copy and a hreflang map for every locale", () => {
    const meta = landingMetadata("es");
    expect(typeof meta.title === "string" ? meta.title : "").toContain("Evoluciona");
    expect(typeof meta.description === "string" ? meta.description.length : 0).toBeGreaterThan(40);
    expect(String(meta.alternates?.canonical ?? "")).toContain("/es");
    expect(String(meta.alternates?.languages?.es ?? "")).toContain("/es");
    expect(String(meta.alternates?.languages?.ar ?? "")).toContain("/ar");
    expect(String(meta.alternates?.languages?.["x-default"] ?? "")).toMatch(/^http/);
    expect(meta.openGraph && "locale" in meta.openGraph ? meta.openGraph.locale : "").toBe("es_ES");
  });
});
