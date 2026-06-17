import { describe, it, expect } from "vitest";
import { clamp01, toNorm, fromNorm, toContent } from "@/legacy/lib/realtime/coords";

describe("clamp01", () => {
  it("clamps below 0 and above 1", () => {
    expect(clamp01(-0.5)).toBe(0);
    expect(clamp01(1.5)).toBe(1);
    expect(clamp01(0.3)).toBe(0.3);
  });
});

describe("toNorm", () => {
  it("maps a pixel within [start, start+size] to 0..1", () => {
    expect(toNorm(50, 0, 100)).toBe(0.5);
    expect(toNorm(100, 100, 200)).toBe(0);
    expect(toNorm(300, 100, 200)).toBe(1);
  });
  it("clamps out-of-range pixels", () => {
    expect(toNorm(-10, 0, 100)).toBe(0);
    expect(toNorm(150, 0, 100)).toBe(1);
  });
  it("returns 0 when size is non-positive", () => {
    expect(toNorm(50, 0, 0)).toBe(0);
  });
});

describe("fromNorm", () => {
  it("is the inverse of toNorm within range", () => {
    expect(fromNorm(0.5, 0, 100)).toBe(50);
    expect(fromNorm(toNorm(120, 100, 200), 100, 200)).toBe(120);
  });
  it("clamps the normalized input", () => {
    expect(fromNorm(2, 0, 100)).toBe(100);
  });
});

describe("toContent", () => {
  it("subtracts the content origin and divides by scale", () => {
    expect(toContent(150, 80, { left: 50, top: 20 }, 1)).toEqual({ cx: 100, cy: 60 });
    expect(toContent(150, 80, { left: 50, top: 20 }, 2)).toEqual({ cx: 50, cy: 30 });
  });
  it("round-trips with the screen projection cx*scale+left", () => {
    const rect = { left: 12, top: 34 };
    const scale = 0.2;
    const { cx, cy } = toContent(200, 100, rect, scale);
    expect(cx * scale + rect.left).toBeCloseTo(200);
    expect(cy * scale + rect.top).toBeCloseTo(100);
  });
  it("returns origin when scale is non-positive", () => {
    expect(toContent(10, 10, { left: 0, top: 0 }, 0)).toEqual({ cx: 0, cy: 0 });
  });
});
