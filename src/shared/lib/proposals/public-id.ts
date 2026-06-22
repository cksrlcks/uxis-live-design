import { customAlphabet } from "nanoid";

// No 0/1/o/i/l to avoid visual ambiguity in shared URLs.
export const PUBLIC_ID_ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";
export const PUBLIC_ID_LENGTH = 8;

const nanoid = customAlphabet(PUBLIC_ID_ALPHABET, PUBLIC_ID_LENGTH);

export function generatePublicId(length = PUBLIC_ID_LENGTH): string {
  return nanoid(length);
}
