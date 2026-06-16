import { describe, it, expect } from "vitest";
import { extForContentType, pagePath, ALLOWED_IMAGE_TYPES } from "@/lib/proposals/constants";

describe("proposal storage constants", () => {
  it("maps allowed content types to extensions", () => {
    expect(extForContentType("image/png")).toBe("png");
    expect(extForContentType("image/jpeg")).toBe("jpg");
    expect(extForContentType("image/webp")).toBe("webp");
  });
  it("rejects disallowed content types", () => {
    expect(extForContentType("image/gif")).toBeNull();
    expect(extForContentType("application/pdf")).toBeNull();
  });
  it("exposes the allowed type list", () => {
    expect(ALLOWED_IMAGE_TYPES).toContain("image/png");
    expect(ALLOWED_IMAGE_TYPES).toHaveLength(3);
  });
  it("builds a deterministic object path", () => {
    expect(pagePath("p1", "v1", "pg1", "png")).toBe("p1/v1/pg1.png");
  });
});
