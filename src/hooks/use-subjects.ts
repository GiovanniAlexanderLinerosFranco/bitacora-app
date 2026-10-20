"use client";

import { useCallback, useEffect, useState } from "react";
import { listSubjects } from "../actions/subjects";
import { describeError } from "../lib/action-error";
import type { SubjectOrProject } from "../types";

/** Loads all of the user's subjects/projects (including archived) so UIs can resolve badges and selectors. */
export function useSubjects() {
  const [subjects, setSubjects] = useState<SubjectOrProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const res = await listSubjects({ includeArchived: true });
    if (res.error) setError(describeError(res.error));
    else {
      setSubjects(res.data);
      setError(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { subjects, loading, error, reload };
}
