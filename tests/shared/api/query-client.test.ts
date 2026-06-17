import { describe, it, expect } from "vitest";
import { makeQueryClient } from "@/shared/api/query-client";
import { HttpError } from "@/shared/api/http";

describe("makeQueryClient", () => {
  it("sets a 30s default staleTime", () => {
    const qc = makeQueryClient();
    expect(qc.getDefaultOptions().queries?.staleTime).toBe(30_000);
  });

  it("does not retry 4xx but retries other errors up to 2x", () => {
    const retry = makeQueryClient().getDefaultOptions().queries?.retry as (n: number, e: unknown) => boolean;
    expect(retry(0, new HttpError(404, "NOT_FOUND"))).toBe(false);
    expect(retry(0, new HttpError(500, "INTERNAL_ERROR"))).toBe(true);
    expect(retry(2, new HttpError(500, "INTERNAL_ERROR"))).toBe(false);
  });
});
