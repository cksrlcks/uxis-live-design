import { describe, it, expect } from "vitest";
import { createProposalSchema } from "@/entities/proposal/model/create-schema";
import { MAX_PAGE_BYTES } from "@/shared/lib/proposals/constants";

const okFile = { contentType: "image/png", size: 1000 };

describe("createProposalSchema", () => {
  it("accepts a valid payload", () => {
    const r = createProposalSchema.safeParse({ title: "A", files: [okFile] });
    expect(r.success).toBe(true);
  });

  it("trims and rejects an empty title", () => {
    expect(createProposalSchema.safeParse({ title: "   ", files: [okFile] }).success).toBe(false);
  });

  it("requires at least one file", () => {
    expect(createProposalSchema.safeParse({ title: "A", files: [] }).success).toBe(false);
  });

  it("rejects a disallowed content type", () => {
    expect(
      createProposalSchema.safeParse({
        title: "A",
        files: [{ contentType: "image/gif", size: 10 }],
      }).success,
    ).toBe(false);
  });

  it("rejects a file over the size limit", () => {
    const huge = { contentType: "image/png", size: MAX_PAGE_BYTES + 1 };
    expect(createProposalSchema.safeParse({ title: "A", files: [huge] }).success).toBe(false);
  });

  it("accepts a file exactly at the size limit", () => {
    const atLimit = { contentType: "image/png", size: MAX_PAGE_BYTES };
    expect(createProposalSchema.safeParse({ title: "A", files: [atLimit] }).success).toBe(true);
  });
});
