export const PROPOSALS_BUCKET = "proposals";
export const MAX_PAGE_BYTES = 25 * 1024 * 1024; // 25MB per page

const EXT_BY_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export const ALLOWED_IMAGE_TYPES = Object.keys(EXT_BY_TYPE);

export function extForContentType(contentType: string): string | null {
  return EXT_BY_TYPE[contentType] ?? null;
}

export function pagePath(
  proposalId: string,
  versionId: string,
  pageId: string,
  ext: string,
): string {
  return `${proposalId}/${versionId}/${pageId}.${ext}`;
}

// Permanent public URL for an object in the (public) proposals bucket.
// Reads NEXT_PUBLIC_SUPABASE_URL at call time so it works on server and client.
export function publicUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${PROPOSALS_BUCKET}/${path}`;
}
