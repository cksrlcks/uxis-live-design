import { describe, it, expect } from "vitest";
import {
  createVariantSchema,
  createVersionSchema,
  confirmPagesSchema,
} from "@/entities/proposal/model/upload-schemas";

const okFile = { contentType: "image/png", size: 1000 };
const okPage = { pageId: "p1", pageOrder: 0, path: "a/b/p1.png", width: 800, height: 600 };

describe("createVariantSchema", () => {
  it("accepts ≥1 valid file", () => {
    expect(createVariantSchema.safeParse({ files: [okFile] }).success).toBe(true);
  });
  it("rejects empty files", () => {
    expect(createVariantSchema.safeParse({ files: [] }).success).toBe(false);
  });
  it("rejects a disallowed content type", () => {
    expect(
      createVariantSchema.safeParse({ files: [{ contentType: "image/gif", size: 10 }] }).success,
    ).toBe(false);
  });
});

describe("createVersionSchema", () => {
  it("accepts files with an optional note", () => {
    expect(createVersionSchema.safeParse({ files: [okFile] }).success).toBe(true);
    expect(createVersionSchema.safeParse({ note: "메모", files: [okFile] }).success).toBe(true);
  });
  it("rejects empty files", () => {
    expect(createVersionSchema.safeParse({ note: "메모", files: [] }).success).toBe(false);
  });
});

describe("confirmPagesSchema", () => {
  it("accepts ≥1 well-formed page", () => {
    expect(confirmPagesSchema.safeParse({ pages: [okPage] }).success).toBe(true);
  });
  it("rejects empty pages", () => {
    expect(confirmPagesSchema.safeParse({ pages: [] }).success).toBe(false);
  });
  it("rejects a page with a non-integer pageOrder", () => {
    expect(confirmPagesSchema.safeParse({ pages: [{ ...okPage, pageOrder: 1.5 }] }).success).toBe(
      false,
    );
  });
});
