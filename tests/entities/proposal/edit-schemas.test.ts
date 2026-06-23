import { describe, it, expect } from "vitest";
import {
  updateSettingsSchema,
  updateVariantSchema,
  restoreSchema,
} from "@/entities/proposal/model/edit-schemas";

describe("updateSettingsSchema", () => {
  it("accepts a visibility-only change", () => {
    expect(updateSettingsSchema.safeParse({ visibility: "public" }).success).toBe(true);
  });
  it("accepts password: null (clear)", () => {
    expect(updateSettingsSchema.safeParse({ password: null }).success).toBe(true);
  });
  it("accepts a participants string", () => {
    expect(updateSettingsSchema.safeParse({ participants: "홍길동, 김철수" }).success).toBe(true);
  });
  it("accepts participants: null (clear)", () => {
    expect(updateSettingsSchema.safeParse({ participants: null }).success).toBe(true);
  });
  it("rejects a password under 4 chars", () => {
    expect(updateSettingsSchema.safeParse({ password: "abc" }).success).toBe(false);
  });
  it("rejects an invalid visibility", () => {
    expect(updateSettingsSchema.safeParse({ visibility: "secret" }).success).toBe(false);
  });
  it("rejects an empty object (no changes)", () => {
    expect(updateSettingsSchema.safeParse({}).success).toBe(false);
  });
});

describe("updateVariantSchema", () => {
  it("accepts a label-only change", () => {
    expect(updateVariantSchema.safeParse({ label: "A안" }).success).toBe(true);
  });
  it("accepts a sortOrder-only change", () => {
    expect(updateVariantSchema.safeParse({ sortOrder: 2 }).success).toBe(true);
  });
  it("trims and rejects an empty label", () => {
    expect(updateVariantSchema.safeParse({ label: "   " }).success).toBe(false);
  });
  it("rejects a non-integer sortOrder", () => {
    expect(updateVariantSchema.safeParse({ sortOrder: 1.5 }).success).toBe(false);
  });
  it("rejects an empty object", () => {
    expect(updateVariantSchema.safeParse({}).success).toBe(false);
  });
});

describe("restoreSchema", () => {
  it("requires a versionId", () => {
    expect(restoreSchema.safeParse({ versionId: "v1" }).success).toBe(true);
    expect(restoreSchema.safeParse({}).success).toBe(false);
  });
});
