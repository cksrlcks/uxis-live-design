import { describe, it, expect } from "vitest";
import { locatePin, placePin } from "@/widgets/preview-canvas/lib/locate";

const boxes = [
  { left: 0, top: 0, width: 100, height: 200, pageOrder: 0 },
  { left: 150, top: 0, width: 100, height: 200, pageOrder: 1 },
];

describe("locatePin", () => {
  it("locates a point inside a page and normalizes within it", () => {
    expect(locatePin(50, 100, boxes)).toEqual({ pageOrder: 0, xNorm: 0.5, yNorm: 0.5 });
    expect(locatePin(200, 50, boxes)).toEqual({ pageOrder: 1, xNorm: 0.5, yNorm: 0.25 });
  });
  it("returns null in the gap/padding between pages", () => {
    expect(locatePin(125, 100, boxes)).toBeNull();
  });
  it("returns null outside all pages", () => {
    expect(locatePin(-10, 100, boxes)).toBeNull();
    expect(locatePin(50, 999, boxes)).toBeNull();
  });
  it("clamps norms on the exact edge", () => {
    expect(locatePin(100, 200, boxes)).toEqual({ pageOrder: 0, xNorm: 1, yNorm: 1 });
  });
  it("ignores degenerate (zero-size) boxes", () => {
    expect(locatePin(0, 0, [{ left: 0, top: 0, width: 0, height: 0, pageOrder: 9 }])).toBeNull();
  });
});

describe("placePin", () => {
  it("maps a normalized point back to content coords within the box", () => {
    expect(placePin(boxes[0], 0.5, 0.5)).toEqual({ x: 50, y: 100 });
    expect(placePin(boxes[1], 0, 1)).toEqual({ x: 150, y: 200 });
  });
});
