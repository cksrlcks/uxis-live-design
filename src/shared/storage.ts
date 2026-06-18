import "server-only";
import { createSupabaseService } from "@/shared/supabase/service";
import { PROPOSALS_BUCKET } from "@/shared/lib/proposals/constants";

export async function createUploadUrl(path: string) {
  const supabase = createSupabaseService();
  const { data, error } = await supabase.storage.from(PROPOSALS_BUCKET).createSignedUploadUrl(path);
  if (error || !data)
    throw new Error(`createSignedUploadUrl failed: ${error?.message ?? "no data"}`);
  return { path: data.path, token: data.token, signedUrl: data.signedUrl };
}

export async function removeObjects(paths: string[]) {
  if (paths.length === 0) return;
  const supabase = createSupabaseService();
  const { error } = await supabase.storage.from(PROPOSALS_BUCKET).remove(paths);
  if (error) throw new Error(`storage remove failed: ${error.message}`);
}

// Object names (basenames) directly under a folder prefix, e.g. "<proposalId>/<versionId>".
export async function listObjectNames(prefix: string): Promise<Set<string>> {
  const supabase = createSupabaseService();
  const { data, error } = await supabase.storage
    .from(PROPOSALS_BUCKET)
    .list(prefix, { limit: 1000 });
  if (error) throw new Error(`storage list failed: ${error.message}`);
  return new Set((data ?? []).map((o) => o.name));
}
