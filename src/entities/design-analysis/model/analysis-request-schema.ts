import { z } from "zod";

// 대기목록 조회 요청. reanalyze면 proposalId(uuid) 필수.
export const pendingRequestSchema = z
  .object({
    mode: z.enum(["pending", "reanalyze"]),
    proposalId: z.uuid().optional(),
    limit: z.number().int().positive().max(500).optional(),
    onlyExposed: z.boolean().optional(),
  })
  .refine((v) => v.mode !== "reanalyze" || !!v.proposalId, {
    message: "reanalyze mode requires proposalId",
    path: ["proposalId"],
  });
export type PendingRequest = z.infer<typeof pendingRequestSchema>;

// 분석 저장 요청(배치). overall/sections는 서버에서 parsePageAnalysis로 관대하게 검증한다.
export const saveRequestSchema = z.object({
  model: z.string().trim().min(1).default("claude-code"),
  analyses: z
    .array(
      z.object({
        pageId: z.uuid(),
        overall: z.unknown(),
        sections: z.unknown(),
      }),
    )
    .min(1)
    .max(200),
});
export type SaveRequest = z.infer<typeof saveRequestSchema>;
