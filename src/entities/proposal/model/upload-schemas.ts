import { z } from "zod";
import { fileMetaSchema } from "./create-schema";

export const createVariantSchema = z.object({
  files: z.array(fileMetaSchema).min(1, "이미지를 1개 이상 선택하세요"),
});
export type CreateVariantInput = z.infer<typeof createVariantSchema>;

export const createVersionSchema = z.object({
  note: z.string().trim().optional(),
  files: z.array(fileMetaSchema).min(1, "이미지를 1개 이상 선택하세요"),
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
