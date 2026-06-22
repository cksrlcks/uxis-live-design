import { describe, it, expect, beforeEach } from "vitest";
import {
  IDENTITY_COLORS,
  pickColor,
  defaultGuestName,
  parseIdentity,
  loadOrCreateIdentity,
} from "@/shared/realtime/identity";

function mockLocalStorage() {
  const store = new Map<string, string>();
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: () => null,
    length: 0,
  } as Storage;
}

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

describe("loadOrCreateIdentity", () => {
  beforeEach(() => mockLocalStorage());

  it("applies the authed name without persisting it (reverts to guest after logout)", () => {
    // Logged in: shows the account name.
    const authed = loadOrCreateIdentity("Alice");
    expect(authed.name).toBe("Alice");

    // Stored identity keeps the guest name, NOT "Alice".
    const stored = parseIdentity(localStorage.getItem("uxis:identity"));
    expect(stored?.name).toMatch(/^Guest \d{4}$/);

    // Logged out: name falls back to the guest name, not the previous account name.
    const anon = loadOrCreateIdentity(null);
    expect(anon.name).not.toBe("Alice");
    expect(anon.name).toMatch(/^Guest \d{4}$/);
    expect(anon.id).toBe(authed.id);
  });
});
