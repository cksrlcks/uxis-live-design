import "server-only";
import { randomUUID } from "node:crypto";
import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/shared/db";
import { proposals, proposalVariants, proposalVersions, proposalPages } from "@drizzle/schema";
import { requireEditor } from "@/shared/auth/guards.server";
import { extForContentType, pagePath } from "@/shared/lib/proposals/constants";
import { createUploadUrl, removeObjects, listObjectNames } from "@/shared/storage";
import {
  requestPageUploadsSchema,
  confirmPagesSchema,
  replacePageUploadSchema,
  confirmReplacePageSchema,
  reorderPagesSchema,
} from "../model/upload-schemas";

// 모든 페이지 연산은 특정 버전을 대상으로 한다. 이 헬퍼가 버전이 해당 안(variant)
// 의, 그리고 안이 해당 proposal의 것인지 한곳에서 검증한다.
async function requireVersion(id: string, variantId: string, versionId: string): Promise<void> {
  const rows = await db
    .select({ id: proposalVersions.id })
    .from(proposalVersions)
    .innerJoin(proposalVariants, eq(proposalVersions.variantId, proposalVariants.id))
    .where(
      and(
        eq(proposalVersions.id, versionId),
        eq(proposalVariants.id, variantId),
        eq(proposalVariants.proposalId, id),
      ),
    )
    .limit(1);
  if (rows.length === 0) throw new Error("NOT_FOUND");
}

// 업로드된 객체가 이 버전 폴더({proposalId}/{versionId}) 바로 아래 존재하는지 검증.
function assertUnderVersion(path: string, prefix: string, existing: Set<string>): void {
  const name = path.startsWith(`${prefix}/`) ? path.slice(prefix.length + 1) : "";
  if (!name || name.includes("/") || !existing.has(name)) throw new Error("OBJECT_MISSING");
}

// 이미지 추가(append) — 현재 페이지 뒤에 붙일 N개의 서명 업로드 URL을 발급한다.
export async function requestPageUploads(
  id: string,
  variantId: string,
  versionId: string,
  input: unknown,
) {
  await requireEditor();
  const { files } = requestPageUploadsSchema.parse(input);
  await requireVersion(id, variantId, versionId);

  const maxRow = await db
    .select({ max: sql<number>`coalesce(max(${proposalPages.pageOrder}), -1)` })
    .from(proposalPages)
    .where(eq(proposalPages.versionId, versionId));
  const startOrder = (maxRow[0]?.max ?? -1) + 1;

  const uploads = [];
  for (let i = 0; i < files.length; i++) {
    const ext = extForContentType(files[i].contentType)!;
    const pageId = randomUUID();
    const path = pagePath(id, versionId, pageId, ext);
    const signed = await createUploadUrl(path);
    uploads.push({
      pageId,
      path,
      token: signed.token,
      signedUrl: signed.signedUrl,
      pageOrder: startOrder + i,
    });
  }
  return { versionId, uploads };
}

// 추가 업로드 완료 확인 — 객체 존재 검증 후 페이지 행을 삽입한다.
export async function appendPages(
  id: string,
  variantId: string,
  versionId: string,
  input: unknown,
): Promise<void> {
  await requireEditor();
  const { pages } = confirmPagesSchema.parse(input);
  await requireVersion(id, variantId, versionId);

  const prefix = `${id}/${versionId}`;
  const existing = await listObjectNames(prefix);
  for (const p of pages) assertUnderVersion(p.path, prefix, existing);

  await db.insert(proposalPages).values(
    pages.map((p) => ({
      id: p.pageId,
      versionId,
      pageOrder: p.pageOrder,
      storagePath: p.path,
      width: p.width,
      height: p.height,
    })),
  );
  await db.update(proposals).set({ updatedAt: new Date() }).where(eq(proposals.id, id));
}

// 페이지 이미지 교체 — 새 객체용 서명 업로드 URL을 발급한다(같은 버전 폴더, 새 파일명).
export async function requestReplacePageUpload(
  id: string,
  variantId: string,
  versionId: string,
  pageId: string,
  input: unknown,
) {
  await requireEditor();
  const meta = replacePageUploadSchema.parse(input);
  await requireVersion(id, variantId, versionId);

  const owns = await db
    .select({ id: proposalPages.id })
    .from(proposalPages)
    .where(and(eq(proposalPages.id, pageId), eq(proposalPages.versionId, versionId)))
    .limit(1);
  if (owns.length === 0) throw new Error("NOT_FOUND");

  const ext = extForContentType(meta.contentType)!;
  const objectId = randomUUID(); // 새 파일명 → CDN 캐시 무효화
  const path = pagePath(id, versionId, objectId, ext);
  const signed = await createUploadUrl(path);
  return { path, token: signed.token, signedUrl: signed.signedUrl };
}

// 교체 업로드 완료 확인 — 페이지 행의 경로/크기를 갱신하고 이전 객체를 제거한다.
export async function confirmReplacePage(
  id: string,
  variantId: string,
  versionId: string,
  pageId: string,
  input: unknown,
): Promise<void> {
  await requireEditor();
  const { path, width, height } = confirmReplacePageSchema.parse(input);
  await requireVersion(id, variantId, versionId);

  const rows = await db
    .select({ oldPath: proposalPages.storagePath })
    .from(proposalPages)
    .where(and(eq(proposalPages.id, pageId), eq(proposalPages.versionId, versionId)))
    .limit(1);
  const oldPath = rows[0]?.oldPath;
  if (!oldPath) throw new Error("NOT_FOUND");

  const prefix = `${id}/${versionId}`;
  assertUnderVersion(path, prefix, await listObjectNames(prefix));

  await db
    .update(proposalPages)
    .set({ storagePath: path, width, height })
    .where(eq(proposalPages.id, pageId));
  if (oldPath !== path) await removeObjects([oldPath]);
  await db.update(proposals).set({ updatedAt: new Date() }).where(eq(proposals.id, id));
}

// 페이지 삭제 — 객체 제거 후 남은 페이지의 pageOrder를 0..n-1로 압축한다.
export async function deletePage(
  id: string,
  variantId: string,
  versionId: string,
  pageId: string,
): Promise<void> {
  await requireEditor();
  await requireVersion(id, variantId, versionId);

  const rows = await db
    .select({ path: proposalPages.storagePath })
    .from(proposalPages)
    .where(and(eq(proposalPages.id, pageId), eq(proposalPages.versionId, versionId)))
    .limit(1);
  const target = rows[0];
  if (!target) throw new Error("NOT_FOUND");

  await db.transaction(async (tx) => {
    await tx.delete(proposalPages).where(eq(proposalPages.id, pageId));
    // 오름차순 압축: 목표 슬롯 i는 항상 비어 있어 unique(versionId, pageOrder) 충돌 없음.
    const after = await tx
      .select({ id: proposalPages.id, pageOrder: proposalPages.pageOrder })
      .from(proposalPages)
      .where(eq(proposalPages.versionId, versionId))
      .orderBy(asc(proposalPages.pageOrder));
    for (let i = 0; i < after.length; i++) {
      if (after[i].pageOrder !== i) {
        await tx.update(proposalPages).set({ pageOrder: i }).where(eq(proposalPages.id, after[i].id));
      }
    }
  });

  await removeObjects([target.path]);
  await db.update(proposals).set({ updatedAt: new Date() }).where(eq(proposals.id, id));
}

// 페이지 순서 재정렬 — orderedPageIds(새 순서)는 해당 버전의 페이지 집합과 정확히 일치해야 한다.
export async function reorderPages(
  id: string,
  variantId: string,
  versionId: string,
  input: unknown,
): Promise<void> {
  await requireEditor();
  const { orderedPageIds } = reorderPagesSchema.parse(input);
  await requireVersion(id, variantId, versionId);

  const rows = await db
    .select({ id: proposalPages.id })
    .from(proposalPages)
    .where(eq(proposalPages.versionId, versionId));
  const existingIds = new Set(rows.map((r) => r.id));
  if (
    orderedPageIds.length !== existingIds.size ||
    !orderedPageIds.every((pid) => existingIds.has(pid))
  ) {
    throw new Error("BAD_REORDER");
  }

  await db.transaction(async (tx) => {
    // 2단계 갱신: 음수로 잠시 대피시켜 unique(versionId, pageOrder) 충돌을 피한다.
    for (let i = 0; i < orderedPageIds.length; i++) {
      await tx
        .update(proposalPages)
        .set({ pageOrder: -(i + 1) })
        .where(eq(proposalPages.id, orderedPageIds[i]));
    }
    for (let i = 0; i < orderedPageIds.length; i++) {
      await tx
        .update(proposalPages)
        .set({ pageOrder: i })
        .where(eq(proposalPages.id, orderedPageIds[i]));
    }
  });
  await db.update(proposals).set({ updatedAt: new Date() }).where(eq(proposals.id, id));
}
