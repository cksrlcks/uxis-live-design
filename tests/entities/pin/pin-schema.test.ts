import { describe, it, expect } from "vitest";
import {
  pinBodySchema,
  createPinInputSchema,
  patchPinInputSchema,
  MAX_PIN_BODY,
} from "@/entities/pin";

describe("pinBodySchema", () => {
  it("trims and accepts 1..MAX", () => {
    expect(pinBodySchema.parse("  hi  ")).toBe("hi");
    expect(pinBodySchema.parse("a".repeat(MAX_PIN_BODY))).toHaveLength(MAX_PIN_BODY);
  });
  it("rejects empty / whitespace-only / too long", () => {
    expect(pinBodySchema.safeParse("   ").success).toBe(false);
    expect(pinBodySchema.safeParse("").success).toBe(false);
    expect(pinBodySchema.safeParse("a".repeat(MAX_PIN_BODY + 1)).success).toBe(false);
  });
});

describe("createPinInputSchema", () => {
  const valid = {
    variantId: "var-1",
    versionId: "ver-1",
    pageOrder: 0,
    xNorm: 0.5,
    yNorm: 0.5,
    authorColor: "#ff0000",
    body: "hello",
  };

  it("accepts a valid payload", () => {
    expect(createPinInputSchema.parse(valid)).toEqual(valid);
  });
  it("rejects negative pageOrder", () => {
    expect(createPinInputSchema.safeParse({ ...valid, pageOrder: -1 }).success).toBe(false);
  });
  it("rejects empty body", () => {
    expect(createPinInputSchema.safeParse({ ...valid, body: "" }).success).toBe(false);
  });
  it("rejects over-32 authorColor", () => {
    expect(createPinInputSchema.safeParse({ ...valid, authorColor: "a".repeat(33) }).success).toBe(
      false,
    );
  });
  it("rejects empty variantId or versionId", () => {
    expect(createPinInputSchema.safeParse({ ...valid, variantId: "" }).success).toBe(false);
    expect(createPinInputSchema.safeParse({ ...valid, versionId: "" }).success).toBe(false);
  });
});

describe("patchPinInputSchema", () => {
  it("accepts { body } alone", () => {
    expect(patchPinInputSchema.safeParse({ body: "updated" }).success).toBe(true);
  });
  it("accepts { resolved } alone", () => {
    expect(patchPinInputSchema.safeParse({ resolved: true }).success).toBe(true);
    expect(patchPinInputSchema.safeParse({ resolved: false }).success).toBe(true);
  });
  it("rejects empty object {}", () => {
    expect(patchPinInputSchema.safeParse({}).success).toBe(false);
  });
  it("rejects { body, resolved } together (XOR)", () => {
    expect(patchPinInputSchema.safeParse({ body: "hi", resolved: true }).success).toBe(false);
  });
  it("rejects { resolved, extra } (strict)", () => {
    expect(patchPinInputSchema.safeParse({ resolved: true, extra: 1 }).success).toBe(false);
  });
});
