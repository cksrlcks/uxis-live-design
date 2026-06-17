import { describe, it, expect } from "vitest";
import { IDENTITY_COLORS, pickColor, defaultGuestName, parseIdentity } from "@/legacy/lib/realtime/identity";

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

describe("parseIdentity", () => {
  it("accepts a well-formed identity", () => {
    const v = parseIdentity(JSON.stringify({ id: "a", name: "Bob", color: "#ef4444" }));
    expect(v).toEqual({ id: "a", name: "Bob", color: "#ef4444" });
  });
  it("rejects malformed JSON or missing fields", () => {
    expect(parseIdentity("not json")).toBeNull();
    expect(parseIdentity(JSON.stringify({ id: "a" }))).toBeNull();
    expect(parseIdentity(JSON.stringify({ id: "a", name: "", color: "#fff" }))).toBeNull();
  });
});
