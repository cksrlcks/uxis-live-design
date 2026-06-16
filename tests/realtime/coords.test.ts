import { describe, it, expect } from "vitest";
import { clamp01, toNorm, fromNorm } from "@/lib/realtime/coords";

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
