import { describe, it, expect } from "vitest";
import { z } from "zod";
import { toErrorResponse } from "@/shared/api/to-error-response";

describe("toErrorResponse", () => {
  it("maps FORBIDDEN to 403", async () => {
    const res = toErrorResponse(new Error("FORBIDDEN"));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "FORBIDDEN" });
  });

  it("maps LOGIN_REQUIRED to 401", () => {
    expect(toErrorResponse(new Error("LOGIN_REQUIRED")).status).toBe(401);
  });

  it("maps ZodError to 400 VALIDATION_ERROR", async () => {
    const err = z.object({ title: z.string() }).safeParse({}).error!;
    const res = toErrorResponse(err);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("VALIDATION_ERROR");
  });

  it("maps unknown error to 500", () => {
    expect(toErrorResponse("boom").status).toBe(500);
  });

  it("maps INVALID_CREDENTIALS to 401", () => {
    expect(toErrorResponse(new Error("INVALID_CREDENTIALS")).status).toBe(401);
  });

  it("maps EMAIL_TAKEN to 409", () => {
    expect(toErrorResponse(new Error("EMAIL_TAKEN")).status).toBe(409);
  });

  it("maps SIGNUP_FAILED to 400", async () => {
    const res = toErrorResponse(new Error("SIGNUP_FAILED"));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("SIGNUP_FAILED");
  });

  it("maps RATE_LIMITED to 429", () => {
    expect(toErrorResponse(new Error("RATE_LIMITED")).status).toBe(429);
  });

  it("maps LAST_VARIANT to 409", () => {
    expect(toErrorResponse(new Error("LAST_VARIANT")).status).toBe(409);
  });

  it("maps OBJECT_MISSING to 400", () => {
    expect(toErrorResponse(new Error("OBJECT_MISSING")).status).toBe(400);
  });
});
