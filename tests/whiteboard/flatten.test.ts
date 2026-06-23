import { describe, expect, it } from "vitest";
import { flattenLayers, type LayerRow } from "@/entities/whiteboard/api/flatten";

describe("flattenLayers", () => {
  it("각 획에 row의 작성자 신원과 updatedAt(ISO)을 부여한다", () => {
    const rows: LayerRow[] = [
      {
        variantId: "v1",
        versionId: "ver1",
        pageOrder: 0,
        authorId: "u1",
        authorName: "Kim",
        authorColor: "#111",
        strokes: [
          { drawId: "d1", points: [{ x: 0, y: 0 }, { x: 1, y: 1 }], color: "#f00", width: 0.004 },
          { drawId: "d2", points: [{ x: 0, y: 0 }, { x: 0.5, y: 0.5 }], color: "#00f", width: 0.002 },
        ],
        updatedAt: new Date("2026-06-23T00:00:00.000Z"),
      },
    ];
    const out = flattenLayers(rows);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({
      id: "d1",
      authorId: "u1",
      authorName: "Kim",
      authorColor: "#111",
      pageOrder: 0,
      color: "#f00",
      createdAt: "2026-06-23T00:00:00.000Z",
    });
    expect(out[1]).toMatchObject({ id: "d2", color: "#00f", width: 0.002 });
  });

  it("빈 레이어는 건너뛰고 여러 row를 합친다", () => {
    const rows: LayerRow[] = [
      {
        variantId: "v1", versionId: "ver1", pageOrder: 0,
        authorId: "u1", authorName: "A", authorColor: "#1",
        strokes: [],
        updatedAt: new Date(0),
      },
      {
        variantId: "v1", versionId: "ver1", pageOrder: 1,
        authorId: "u2", authorName: "B", authorColor: "#2",
        strokes: [{ drawId: "x", points: [{ x: 0, y: 0 }, { x: 1, y: 0 }], color: "#000", width: 0.004 }],
        updatedAt: new Date(0),
      },
    ];
    const out = flattenLayers(rows);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ id: "x", authorId: "u2", pageOrder: 1 });
  });
});
