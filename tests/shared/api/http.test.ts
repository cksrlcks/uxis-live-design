import { describe, it, expect, vi, afterEach } from "vitest";
import { http, HttpError } from "@/shared/api/http";

afterEach(() => vi.restoreAllMocks());

describe("http", () => {
  it("returns parsed JSON on ok", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ id: 1 }), { status: 200 })));
    await expect(http<{ id: number }>("/x")).resolves.toEqual({ id: 1 });
  });

  it("returns undefined on 204", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 204 })));
    await expect(http("/x")).resolves.toBeUndefined();
  });

  it("throws HttpError with status and server code on error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "FORBIDDEN" }), { status: 403 })));
    await expect(http("/x")).rejects.toMatchObject({ status: 403, code: "FORBIDDEN" });
    await expect(http("/x")).rejects.toBeInstanceOf(HttpError);
  });
});
