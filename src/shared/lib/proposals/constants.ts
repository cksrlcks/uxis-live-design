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

// 리사이즈된 썸네일 URL. Supabase Storage 이미지 변환(render) 엔드포인트로 원본(수 MB)
// 대신 서버가 리사이즈한 WebP(Accept 헤더 기준 자동)를 받는다. 시안 페이지는 가로폭이
// 커서 목록 썸네일엔 width만 제한해 부담을 크게 줄인다.
// 주의: Supabase 프로젝트에서 "이미지 변환(Image Transformation)" 기능이 켜져 있어야 한다.
export function thumbnailUrl(
  path: string,
  opts: {
    width?: number;
    height?: number;
    quality?: number;
    resize?: "cover" | "contain" | "fill";
  } = {},
): string {
  const { width = 480, height, quality = 70, resize = "cover" } = opts;
  const qs = new URLSearchParams({
    width: String(width),
    quality: String(quality),
    resize,
  });
  if (height) qs.set("height", String(height));
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/render/image/public/${PROPOSALS_BUCKET}/${path}?${qs}`;
}

// 이미 만들어진 public object URL(원본)을 Supabase 이미지 변환(render) 썸네일 URL로 바꾼다.
// 클라이언트에는 storagePath 없이 원본 url만 내려가는 경우(프리뷰 홈 카드 등)가 있어,
// url 문자열만으로 썸네일을 만들 수 있게 한다. 풀해상도가 필요한 뷰어는 원본 url을 그대로 쓰고,
// 카드/목록 썸네일에서만 이 함수를 거쳐 가로폭만 줄인다. resize:"contain"으로 좌우는 보존.
export function thumbnailFromPublicUrl(
  url: string,
  opts: {
    width?: number;
    height?: number;
    quality?: number;
    resize?: "cover" | "contain" | "fill";
  } = {},
): string {
  const rendered = url.replace("/storage/v1/object/public/", "/storage/v1/render/image/public/");
  // 예상한 public URL 형식이 아니면(변환 불가) 원본을 그대로 반환.
  if (rendered === url) return url;
  const { width = 480, height, quality = 70, resize = "contain" } = opts;
  const qs = new URLSearchParams({
    width: String(width),
    quality: String(quality),
    resize,
  });
  if (height) qs.set("height", String(height));
  return `${rendered}?${qs}`;
}
