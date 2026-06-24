import { z } from "zod";
import { PAGE_TYPES } from "./constants";

export const createAiDesignSchema = z.object({
  title: z.string().trim().min(1, "제목을 입력하세요").max(100),
  company: z.string().trim().max(100).nullable().optional(),
  pageType: z.enum(PAGE_TYPES),
  optionIds: z.array(z.uuid()).max(50).default([]),
  extraNotes: z.string().trim().max(2000).nullable().optional(),
});

export type CreateAiDesignInput = z.infer<typeof createAiDesignSchema>;
