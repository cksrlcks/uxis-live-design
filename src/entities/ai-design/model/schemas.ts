import { z } from "zod";
import { PAGE_TYPES, AI_MODEL_VALUES, AI_DESIGN_MODEL, type AiModelValue } from "./constants";

export const createAiDesignSchema = z.object({
  title: z.string().trim().min(1, "제목을 입력하세요").max(100),
  company: z.string().trim().max(100).nullable().optional(),
  pageType: z.enum(PAGE_TYPES),
  optionIds: z.array(z.uuid()).max(50).default([]),
  extraNotes: z.string().trim().max(2000).nullable().optional(),
  // 화이트리스트 모델만 허용. 미지정 시 환경 기본 모델 사용.
  model: z
    .string()
    .refine((v) => AI_MODEL_VALUES.includes(v as AiModelValue), "지원하지 않는 모델입니다")
    .default(AI_DESIGN_MODEL),
});

export type CreateAiDesignInput = z.infer<typeof createAiDesignSchema>;
