// Single source of truth for which routes render in dark mode.
//
// The studio surface (/studio/*) renders LIGHT — Linear-light redesign
// (2026-06-28). The account/pending/plugin-pairing surfaces stay dark for now.
// The public home (/) and viewer/chat (/p, /chat) stay light and are
// intentionally NOT listed here. Auth pages (/login, /signup, ...) self-manage
// their own scoped `.dark` form treatment.
//
// NOTE: if an anti-flash inline script ever duplicates this list (e.g. in
// app/layout.tsx, running before any module loads), keep the two in sync.
export const DARK_ROUTE_PREFIXES = ["/me", "/pending", "/plugin-auth"];

export function isDarkRoute(pathname: string): boolean {
  return DARK_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
