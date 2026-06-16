export type Identity = { id: string; name: string; color: string };

export const IDENTITY_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899",
] as const;

export function pickColor(seed: number): string {
  return IDENTITY_COLORS[Math.abs(Math.trunc(seed)) % IDENTITY_COLORS.length];
}

export function defaultGuestName(seed: number): string {
  return `Guest ${(Math.abs(Math.trunc(seed)) % 9000) + 1000}`;
}

export function parseIdentity(raw: string | null): Identity | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw);
    if (o && typeof o.id === "string" && o.id &&
        typeof o.name === "string" && o.name &&
        typeof o.color === "string" && o.color) {
      return { id: o.id, name: o.name, color: o.color };
    }
  } catch {
    // fall through
  }
  return null;
}

// One identity per BROWSER (localStorage), shared across all tabs/windows → the same
// person is a single realtime participant no matter how many tabs they open. The
// provider's self-id cursor guard keeps your own cursor from rendering in your other tabs.
const STORAGE_KEY = "uxis:identity";

// Browser-only: load the saved identity or create a fresh anonymous one.
// `editorName`, when present (logged-in editor), overrides the display name.
export function loadOrCreateIdentity(editorName: string | null): Identity {
  let identity = typeof localStorage !== "undefined" ? parseIdentity(localStorage.getItem(STORAGE_KEY)) : null;
  if (!identity) {
    const seed = Math.floor(Math.random() * 1_000_000);
    const id = (typeof crypto !== "undefined" && "randomUUID" in crypto) ? crypto.randomUUID() : String(seed);
    identity = { id, name: defaultGuestName(seed), color: pickColor(seed) };
  }
  if (editorName) identity = { ...identity, name: editorName };
  saveIdentity(identity);
  return identity;
}

export function saveIdentity(identity: Identity): void {
  if (typeof localStorage !== "undefined") localStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
}
