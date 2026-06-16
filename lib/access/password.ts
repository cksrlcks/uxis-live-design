import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const KEYLEN = 64;

// Stored format: "<saltHex>:<hashHex>". Plaintext is never stored.
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, KEYLEN).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const computed = scryptSync(password, salt, KEYLEN);
  const expected = Buffer.from(hash, "hex");
  if (expected.length !== computed.length) return false;
  return timingSafeEqual(expected, computed);
}
