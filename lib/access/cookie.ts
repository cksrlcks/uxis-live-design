import { createHmac, timingSafeEqual } from "node:crypto";

export const UNLOCK_TTL_SECONDS = 12 * 60 * 60; // 12h

export function unlockCookieName(publicId: string): string {
  return `pu_${publicId}`;
}

// Token format: "<publicId>.<expEpochSec>.<hmacHex>"
export function signUnlockToken(publicId: string, expEpochSec: number, secret: string): string {
  const payload = `${publicId}.${expEpochSec}`;
  const sig = createHmac("sha256", secret).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

export function verifyUnlockToken(
  token: string,
  publicId: string,
  nowEpochSec: number,
  secret: string,
): boolean {
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [pid, expStr, sig] = parts;
  if (pid !== publicId) return false;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < nowEpochSec) return false;
  const expected = createHmac("sha256", secret).update(`${pid}.${expStr}`).digest("hex");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
