import type { ActionError } from "../types";

/** Human-readable text for an action error: field messages when present, else the general message. */
export function describeError(error: ActionError): string {
  const fields = error.fields ? Object.values(error.fields) : [];
  return fields.length ? fields.join(" ") : error.message;
}
