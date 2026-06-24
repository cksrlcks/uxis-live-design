import { describe, it, expect } from "vitest";
import {
  groupCreateSchema,
  groupUpdateSchema,
  optionCreateSchema,
  optionUpdateSchema,
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
  it("groupUpdateSchema: 빈 body({}) 거부", () => {
    expect(groupUpdateSchema.safeParse({}).success).toBe(false);
  });
  it("groupUpdateSchema: 하나 이상 필드 있으면 허용", () => {
    expect(groupUpdateSchema.safeParse({ label: "x" }).success).toBe(true);
  });
  it("optionUpdateSchema: 빈 body({}) 거부", () => {
    expect(optionUpdateSchema.safeParse({}).success).toBe(false);
  });
  it("optionUpdateSchema: description:null은 변경으로 인정", () => {
    expect(optionUpdateSchema.safeParse({ description: null }).success).toBe(true);
  });

  it("proposalTagsSchema: optionIds는 uuid 배열", () => {
    expect(proposalTagsSchema.safeParse({ optionIds: [] }).success).toBe(true);
    expect(
      proposalTagsSchema.safeParse({ optionIds: ["00000000-0000-0000-0000-000000000000"] }).success,
    ).toBe(true);
    expect(proposalTagsSchema.safeParse({ optionIds: ["bad"] }).success).toBe(false);
  });
});
