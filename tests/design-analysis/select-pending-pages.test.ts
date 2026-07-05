import { describe, it, expect } from "vitest";
import { selectPendingPages } from "@/entities/design-analysis/lib/select-pending-pages";
import type { PendingPage } from "@/entities/design-analysis/model/types";

function page(pageId: string, proposalId: string): PendingPage {
  return {
    pageId,
    proposalId,
    versionId: `v-${pageId}`,
    storagePath: `path/${pageId}.png`,
    proposalTitle: `T-${proposalId}`,
  };
}

describe("selectPendingPages", () => {
  const candidates = [page("a", "P1"), page("b", "P1"), page("c", "P2")];

  it("기본(force=false): analyzed 페이지는 제외한다", () => {
    const r = selectPendingPages(candidates, new Set(["a"]), { limit: 100 });
    expect(r.map((x) => x.pageId)).toEqual(["b", "c"]);
  });

  it("force=true: analyzed 페이지도 포함한다(재분석)", () => {
    const r = selectPendingPages(candidates, new Set(["a", "b", "c"]), { limit: 100, force: true });
    expect(r.map((x) => x.pageId)).toEqual(["a", "b", "c"]);
  });

  it("proposalId: 해당 시안 페이지만 대상으로 한다", () => {
    const r = selectPendingPages(candidates, new Set(), { limit: 100, proposalId: "P1" });
    expect(r.map((x) => x.pageId)).toEqual(["a", "b"]);
  });

  it("proposalId + force: 그 시안의 analyzed 페이지도 재분석 대상", () => {
    const r = selectPendingPages(candidates, new Set(["a", "b", "c"]), {
      limit: 100,
      proposalId: "P1",
      force: true,
    });
    expect(r.map((x) => x.pageId)).toEqual(["a", "b"]);
  });

  it("limit: 도달하면 중단한다", () => {
    const r = selectPendingPages(candidates, new Set(), { limit: 2 });
    expect(r).toHaveLength(2);
  });
});
