import { describe, expect, it } from "vitest";
import { buildAttachmentPath, isOwnedPath } from "./storage";

const OWNER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const ENTRY = "33333333-3333-4333-8333-333333333333";

describe("isOwnedPath", () => {
  it("accepts a personal path whose first segment is the owner", () => {
    expect(isOwnedPath(OWNER, `${OWNER}/${ENTRY}/file.pdf`)).toBe(true);
  });

  it("rejects another owner, a prefix of the id, and a path with no file segment", () => {
    expect(isOwnedPath(OWNER, `${OTHER}/${ENTRY}/file.pdf`)).toBe(false);
    expect(isOwnedPath(OWNER, `${OWNER}-extra/${ENTRY}/file.pdf`)).toBe(false);
    expect(isOwnedPath(OWNER, OWNER)).toBe(false);
    expect(isOwnedPath("", `${OWNER}/file.pdf`)).toBe(false);
  });

  it("rejects traversal, empty segments, dot segments and backslashes", () => {
    expect(isOwnedPath(OWNER, `${OWNER}/../${OTHER}/secret.pdf`)).toBe(false);
    expect(isOwnedPath(OWNER, `${OWNER}/./secret.pdf`)).toBe(false);
    expect(isOwnedPath(OWNER, `${OWNER}//secret.pdf`)).toBe(false);
    expect(isOwnedPath(OWNER, `/${OWNER}/secret.pdf`)).toBe(false);
    expect(isOwnedPath(OWNER, `${OWNER}\\${ENTRY}\\secret.pdf`)).toBe(false);
    expect(isOwnedPath(`${OWNER}/nested`, `${OWNER}/nested/file.pdf`)).toBe(false);
  });
});

describe("buildAttachmentPath", () => {
  it("builds a path under the owner and entry, and sanitizes the file name", () => {
    const path = buildAttachmentPath(OWNER, ENTRY, "lab notes (final).pdf");

    expect(isOwnedPath(OWNER, path)).toBe(true);
    expect(isOwnedPath(OTHER, path)).toBe(false);
    expect(path.startsWith(`${OWNER}/${ENTRY}/`)).toBe(true);
    expect(path.endsWith("-lab_notes_final_.pdf")).toBe(true);
    expect(path.split("/").some((segment) => segment === ".." || segment === "." || segment.length === 0)).toBe(false);
  });
});
