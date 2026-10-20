"use client";

import { Badge } from "./ui";
import type { SubjectOrProject } from "../types";

export const SUBJECT_COLORS = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#8b5cf6", "#64748b"];

export function SubjectBadge({ subject }: { subject: Pick<SubjectOrProject, "name" | "color"> }) {
  return <Badge color={subject.color ?? "#94a3b8"}>{subject.name}</Badge>;
}
