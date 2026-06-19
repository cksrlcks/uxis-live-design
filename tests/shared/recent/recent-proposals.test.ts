import { describe, it, expect } from "vitest";
import { upsertRecent, parseRecent, type RecentProposal } from "@/shared/recent/recent-proposals";

const mk = (publicId: string, viewedAt: number): RecentProposal => ({
  publicId,
  title: `T-${publicId}`,
  viewedAt,
});

describe("upsertRecent", () => {
  it("prepends a new entry", () => {
    const out = upsertRecent([mk("a", 1)], mk("b", 2));
    expect(out.map((r) => r.publicId)).toEqual(["b", "a"]);
  });
  it("dedupes by publicId, moving it to the front with new data", () => {
    const out = upsertRecent([mk("a", 1), mk("b", 2)], mk("a", 3));
    expect(out.map((r) => r.publicId)).toEqual(["a", "b"]);
    expect(out[0].viewedAt).toBe(3);
  });
  it("caps the list at max (default keeps most recent)", () => {
    const prev = Array.from({ length: 20 }, (_, i) => mk(`p${i}`, i));
    const out = upsertRecent(prev, mk("new", 99));
    expect(out.length).toBe(20);
    expect(out[0].publicId).toBe("new");
    expect(out.some((r) => r.publicId === "p19")).toBe(false); // oldest dropped
  });
  it("respects a custom max", () => {
    const out = upsertRecent([mk("a", 1), mk("b", 2)], mk("c", 3), 2);
    expect(out.map((r) => r.publicId)).toEqual(["c", "a"]);
  });
});

describe("parseRecent", () => {
  it("returns [] for null / invalid JSON", () => {
    expect(parseRecent(null)).toEqual([]);
    expect(parseRecent("not json")).toEqual([]);
    expect(parseRecent("{}")).toEqual([]);
  });
  it("filters out malformed entries", () => {
    const raw = JSON.stringify([
      { publicId: "a", title: "A", viewedAt: 1 },
      { publicId: "", title: "x", viewedAt: 2 },
      { publicId: "b", title: 5, viewedAt: 3 },
      { publicId: "c", title: "C", viewedAt: "nope" },
      { publicId: "d", title: "D", viewedAt: 4 },
    ]);
    expect(parseRecent(raw).map((r) => r.publicId)).toEqual(["a", "d"]);
  });
});
