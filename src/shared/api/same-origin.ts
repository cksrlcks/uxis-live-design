export function isSameOrigin(originHeader: string | null, host: string | null): boolean {
  if (!originHeader || !host) return false;
  try {
    return new URL(originHeader).host === host;
  } catch {
    return false;
  }
}
