// Single source of truth for which routes render in dark mode.
//
// The studio/admin surface (studio, account, pending, plugin pairing) uses the
// dark theme; the public-facing home (/) and viewer/chat (/p, /chat) stay light
// and are intentionally NOT listed here. Auth pages (/login, /signup, ...) are
// excluded too — they self-manage their own scoped `.dark` form treatment.
//
// NOTE: the inline anti-flash script in app/layout.tsx hardcodes this same list
// (it runs before any module loads). Keep the two in sync.
export const DARK_ROUTE_PREFIXES = ["/studio", "/me", "/pending", "/plugin-auth"];

export function isDarkRoute(pathname: string): boolean {
  return DARK_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
