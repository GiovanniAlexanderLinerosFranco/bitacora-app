import { describe, expect, it } from "vitest";
import { chunkText } from "./chunking";

const words = (chunk: string) => chunk.split(/\s+/).filter(Boolean);

describe("chunkText", () => {
  it("returns no chunks for empty or whitespace-only notes", () => {
    expect(chunkText("")).toEqual([]);
    expect(chunkText("  \n\n\t  ")).toEqual([]);
  });

  it("keeps a short note in a single chunk and normalizes carriage returns", () => {
    expect(chunkText("alpha\r\nbeta", 100, 0)).toEqual(["alpha\nbeta"]);
    expect(chunkText("alpha\n\nbeta", 100, 0)).toEqual(["alpha\n\nbeta"]);
  });

  it("never emits a chunk longer than the block size", () => {
    const text = Array.from({ length: 40 }, (_, i) => `Sentence number ${i} stays readable.`).join(" ");
    const chunks = chunkText(text, 80, 15);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.length <= 80)).toBe(true);
  });

  it("keeps a sentence intact when it fits in the block", () => {
    const first = "Mitosis copies the nucleus.";
    const second = "Cytokinesis splits the cell.";
    const chunks = chunkText(`${first} ${second}`, first.length + 5, 0);

    expect(chunks).toEqual([first, second]);
    expect(chunks.every((chunk) => chunk === first || chunk === second)).toBe(true);
  });

  it("splits an oversized sentence on a space instead of inside a word", () => {
    const chunks = chunkText("one two three four five six seven", 12, 0);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.length <= 12)).toBe(true);
    for (const chunk of chunks) {
      expect(words(chunk).every((word) => ["one", "two", "three", "four", "five", "six", "seven"].includes(word))).toBe(true);
    }
    expect(chunks.flatMap(words)).toEqual(["one", "two", "three", "four", "five", "six", "seven"]);
  });

  it("carries the overlap tail into the next chunk only when the block still fits", () => {
    const chunks = chunkText("ABCDEFGHIJ\n\nKLMNO", 12, 4);

    expect(chunks).toEqual(["ABCDEFGHIJ", "GHIJ\n\nKLMNO"]);
    expect(chunks.every((chunk) => chunk.length <= 12)).toBe(true);
    expect(chunks[1]?.startsWith("GHIJ")).toBe(true);
  });

  it("omits the overlap when prepending it would exceed the block size", () => {
    const chunks = chunkText("ABCDEFGHIJ\n\nKLMNOPQRST", 12, 8);

    expect(chunks.every((chunk) => chunk.length <= 12)).toBe(true);
    expect(chunks[1]).toBe("KLMNOPQRST");
  });
});
