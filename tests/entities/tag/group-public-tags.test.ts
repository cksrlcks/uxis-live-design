import { describe, it, expect } from "vitest";
import { groupPublicTags, type PublicTagRow } from "@/entities/tag/lib/group-public-tags";

const row = (proposalId: string, code: string): PublicTagRow => ({
  proposalId,
  group: "industry",
  groupLabel: "산업",
  code,
  label: code.toUpperCase(),
});

describe("groupPublicTags", () => {
  it("빈 입력은 빈 Map", () => {
    expect(groupPublicTags([]).size).toBe(0);
  });
  it("같은 시안의 행을 한 키로 입력 순서대로 묶는다", () => {
    const m = groupPublicTags([row("p1", "fintech"), row("p1", "edu")]);
    expect(m.get("p1")).toEqual([
      { group: "industry", groupLabel: "산업", code: "fintech", label: "FINTECH" },
      { group: "industry", groupLabel: "산업", code: "edu", label: "EDU" },
    ]);
  });
  it("서로 다른 시안은 다른 키", () => {
    const m = groupPublicTags([row("p1", "fintech"), row("p2", "edu")]);
    expect(m.size).toBe(2);
    expect(m.get("p1")).toHaveLength(1);
    expect(m.get("p2")).toHaveLength(1);
  });
});
