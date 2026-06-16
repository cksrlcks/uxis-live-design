import { randomInt } from "node:crypto";

// No 0/1/o/i/l to avoid visual ambiguity in shared URLs.
export const PUBLIC_ID_ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";
export const PUBLIC_ID_LENGTH = 8;

export function generatePublicId(length = PUBLIC_ID_LENGTH): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += PUBLIC_ID_ALPHABET[randomInt(PUBLIC_ID_ALPHABET.length)];
  }
  return out;
}
