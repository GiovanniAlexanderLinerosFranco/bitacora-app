import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ATTACHMENTS_BUCKET, normalizeMime, sanitizeFileName } from "../attachments";
import { createAdminClient } from "./admin";

/** Object path: <user_id>/<entry_id>/<uuid>-<filename>. The first segment is what storage RLS checks. */
export function buildAttachmentPath(userId: string, entryId: string, fileName: string): string {
  return `${userId}/${entryId}/${crypto.randomUUID()}-${sanitizeFileName(fileName)}`;
}

/**
 * Personal-layer storage path: `<user_id>/<...>` with no empty, `.` or `..` segments.
 * The first segment is the owner. A later copy of the id, a prefix of it, or a traversal does not pass.
 */
export function isOwnedPath(userId: string, path: string): boolean {
  if (!userId || /[\\/]/.test(userId)) return false;
  if (path.includes("\\")) return false;
  const segments = path.split("/");
  if (segments.length < 2) return false;
  if (segments.some((segment) => segment.length === 0 || segment === "." || segment === "..")) return false;
  return segments[0] === userId;
}

/** Upload with the user's client so storage RLS enforces ownership. */
export async function uploadAttachment(
  supabase: SupabaseClient,
  path: string,
  file: Blob,
  mimeType: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase.storage
    .from(ATTACHMENTS_BUCKET)
    .upload(path, file, { contentType: normalizeMime(mimeType), upsert: false });
  return { error: error?.message ?? null };
}

export async function removeAttachment(supabase: SupabaseClient, path: string): Promise<void> {
  const { error } = await supabase.storage.from(ATTACHMENTS_BUCKET).remove([path]);
  if (error) console.error("[storage] remove failed", error.message);
}

export async function createAttachmentUrl(
  supabase: SupabaseClient,
  path: string,
  expiresInSeconds = 300,
): Promise<{ url: string | null; error: string | null }> {
  const { data, error } = await supabase.storage.from(ATTACHMENTS_BUCKET).createSignedUrl(path, expiresInSeconds);
  return { url: data?.signedUrl ?? null, error: error?.message ?? null };
}

/** Service-role download for the indexing pipeline. Refuses paths outside the owner's folder. */
export async function downloadAttachmentForUser(userId: string, path: string): Promise<Uint8Array> {
  if (!isOwnedPath(userId, path)) throw new Error("Attachment path does not belong to user");
  const { data, error } = await createAdminClient().storage.from(ATTACHMENTS_BUCKET).download(path);
  if (error || !data) throw new Error(`Attachment download failed: ${error?.message ?? "no data"}`);
  return new Uint8Array(await data.arrayBuffer());
}
