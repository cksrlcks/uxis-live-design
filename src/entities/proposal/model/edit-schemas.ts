import { z } from "zod";
import { domainSchema } from "./create-schema";

export const updateSettingsSchema = z
  .object({
    title: z.string().trim().min(1, "제목을 입력하세요").optional(),
    visibility: z.enum(["private", "public"]).optional(),
    // string (≥4) to set/change, or null to clear. Absent = unchanged.
    password: z.union([z.string().min(4, "비밀번호는 4자 이상이어야 합니다"), z.null()]).optional(),
    // 슬러그 to set/change, or null to clear. Absent = unchanged.
    domain: z.union([domainSchema, z.null()]).optional(),
    whiteboardEnabled: z.boolean().optional(),
    // 참여자 명단(자유 문자열). 문자열로 설정/변경, null로 해제. Absent = unchanged.
    participants: z.union([z.string().trim(), z.null()]).optional(),
  })
  .refine(
    (v) =>
      v.title !== undefined ||
      v.visibility !== undefined ||
      v.password !== undefined ||
      v.domain !== undefined ||
      v.whiteboardEnabled !== undefined ||
      v.participants !== undefined,
    { message: "변경할 항목이 없습니다" },
  );
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;

export const updateVariantSchema = z
  .object({
    label: z.string().trim().min(1, "이름을 입력하세요").optional(),
    sortOrder: z.number().int().optional(),
  })
  .refine((v) => v.label !== undefined || v.sortOrder !== undefined, {
    message: "변경할 항목이 없습니다",
  });
export type UpdateVariantInput = z.infer<typeof updateVariantSchema>;

export const restoreSchema = z.object({
  versionId: z.string().min(1, "versionId가 필요합니다"),
});
export type RestoreInput = z.infer<typeof restoreSchema>;
