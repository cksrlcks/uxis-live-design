import { describe, it, expect } from "vitest";
import { generatePublicId, PUBLIC_ID_LENGTH, PUBLIC_ID_ALPHABET } from "@/lib/proposals/public-id";

describe("generatePublicId", () => {
  it("returns a string of the configured length", () => {
    expect(generatePublicId()).toHaveLength(PUBLIC_ID_LENGTH);
  });
  it("uses only the unambiguous alphabet", () => {
    const re = new RegExp(`^[${PUBLIC_ID_ALPHABET}]+$`);
    for (let i = 0; i < 200; i++) expect(generatePublicId()).toMatch(re);
  });
  it("excludes ambiguous characters 0/1/o/i/l", () => {
    expect(PUBLIC_ID_ALPHABET).not.toMatch(/[01oil]/);
  });
  it("produces varied output", () => {
    const set = new Set(Array.from({ length: 50 }, () => generatePublicId()));
    expect(set.size).toBeGreaterThan(1);
  });
});
