import { describe, it, expect } from "vitest";
import { computeFitScale } from "@/widgets/preview-canvas/lib/fit-zoom";

describe("computeFitScale (캔버스 첫 진입 fit-to-view)", () => {
  it("가로로 넓은 strip은 가로 기준으로 줄인다", () => {
    // width fit 1000/4000=0.25, height fit 800/1000=0.8 → 더 빡빡한 0.25
    expect(
      computeFitScale({
        contentWidth: 4000,
        contentHeight: 1000,
        viewportWidth: 1000,
        viewportHeight: 800,
        margin: 1,
        minScale: 0.01,
        maxScale: 10,
      }),
    ).toBeCloseTo(0.25);
  });

  it("세로로 긴 콘텐츠는 세로 기준으로 줄여 상단이 잘리지 않게 한다", () => {
    // width fit 1000/1000=1, height fit 800/4000=0.2 → 0.2
    expect(
      computeFitScale({
        contentWidth: 1000,
        contentHeight: 4000,
        viewportWidth: 1000,
        viewportHeight: 800,
        margin: 1,
        minScale: 0.01,
        maxScale: 10,
      }),
    ).toBeCloseTo(0.2);
  });

  it("여백(margin)만큼 배율을 더 줄인다", () => {
    // 0.25 * 0.9 = 0.225
    expect(
      computeFitScale({
        contentWidth: 4000,
        contentHeight: 1000,
        viewportWidth: 1000,
        viewportHeight: 800,
        margin: 0.9,
        minScale: 0.01,
        maxScale: 10,
      }),
    ).toBeCloseTo(0.225);
  });

  it("계산값이 minScale보다 작으면 minScale로 고정한다", () => {
    expect(
      computeFitScale({
        contentWidth: 100000,
        contentHeight: 1000,
        viewportWidth: 1000,
        viewportHeight: 800,
        minScale: 0.1,
        maxScale: 1,
      }),
    ).toBe(0.1);
  });

  it("작은 콘텐츠도 maxScale(기본 1)을 넘겨 확대하지 않는다", () => {
    // 100x100을 1000x800에 맞추면 7배지만, 100% 이상으로는 키우지 않는다
    expect(
      computeFitScale({
        contentWidth: 100,
        contentHeight: 100,
        viewportWidth: 1000,
        viewportHeight: 800,
      }),
    ).toBe(1);
  });

  it("측정 불가(0)일 때는 minScale로 안전하게 반환한다", () => {
    expect(
      computeFitScale({
        contentWidth: 0,
        contentHeight: 0,
        viewportWidth: 1000,
        viewportHeight: 800,
        minScale: 0.1,
        maxScale: 1,
      }),
    ).toBe(0.1);
  });
});
