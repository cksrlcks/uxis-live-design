import { z } from "zod";

const label = z.string().trim().min(1, "이름을 입력하세요").max(100);
const code = z.string().trim().min(1, "코드를 입력하세요").max(50);
const description = z.string().trim().max(500).nullable().optional();
const sortOrder = z.number().int().optional();

export const groupCreateSchema = z.object({ code, label, description, sortOrder });
export const groupUpdateSchema = z
  .object({
    label: label.optional(),
    description,
    sortOrder,
  })
  .refine((v) => v.label !== undefined || v.description !== undefined || v.sortOrder !== undefined, {
    message: "변경할 항목이 없습니다",
  });

export const optionCreateSchema = z.object({
  groupId: z.uuid(),
  code,
  label,
  description,
  sortOrder,
});
export const optionUpdateSchema = z
  .object({
    label: label.optional(),
    description,
    sortOrder,
  })
  .refine((v) => v.label !== undefined || v.description !== undefined || v.sortOrder !== undefined, {
    message: "변경할 항목이 없습니다",
  });

export const proposalTagsSchema = z.object({
  optionIds: z.array(z.uuid()),
});

export type GroupCreateInput = z.infer<typeof groupCreateSchema>;
export type GroupUpdateInput = z.infer<typeof groupUpdateSchema>;
export type OptionCreateInput = z.infer<typeof optionCreateSchema>;
export type OptionUpdateInput = z.infer<typeof optionUpdateSchema>;
export type ProposalTagsInput = z.infer<typeof proposalTagsSchema>;
