import { describe, it, expect } from "vitest";
import { tagGroups, tagOptions, proposalTags } from "@drizzle/schema";

describe("tag schema columns", () => {
  it("tag_groups: code/label/sort_order 컬럼", () => {
    expect(tagGroups.code.name).toBe("code");
    expect(tagGroups.label.name).toBe("label");
    expect(tagGroups.sortOrder.name).toBe("sort_order");
  });
  it("tag_options: group_id/code 컬럼", () => {
    expect(tagOptions.groupId.name).toBe("group_id");
    expect(tagOptions.code.name).toBe("code");
  });
  it("proposal_tags: proposal_id/option_id 컬럼", () => {
    expect(proposalTags.proposalId.name).toBe("proposal_id");
    expect(proposalTags.optionId.name).toBe("option_id");
  });
});
