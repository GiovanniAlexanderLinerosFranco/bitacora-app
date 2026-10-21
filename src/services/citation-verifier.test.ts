import { describe, expect, it } from "vitest";
import type { RetrievedChunk } from "../types";
import { quoteMatchesSource, verifyAnswer } from "./citation-verifier";

const SOURCE = "Mitosis separates sister chromatids into two nuclei during cell division.";

function chunk(overrides: Partial<RetrievedChunk> = {}): RetrievedChunk {
  return {
    sourceId: "S1",
    chunkId: "chunk-1",
    entryId: "entry-1",
    subjectId: null,
    entryTitle: "Cell notes",
    entryDate: "2026-03-01",
    pageNumber: null,
    content: SOURCE,
    similarity: 0.91,
    ...overrides,
  };
}

describe("quoteMatchesSource", () => {
  it("accepts a verbatim substring of the retrieved chunk", () => {
    expect(quoteMatchesSource("separates sister chromatids", SOURCE)).toBe(true);
  });

  it("rejects a paraphrase that is not in the chunk", () => {
    expect(quoteMatchesSource("cell division copies every chromosome exactly", SOURCE)).toBe(false);
  });

  it("rejects a quote shorter than the evidence minimum", () => {
    expect(quoteMatchesSource("Mitosis", SOURCE)).toBe(false);
  });

  it("matches case, extra whitespace and diacritics after normalization", () => {
    expect(quoteMatchesSource("  SEPARATES   sister chromatids ", SOURCE)).toBe(true);
    expect(quoteMatchesSource("el nucleo contiene ADN", "El núcleo contiene ADN mitocondrial aquí.")).toBe(true);
  });

  it("requires every ellipsis fragment to appear in the chunk", () => {
    expect(quoteMatchesSource("separates sister...two nuclei", SOURCE)).toBe(true);
    expect(quoteMatchesSource("separates sister...chlorophyll pigment", SOURCE)).toBe(false);
  });
});

describe("verifyAnswer", () => {
  it("keeps a sentence whose quote is copied from the chunk", () => {
    const result = verifyAnswer(
      "Mitosis separates sister chromatids. [S1]",
      [{ sourceId: "s1", quote: "separates sister chromatids" }],
      [chunk()],
    );

    expect(result.answer).toBe("Mitosis separates sister chromatids. [S1]");
    expect(result.citations).toHaveLength(1);
    expect(result.citations[0]).toMatchObject({
      sourceId: "S1",
      entryId: "entry-1",
      quote: "separates sister chromatids",
    });
    expect(result.rejectedCitations).toBe(0);
    expect(result.removedSentences).toBe(0);
  });

  it("drops a claim when its quote is not exactly in the retrieved chunk", () => {
    const result = verifyAnswer(
      "Sunlight builds sugar in the leaves. [S1]",
      [{ sourceId: "S1", quote: "Sunlight builds sugar in the leaves" }],
      [chunk()],
    );

    expect(result.answer).toBe("");
    expect(result.citations).toEqual([]);
    expect(result.rejectedCitations).toBe(1);
    expect(result.removedSentences).toBe(1);
  });

  it("keeps only the line whose source quote survived", () => {
    const result = verifyAnswer(
      ["Mitosis separates sister chromatids. [S1]", "Sunlight builds sugar in the leaves. [S2]"].join("\n"),
      [
        { sourceId: "S1", quote: "separates sister chromatids" },
        { sourceId: "S2", quote: "Sunlight builds sugar in the leaves" },
      ],
      [chunk(), chunk({ sourceId: "S2", chunkId: "chunk-2", content: "Chromosomes line up at the metaphase plate." })],
    );

    expect(result.answer).toBe("Mitosis separates sister chromatids. [S1]");
    expect(result.citations.map((citation) => citation.sourceId)).toEqual(["S1"]);
    expect(result.rejectedCitations).toBe(1);
    expect(result.removedSentences).toBe(1);
  });

  it("strips a marker that points at an unknown source and removes the uncited sentence", () => {
    const result = verifyAnswer(
      "Mitosis separates sister chromatids. [S9]",
      [{ sourceId: "S9", quote: "separates sister chromatids" }],
      [chunk()],
    );

    expect(result.answer).toBe("");
    expect(result.citations).toEqual([]);
    expect(result.removedMarkers).toBeGreaterThan(0);
    expect(result.rejectedCitations).toBe(1);
  });

  it("removes a sentence that has no citation marker", () => {
    const result = verifyAnswer("Mitosis separates sister chromatids.", [], [chunk()]);

    expect(result.answer).toBe("");
    expect(result.removedSentences).toBe(1);
    expect(result.citations).toEqual([]);
  });
});
