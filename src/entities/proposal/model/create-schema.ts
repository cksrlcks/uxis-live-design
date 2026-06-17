import { z } from "zod";
import { ALLOWED_IMAGE_TYPES, MAX_PAGE_BYTES } from "@/shared/lib/proposals/constants";

export const titleSchema = z.string().trim().min(1, "제목을 입력하세요");

export const fileMetaSchema = z.object({
  contentType: z
    .string()
    .refine((t) => ALLOWED_IMAGE_TYPES.includes(t), "지원하지 않는 이미지 형식입니다"),
  size: z.number().int().positive().max(MAX_PAGE_BYTES, "파일이 너무 큽니다 (최대 25MB)"),
});

export const createProposalSchema = z.object({
  title: titleSchema,
  files: z.array(fileMetaSchema).min(1, "이미지를 1개 이상 선택하세요"),
});

export type CreateProposalInput = z.infer<typeof createProposalSchema>;
