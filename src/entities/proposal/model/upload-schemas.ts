import { z } from "zod";
import { fileMetaSchema } from "./create-schema";

// 빈 안 생성을 허용한다 — 안을 먼저 만들고 이미지는 카드 그리드에서 추가/교체한다.
export const createVariantSchema = z.object({
  files: z.array(fileMetaSchema).default([]),
});
export type CreateVariantInput = z.infer<typeof createVariantSchema>;

// 기존 안에 이미지를 덧붙이기 위한 업로드 URL 요청 (append).
export const requestPageUploadsSchema = z.object({
  files: z.array(fileMetaSchema).min(1, "이미지를 1개 이상 선택하세요"),
});
export type RequestPageUploadsInput = z.infer<typeof requestPageUploadsSchema>;

// 단일 페이지 이미지 교체 업로드 URL 요청.
export const replacePageUploadSchema = fileMetaSchema;
export type ReplacePageUploadInput = z.infer<typeof replacePageUploadSchema>;

// 교체 업로드 완료 확인 (객체 업로드 후 메타 반영).
export const confirmReplacePageSchema = z.object({
  path: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});
export type ConfirmReplacePageInput = z.infer<typeof confirmReplacePageSchema>;

// 페이지 순서 재정렬 — 새 순서대로 나열한 pageId 배열.
export const reorderPagesSchema = z.object({
  orderedPageIds: z.array(z.string().min(1)).min(1),
});
export type ReorderPagesInput = z.infer<typeof reorderPagesSchema>;

// 새 버전은 빈 상태로 만든다 — 이미지는 카드 그리드에서 추가/교체한다.
export const createVersionSchema = z.object({
  note: z.string().trim().optional(),
});
export type CreateVersionInput = z.infer<typeof createVersionSchema>;

const pageInputSchema = z.object({
  pageId: z.string().min(1),
  pageOrder: z.number().int().nonnegative(),
  path: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

export const confirmPagesSchema = z.object({
  pages: z.array(pageInputSchema).min(1, "페이지가 없습니다"),
});
export type ConfirmPagesInput = z.infer<typeof confirmPagesSchema>;
