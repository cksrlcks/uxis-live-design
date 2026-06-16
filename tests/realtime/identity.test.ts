import { describe, it, expect } from "vitest";
import { IDENTITY_COLORS, pickColor, defaultGuestName, parseProfile } from "@/lib/realtime/identity";

describe("pickColor", () => {
  it("returns a palette color", () => {
    for (let i = 0; i < 20; i++) expect(IDENTITY_COLORS).toContain(pickColor(i));
  });
  it("is deterministic for the same seed", () => {
    expect(pickColor(7)).toBe(pickColor(7));
  });
});

describe("defaultGuestName", () => {
  it("formats as 'Guest NNNN'", () => {
    expect(defaultGuestName(0)).toMatch(/^Guest \d{4}$/);
  });
});

describe("parseProfile", () => {
  it("accepts a well-formed profile", () => {
    expect(parseProfile(JSON.stringify({ name: "Bob", color: "#ef4444" }))).toEqual({ name: "Bob", color: "#ef4444" });
  });
  it("rejects malformed JSON or missing fields", () => {
    expect(parseProfile("not json")).toBeNull();
    expect(parseProfile(JSON.stringify({ name: "Bob" }))).toBeNull();
    expect(parseProfile(JSON.stringify({ name: "", color: "#fff" }))).toBeNull();
  });
});
