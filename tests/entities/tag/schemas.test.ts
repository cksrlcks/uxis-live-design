import { describe, it, expect } from "vitest";
import {
  groupCreateSchema,
  optionCreateSchema,
  proposalTagsSchema,
} from "@/entities/tag/model/schemas";

describe("tag schemas", () => {
  it("groupCreateSchema: code/label 필수", () => {
    expect(groupCreateSchema.safeParse({ code: "purpose", label: "목적" }).success).toBe(true);
    expect(groupCreateSchema.safeParse({ label: "목적" }).success).toBe(false);
    expect(groupCreateSchema.safeParse({ code: "purpose", label: "" }).success).toBe(false);
  });
  it("optionCreateSchema: groupId는 uuid", () => {
    const ok = optionCreateSchema.safeParse({
      groupId: "00000000-0000-0000-0000-000000000000",
      code: "proposal",
      label: "제안",
    });
    expect(ok.success).toBe(true);
    expect(optionCreateSchema.safeParse({ groupId: "nope", code: "x", label: "y" }).success).toBe(false);
  });
  it("proposalTagsSchema: optionIds는 uuid 배열", () => {
    expect(proposalTagsSchema.safeParse({ optionIds: [] }).success).toBe(true);
    expect(
      proposalTagsSchema.safeParse({ optionIds: ["00000000-0000-0000-0000-000000000000"] }).success,
    ).toBe(true);
    expect(proposalTagsSchema.safeParse({ optionIds: ["bad"] }).success).toBe(false);
  });
});
