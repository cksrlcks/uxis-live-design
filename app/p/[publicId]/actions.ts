"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/legacy/lib/db";
import { proposals } from "@drizzle/schema";
import { verifyPassword } from "@/legacy/lib/access/password";
import { signUnlockToken, unlockCookieName, UNLOCK_TTL_SECONDS } from "@/legacy/lib/access/cookie";

export async function unlock(publicId: string, formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const rows = await db.select().from(proposals).where(eq(proposals.publicId, publicId)).limit(1);
  const proposal = rows[0];
  if (!proposal || proposal.visibility !== "public" || !proposal.accessPasswordHash) {
    redirect(`/p/${publicId}`);
  }
  if (!verifyPassword(password, proposal.accessPasswordHash)) {
    redirect(`/p/${publicId}?error=1`);
  }
  const exp = Math.floor(Date.now() / 1000) + UNLOCK_TTL_SECONDS;
  const token = signUnlockToken(publicId, exp, process.env.ACCESS_TOKEN_SECRET!);
  const store = await cookies();
  store.set(unlockCookieName(publicId), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production", // allow over http://localhost in dev
    sameSite: "lax",
    // path "/" so the cookie reaches BOTH the viewer pages (/p/<id>) AND the BFF
    // routes (/api/p/<id>/...). It's scoped per-proposal by the cookie NAME
    // (pu_<publicId>) + HMAC-signed token, so a broad path doesn't weaken security.
    path: "/",
    maxAge: UNLOCK_TTL_SECONDS,
  });
  redirect(`/p/${publicId}`);
}
