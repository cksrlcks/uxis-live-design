"use client";

import { http } from "@/shared/api/http";
import { measureImage, uploadSingle } from "@/shared/storage-client";

type UploadSpec = {
  pageId: string;
  path: string;
  token: string;
  signedUrl: string;
  pageOrder: number;
};

// 모든 페이지 연산은 특정 버전을 대상으로 한다.
function pagesBase(proposalId: string, variantId: string, versionId: string): string {
  return `/api/proposals/${proposalId}/variants/${variantId}/versions/${versionId}/pages`;
}

// 이미지 추가(여러 장) — 업로드 URL 발급 → 직접 업로드 → 확인. 서버가 반환한
// uploads는 파일 순서와 동일하므로 measured[i]와 그대로 짝지운다.
export async function appendPages(
  proposalId: string,
  variantId: string,
  versionId: string,
  files: File[],
): Promise<void> {
  const measured = await Promise.all(files.map(measureImage));
  const base = pagesBase(proposalId, variantId, versionId);
  const { uploads } = await http<{ versionId: string; uploads: UploadSpec[] }>(base, {
    method: "POST",
    body: JSON.stringify({ files: files.map((f) => ({ contentType: f.type, size: f.size })) }),
  });

  const pages = [];
  for (let i = 0; i < uploads.length; i++) {
    await uploadSingle(uploads[i].path, uploads[i].token, measured[i].file);
    pages.push({
      pageId: uploads[i].pageId,
      pageOrder: uploads[i].pageOrder,
      path: uploads[i].path,
      width: measured[i].width,
      height: measured[i].height,
    });
  }
  await http(base, { method: "PUT", body: JSON.stringify({ pages }) });
}

// 페이지 이미지 교체 — 새 객체용 URL 발급 → 업로드 → 확인.
export async function replacePage(
  proposalId: string,
  variantId: string,
  versionId: string,
  pageId: string,
  file: File,
): Promise<void> {
  const m = await measureImage(file);
  const item = `${pagesBase(proposalId, variantId, versionId)}/${pageId}`;
  const { path, token } = await http<{ path: string; token: string; signedUrl: string }>(
    `${item}/replace`,
    { method: "POST", body: JSON.stringify({ contentType: file.type, size: file.size }) },
  );
  await uploadSingle(path, token, m.file);
  await http(item, {
    method: "PUT",
    body: JSON.stringify({ path, width: m.width, height: m.height }),
  });
}

export function deletePage(
  proposalId: string,
  variantId: string,
  versionId: string,
  pageId: string,
): Promise<void> {
  return http<void>(`${pagesBase(proposalId, variantId, versionId)}/${pageId}`, {
    method: "DELETE",
  });
}

export function reorderPages(
  proposalId: string,
  variantId: string,
  versionId: string,
  orderedPageIds: string[],
): Promise<void> {
  return http<void>(pagesBase(proposalId, variantId, versionId), {
    method: "PATCH",
    body: JSON.stringify({ orderedPageIds }),
  });
}
