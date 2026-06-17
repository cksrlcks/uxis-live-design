import { createSupabaseService } from "@/legacy/lib/supabase/service";
import { PROPOSALS_BUCKET } from "@/legacy/lib/proposals/constants";

export async function createUploadUrl(path: string) {
  const supabase = createSupabaseService();
  const { data, error } = await supabase.storage.from(PROPOSALS_BUCKET).createSignedUploadUrl(path);
  if (error || !data) throw new Error(`createSignedUploadUrl failed: ${error?.message ?? "no data"}`);
  return { path: data.path, token: data.token, signedUrl: data.signedUrl };
}

export async function createReadUrl(path: string, expiresIn = 3600) {
  const supabase = createSupabaseService();
  const { data, error } = await supabase.storage.from(PROPOSALS_BUCKET).createSignedUrl(path, expiresIn);
  if (error || !data) throw new Error(`createSignedUrl failed: ${error?.message ?? "no data"}`);
  return data.signedUrl;
}

// Sign many object paths in ONE network round-trip (vs one createReadUrl call each).
// Returns a path→signedUrl map; a path whose signing failed is omitted (caller decides
// how to handle a missing URL). Empty input short-circuits without hitting the network.
export async function createReadUrls(
  paths: string[],
  expiresIn = 3600,
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (paths.length === 0) return out;
  const supabase = createSupabaseService();
  const { data, error } = await supabase.storage.from(PROPOSALS_BUCKET).createSignedUrls(paths, expiresIn);
  if (error || !data) throw new Error(`createSignedUrls failed: ${error?.message ?? "no data"}`);
  for (const item of data) {
    if (item.signedUrl && item.path) out.set(item.path, item.signedUrl);
  }
  return out;
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
  const { data, error } = await supabase.storage.from(PROPOSALS_BUCKET).list(prefix, { limit: 1000 });
  if (error) throw new Error(`storage list failed: ${error.message}`);
  return new Set((data ?? []).map((o) => o.name));
}
