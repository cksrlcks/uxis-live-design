import { generatePublicId } from "@/lib/proposals/public-id";

const VARIANT_SLUG_LETTERS = "abcdefghijklmnopqrstuvwxyz";

// Stable, immutable URL key for a new variant within one proposal.
// Prefers the first unused a..z letter; falls back to a short random id once all 26 are taken.
export function nextVariantSlug(used: Iterable<string>): string {
  const taken = new Set(used);
  for (const c of VARIANT_SLUG_LETTERS) {
    if (!taken.has(c)) return c;
  }
  let cand = generatePublicId(4);
  while (taken.has(cand)) cand = generatePublicId(4);
  return cand;
}

// Default display label for the Nth (0-based) variant: A, B, ... Z, then "안 27", ...
export function defaultVariantLabel(index: number): string {
  if (index < 26) return String.fromCharCode(65 + index);
  return `안 ${index + 1}`;
}
