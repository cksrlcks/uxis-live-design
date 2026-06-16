"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { proposals } from "@/drizzle/schema";
import { verifyPassword } from "@/lib/access/password";
import { signUnlockToken, unlockCookieName, UNLOCK_TTL_SECONDS } from "@/lib/access/cookie";

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
    secure: true,
    sameSite: "lax",
    path: `/p/${publicId}`,
    maxAge: UNLOCK_TTL_SECONDS,
  });
  redirect(`/p/${publicId}`);
}
