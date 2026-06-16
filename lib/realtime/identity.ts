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

export type Profile = { name: string; color: string };

export function parseProfile(raw: string | null): Profile | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw);
    if (o && typeof o.name === "string" && o.name && typeof o.color === "string" && o.color) {
      return { name: o.name, color: o.color };
    }
  } catch {
    // fall through
  }
  return null;
}

const TAB_ID_KEY = "uxis:tabId";    // per-tab (sessionStorage) → each tab is a distinct participant
const PROFILE_KEY = "uxis:profile"; // persistent name/color (localStorage), shared across tabs

function newId(seed: number): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `g-${seed}-${Math.floor(Math.random() * 1_000_000)}`;
}

// Browser-only. Identity id is per-tab so two tabs/windows are distinct realtime
// participants; the display name/color persist across tabs and survive reloads.
// `editorName`, when present (logged-in editor), overrides only the display name.
export function loadOrCreateIdentity(editorName: string | null): Identity {
  let id = typeof sessionStorage !== "undefined" ? sessionStorage.getItem(TAB_ID_KEY) : null;
  if (!id) {
    id = newId(Math.floor(Math.random() * 1_000_000));
    if (typeof sessionStorage !== "undefined") sessionStorage.setItem(TAB_ID_KEY, id);
  }

  let profile = typeof localStorage !== "undefined" ? parseProfile(localStorage.getItem(PROFILE_KEY)) : null;
  if (!profile) {
    const seed = Math.floor(Math.random() * 1_000_000);
    profile = { name: defaultGuestName(seed), color: pickColor(seed) };
    saveProfile(profile);
  }

  return { id, name: editorName ?? profile.name, color: profile.color };
}

// Persist the (possibly renamed) display name + color so it carries across tabs/reloads.
export function saveIdentity(identity: Identity): void {
  saveProfile({ name: identity.name, color: identity.color });
}

function saveProfile(profile: Profile): void {
  if (typeof localStorage !== "undefined") localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}
