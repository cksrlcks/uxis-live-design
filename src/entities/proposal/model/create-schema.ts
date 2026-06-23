import { z } from "zod";
import { ALLOWED_IMAGE_TYPES, MAX_PAGE_BYTES } from "@/shared/lib/proposals/constants";

const MAX_MB = Math.round(MAX_PAGE_BYTES / (1024 * 1024));

export const titleSchema = z.string().trim().min(1, "제목을 입력하세요");

// 공개 URL 식별자(슬러그): 소문자/숫자/하이픈, 하이픈으로 시작·끝 금지, 3~63자.
export const domainSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "도메인은 3자 이상이어야 합니다")
  .max(63, "도메인은 63자 이하여야 합니다")
  .regex(
    /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/,
    "소문자·숫자·하이픈만 사용할 수 있으며 하이픈으로 시작하거나 끝날 수 없습니다",
  );

// Figma 링크: 유효한 URL이며 figma.com 도메인이어야 한다.
export const figmaUrlSchema = z
  .string()
  .trim()
  .url("올바른 URL을 입력하세요")
  .refine((u) => {
    try {
      return new URL(u).hostname.endsWith("figma.com");
    } catch {
      return false;
    }
  }, "figma.com 링크를 입력하세요");

export const fileMetaSchema = z.object({
  contentType: z
    .string()
    .refine((t) => ALLOWED_IMAGE_TYPES.includes(t), "지원하지 않는 이미지 형식입니다"),
  size: z.number().int().positive().max(MAX_PAGE_BYTES, `파일이 너무 큽니다 (최대 ${MAX_MB}MB)`),
});

export const createProposalSchema = z.object({
  title: titleSchema,
  // 이름만으로 생성 가능 — 이미지는 생성 후 '새 버전'에서 추가한다.
  // 공개 도메인은 생성 후 상세 설정에서 지정한다(domainSchema 재사용).
  files: z.array(fileMetaSchema).default([]),
});

export type CreateProposalInput = z.infer<typeof createProposalSchema>;
