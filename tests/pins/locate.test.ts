import { describe, it, expect } from "vitest";
import { locatePin, placePin, locateArea, placeArea } from "@/widgets/preview-canvas/lib/locate";

const boxes = [
  { left: 0, top: 0, width: 100, height: 200, pageOrder: 0 },
  { left: 150, top: 0, width: 100, height: 200, pageOrder: 1 },
];

describe("locatePin", () => {
  it("locates a point inside a page and normalizes within it", () => {
    expect(locatePin(50, 100, boxes)).toEqual({ pageOrder: 0, xNorm: 0.5, yNorm: 0.5 });
    expect(locatePin(200, 50, boxes)).toEqual({ pageOrder: 1, xNorm: 0.5, yNorm: 0.25 });
  });
  it("falls back to the nearest page outside all boxes (norms may exceed 0..1)", () => {
    // x=125 사이 간격: page0 오른쪽 끝(100)·page1 왼쪽 끝(150)까지 동률 → 먼저 발견된 page0.
    expect(locatePin(125, 100, boxes)).toEqual({ pageOrder: 0, xNorm: 1.25, yNorm: 0.5 });
    expect(locatePin(-10, 100, boxes)).toEqual({ pageOrder: 0, xNorm: -0.1, yNorm: 0.5 });
  });
  it("clamps norms on the exact edge", () => {
    expect(locatePin(100, 200, boxes)).toEqual({ pageOrder: 0, xNorm: 1, yNorm: 1 });
  });
  it("returns null only when there are no valid boxes", () => {
    expect(locatePin(0, 0, [{ left: 0, top: 0, width: 0, height: 0, pageOrder: 9 }])).toBeNull();
  });
});

describe("placePin", () => {
  it("maps a normalized point back to content coords within the box", () => {
    expect(placePin(boxes[0], 0.5, 0.5)).toEqual({ x: 50, y: 100 });
    expect(placePin(boxes[1], 0, 1)).toEqual({ x: 150, y: 200 });
  });
});

describe("locateArea", () => {
  it("normalizes a drag rectangle to the start page (top-left + size)", () => {
    // (20,40)→(60,140) inside page0: left=20,top=40,w=40,h=100
    expect(locateArea(20, 40, 60, 140, boxes)).toEqual({
      pageOrder: 0,
      xNorm: 0.2,
      yNorm: 0.2,
      wNorm: 0.4,
      hNorm: 0.5,
    });
  });
  it("is direction-agnostic (bottom-right → top-left yields same box)", () => {
    expect(locateArea(60, 140, 20, 40, boxes)).toEqual({
      pageOrder: 0,
      xNorm: 0.2,
      yNorm: 0.2,
      wNorm: 0.4,
      hNorm: 0.5,
    });
  });
  it("anchors to the start point's page even if the end is elsewhere", () => {
    // 시작 (200,50) → page1, 끝 (240,150): left=200,top=50,w=40,h=100 (page1 기준)
    expect(locateArea(200, 50, 240, 150, boxes)).toEqual({
      pageOrder: 1,
      xNorm: 0.5,
      yNorm: 0.25,
      wNorm: 0.4,
      hNorm: 0.5,
    });
  });
  it("returns null with no valid boxes", () => {
    expect(locateArea(0, 0, 10, 10, [])).toBeNull();
  });
});

describe("placeArea", () => {
  it("maps a normalized area back to a content-coord rect", () => {
    expect(placeArea(boxes[0], 0.2, 0.2, 0.4, 0.5)).toEqual({
      left: 20,
      top: 40,
      width: 40,
      height: 100,
    });
  });
});
