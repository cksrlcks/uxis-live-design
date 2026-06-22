"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyPassword } from "@/shared/lib/password";
import { findViewerProposal } from "@/shared/access/find-viewer-proposal.server";
import {
  signUnlockToken,
  unlockCookieName,
  UNLOCK_TTL_SECONDS,
  REMEMBER_TTL_SECONDS,
} from "@/shared/access/unlock-token";

export async function unlock(publicId: string, formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const remember = formData.get("remember") != null; // 체크 시 "on"
  // publicId/도메인 어느 쪽으로 접근했든, 쿠키·토큰은 전달받은 동일 파라미터로 키잉한다.
  const proposal = await findViewerProposal(publicId);
  if (!proposal || proposal.visibility !== "public" || !proposal.accessPasswordHash) {
    redirect(`/p/${publicId}`);
  }
  if (!verifyPassword(password, proposal.accessPasswordHash)) {
    redirect(`/p/${publicId}?error=1`);
  }
  const ttl = remember ? REMEMBER_TTL_SECONDS : UNLOCK_TTL_SECONDS;
  const exp = Math.floor(Date.now() / 1000) + ttl;
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
    // 기억하기: maxAge로 영속 쿠키(24h). 미체크: maxAge 생략 → 브라우저 종료 시 만료되는
    // 세션 쿠키(토큰 exp는 12h 안전 상한).
    ...(remember ? { maxAge: REMEMBER_TTL_SECONDS } : {}),
  });
  redirect(`/p/${publicId}`);
}
