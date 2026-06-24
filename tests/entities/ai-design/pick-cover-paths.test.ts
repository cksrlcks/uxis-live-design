import { describe, it, expect } from "vitest";
import { pickCoverPaths } from "@/entities/ai-design/lib/pick-cover-paths";

describe("pickCoverPaths", () => {
  const matched = [
    { proposalId: "p1", matches: 3 },
    { proposalId: "p2", matches: 1 },
  ];
  const variants = [
    { proposalId: "p1", currentVersionId: "v1", sortOrder: 0 },
    { proposalId: "p1", currentVersionId: "v2", sortOrder: 1 },
    { proposalId: "p2", currentVersionId: null, sortOrder: 0 },
  ];
  const pages = [
    { versionId: "v1", storagePath: "p1/v1/a.png", pageOrder: 1 },
    { versionId: "v1", storagePath: "p1/v1/b.png", pageOrder: 0 },
  ];

  it("매칭수 순서를 보존하고 각 시안의 첫 안의 첫 페이지(pageOrder 최소)를 고른다", () => {
    expect(pickCoverPaths(matched, variants, pages)).toEqual([{ proposalId: "p1", storagePath: "p1/v1/b.png" }]);
    // p2는 currentVersionId 없음 → 제외
  });

  it("후보가 없으면 빈 배열", () => {
    expect(pickCoverPaths([], [], [])).toEqual([]);
  });
});
