import { describe, expect, it } from "vitest";
import { layerUpsertInputSchema, MAX_LAYER_STROKES } from "@/entities/whiteboard";

const stroke = (drawId: string) => ({
  drawId,
  points: [
    { x: 0, y: 0 },
    { x: 0.5, y: 0.5 },
  ],
  color: "#ff0000",
  width: 0.004,
});

describe("layerUpsertInputSchema", () => {
  it("유효한 레이어 입력을 통과시킨다", () => {
    const parsed = layerUpsertInputSchema.parse({
      variantId: "v1",
      versionId: "ver1",
      pageOrder: 0,
      strokes: [stroke("d1"), stroke("d2")],
      authorColor: "#3b82f6",
    });
    expect(parsed.strokes).toHaveLength(2);
  });

  it("빈 strokes 배열을 허용한다(레이어 삭제 신호)", () => {
    expect(() =>
      layerUpsertInputSchema.parse({
        variantId: "v1",
        versionId: "ver1",
        pageOrder: 0,
        strokes: [],
        authorColor: "#3b82f6",
      }),
    ).not.toThrow();
  });

  it("점이 2개 미만인 획을 거부한다", () => {
    expect(() =>
      layerUpsertInputSchema.parse({
        variantId: "v1",
        versionId: "ver1",
        pageOrder: 0,
        strokes: [{ drawId: "d1", points: [{ x: 0, y: 0 }], color: "#000", width: 0.004 }],
        authorColor: "#3b82f6",
      }),
    ).toThrow();
  });

  it("레이어당 획 수 상한을 넘으면 거부한다", () => {
    const many = Array.from({ length: MAX_LAYER_STROKES + 1 }, (_, i) => stroke(`d${i}`));
    expect(() =>
      layerUpsertInputSchema.parse({
        variantId: "v1",
        versionId: "ver1",
        pageOrder: 0,
        strokes: many,
        authorColor: "#3b82f6",
      }),
    ).toThrow();
  });
});
