import { describe, it, expect } from "vitest";
import { clampListParams } from "@/entities/proposal/lib/public-list-params";

describe("clampListParams", () => {
  it("정상값은 그대로", () => {
    expect(clampListParams(1, 20)).toEqual({ page: 1, pageSize: 20 });
    expect(clampListParams(3, 50)).toEqual({ page: 3, pageSize: 50 });
  });
  it("page<1은 1로 보정", () => {
    expect(clampListParams(0, 20)).toEqual({ page: 1, pageSize: 20 });
    expect(clampListParams(-5, 20)).toEqual({ page: 1, pageSize: 20 });
  });
  it("pageSize는 1~100 클램프", () => {
    expect(clampListParams(2, 0)).toEqual({ page: 2, pageSize: 1 });
    expect(clampListParams(2, -3)).toEqual({ page: 2, pageSize: 1 });
    expect(clampListParams(2, 1000)).toEqual({ page: 2, pageSize: 100 });
  });
  it("소수는 버림", () => {
    expect(clampListParams(2.7, 20.9)).toEqual({ page: 2, pageSize: 20 });
  });
  it("NaN/비유한은 기본값으로 떨어진다", () => {
    // Number.isFinite(NaN/Infinity) === false → page=1, pageSize=20 기본값 적용 후 클램프.
    expect(clampListParams(NaN, NaN)).toEqual({ page: 1, pageSize: 20 });
    expect(clampListParams(Infinity, Infinity)).toEqual({ page: 1, pageSize: 20 });
  });
});
