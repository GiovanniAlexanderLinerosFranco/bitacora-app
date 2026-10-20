export interface ActionError {
  code: string;
  message: string;
  /** Per-field validation messages, keyed by field name. */
  fields?: Record<string, string>;
}

export type ActionResponse<T> = { data: T; error: null } | { data: null; error: ActionError };
